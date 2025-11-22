#!/usr/bin/env node

/**
 * @file deploy-base-protocol.ts
 * @notice Wrapper script that deploys LiquidationHook with Hardhat, then deploys BaseProtocol with Ignition
 * @dev This script automates the two-step deployment process required for Uniswap V4 hooks
 */

import { execSync, spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync, unlinkSync, renameSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const NETWORK = process.env.NETWORK || "baseSepolia";
const PARAMETERS_FILE = `ignition/parameters/${NETWORK}.json`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(message: string) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

function checkEnvVar(name: string, defaultValue?: string): string {
    const value = process.env[name] || defaultValue;
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

async function deployLiquidationHook(): Promise<string | null> {
    log("🔧 Step 2: Deploying LiquidationHook...");
    log("   ℹ️  Note: Hardhat has issues compiling LiquidationHook with @uniswap imports");
    log("   ℹ️  Using Foundry for hook deployment (better CREATE2 support)");

    // Check if Foundry is available
    try {
        execSync("forge --version", { stdio: "ignore" });
    } catch {
        log("⚠️  Foundry not found. Skipping hook deployment.");
        log("📋 Install Foundry: curl -L https://foundry.paradigm.xyz | bash");
        log("📋 Or deploy hook manually later");
        return null;
    }

    try {
        // Use Foundry to deploy the hook (better CREATE2 support)
        const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
        const privateKey = process.env.PRIVATE_KEY;

        if (!privateKey) {
            log("⚠️  PRIVATE_KEY not set. Skipping hook deployment.");
            return null;
        }

        // Use Foundry script to deploy hook
        const foundryScript = "scripts/deploy-liquidation-hook.s.sol:DeployLiquidationHook";

        // Set POOL_MANAGER environment variable for Foundry script
        const paramsPath = join(process.cwd(), PARAMETERS_FILE);
        const params = JSON.parse(readFileSync(paramsPath, "utf-8"));
        const poolManagerAddress = params.BaseProtocol?.poolManager || "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408";
        process.env.POOL_MANAGER = poolManagerAddress;
        const command = `forge script ${foundryScript} --rpc-url ${rpcUrl} --broadcast --private-key ${privateKey}`;

        log(`📋 Executing: forge script ${foundryScript} --rpc-url ${rpcUrl} --broadcast --private-key ***`);

        const output = execSync(command, {
            encoding: "utf-8",
            stdio: "pipe",
            cwd: process.cwd(),
        });

        // Extract address from output
        const addressMatch = output.match(/LiquidationHook deployed at:\s*(0x[a-fA-F0-9]{40})/);

        if (addressMatch && addressMatch[1]) {
            const hookAddress = addressMatch[1];
            log(`✅ LiquidationHook deployed at: ${hookAddress}`);
            return hookAddress;
        }

        log("⚠️  Could not extract hook address from Foundry output");
        return null;
    } catch (error: any) {
        log(`❌ Failed to deploy LiquidationHook: ${error.message}`);
        log("📋 You can deploy it manually later with:");
        log("   forge script scripts/deploy-liquidation-hook.s.sol:DeployLiquidationHook --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --private-key $PRIVATE_KEY");
        return null;
    }
}

function updateParametersFile(hookAddress: string): void {
    log("📝 Step 3: Updating parameters file with hook address...");

    try {
        const paramsPath = join(process.cwd(), PARAMETERS_FILE);
        const paramsContent = readFileSync(paramsPath, "utf-8");
        const params = JSON.parse(paramsContent);

        if (!params.BaseProtocol) {
            params.BaseProtocol = {};
        }

        params.BaseProtocol.liquidationHook = hookAddress;

        writeFileSync(paramsPath, JSON.stringify(params, null, 4));
        log(`✅ Updated ${PARAMETERS_FILE} with hook address`);
    } catch (error: any) {
        log(`⚠️  Could not update parameters file: ${error.message}`);
        log(`📋 Please manually add to ${PARAMETERS_FILE}:`);
        log(`   "liquidationHook": "${hookAddress}"`);
    }
}

async function deployBaseProtocol(): Promise<void> {
    log("🚀 Step 1: Deploying BaseProtocol with Hardhat Ignition...");
    log("   ℹ️  Note: LiquidationHook will be deployed separately after BaseProtocol");

    // Temporarily move LiquidationHook out of contracts to avoid Hardhat compilation issues
    const hookPath = join(process.cwd(), "contracts/hooks/LiquidationHook.sol");
    const hookBackupPath = join(process.cwd(), "contracts/hooks/LiquidationHook.sol.backup");
    let hookMoved = false;

    try {
        // Clean Hardhat cache first
        log("   ℹ️  Cleaning Hardhat cache...");
        try {
            execSync("npx hardhat clean", { stdio: "pipe", cwd: process.cwd() });
        } catch {
            // Ignore errors
        }

        // Check if hook exists and move it temporarily
        if (existsSync(hookPath)) {
            const hookContent = readFileSync(hookPath, "utf-8");
            writeFileSync(hookBackupPath, hookContent);
            unlinkSync(hookPath);
            hookMoved = true;
            log("   ℹ️  Temporarily moved LiquidationHook.sol to avoid Hardhat compilation issues");
        }

        // Remove liquidationHook from parameters temporarily if it exists
        // This allows BaseProtocol to deploy without the hook
        const paramsPath = join(process.cwd(), PARAMETERS_FILE);
        let paramsContent = readFileSync(paramsPath, "utf-8");
        const params = JSON.parse(paramsContent);

        const hookAddressBackup = params.BaseProtocol?.liquidationHook;
        if (hookAddressBackup && hookAddressBackup !== "0x0000000000000000000000000000000000000000") {
            delete params.BaseProtocol.liquidationHook;
            writeFileSync(paramsPath, JSON.stringify(params, null, 4));
            log("   ℹ️  Temporarily removed liquidationHook from parameters");
        }

        const command = `npx hardhat ignition deploy ignition/modules/BaseProtocol.ts --network ${NETWORK} --parameters ${PARAMETERS_FILE} --reset`;

        log(`📋 Executing: ${command}`);

        // Use spawn to handle confirmation prompts (Hardhat asks twice)
        const [cmd, ...args] = command.split(" ");
        let confirmationsSent = 0;

        await new Promise<void>((resolve, reject) => {
            const proc = spawn(cmd, args, {
                stdio: ["pipe", "pipe", "inherit"],
                cwd: process.cwd(),
            });

            // Listen to stdout to detect prompts and auto-respond
            let outputBuffer = "";
            proc.stdout?.on("data", (data: Buffer) => {
                const text = data.toString();
                outputBuffer += text;
                process.stdout.write(data); // Forward to console

                // Detect confirmation prompts and auto-respond immediately
                if (text.includes("Confirm") && confirmationsSent < 2 && proc.stdin) {
                    // Small delay to ensure prompt is fully displayed
                    setTimeout(() => {
                        if (proc.stdin && confirmationsSent < 2) {
                            proc.stdin.write("y\n");
                            confirmationsSent++;
                            if (confirmationsSent === 2) {
                                proc.stdin.end();
                            }
                        }
                    }, 100);
                }
            });

            // Fallback: send both confirmations after a delay if not already sent
            if (proc.stdin) {
                setTimeout(() => {
                    if (confirmationsSent < 2 && proc.stdin) {
                        proc.stdin.write("y\ny\n");
                        confirmationsSent = 2;
                        proc.stdin.end();
                    }
                }, 2000);
            }

            proc.on("close", (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Command exited with code ${code}`));
                }
            });

            proc.on("error", reject);
        });

        log("✅ BaseProtocol deployment completed!");

        // Restore hook address if it was there
        if (hookAddressBackup) {
            params.BaseProtocol.liquidationHook = hookAddressBackup;
            writeFileSync(paramsPath, JSON.stringify(params, null, 4));
        }
    } catch (error: any) {
        log(`❌ Failed to deploy BaseProtocol: ${error.message}`);
        throw error;
    } finally {
        // Restore LiquidationHook.sol if it was moved
        if (hookMoved) {
            try {
                if (existsSync(hookBackupPath)) {
                    renameSync(hookBackupPath, hookPath);
                    log("   ℹ️  Restored LiquidationHook.sol");
                }
            } catch (restoreError: any) {
                log(`   ⚠️  Could not restore LiquidationHook.sol: ${restoreError.message}`);
            }
        }
    }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("🚀 OmniCredit Base Protocol Deployment");
    console.log("=".repeat(60) + "\n");

    // Step 1: Deploy BaseProtocol first (without hook - hook is optional)
    // Note: Hardhat has issues compiling LiquidationHook with @uniswap imports
    // So we deploy BaseProtocol first, then deploy hook separately
    await deployBaseProtocol();

    // Step 2: Deploy LiquidationHook after BaseProtocol
    // Note: Hook deployment may fail with Hardhat due to CREATE2 complexity
    // In that case, deploy manually with Foundry: forge script scripts/deploy-liquidation-hook.s.sol:DeployLiquidationHook
    const hookAddress = await deployLiquidationHook();

    if (!hookAddress) {
        console.log("\n⚠️  LiquidationHook deployment failed or skipped.");
        console.log("📋 Options:");
        console.log("   1. Deploy manually: npx hardhat run scripts/deploy-liquidation-hook.ts --network baseSepolia");
        console.log("      Then add the address to ignition/parameters/baseSepolia.json");
        console.log("   2. The hook can be deployed later - BaseProtocol is already deployed\n");
    } else {
        // Step 3: Update parameters file with hook address
        updateParametersFile(hookAddress);
        console.log("\n✅ Hook address saved to parameters file for future reference");
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Deployment Complete!");
    console.log("=".repeat(60) + "\n");
}

main().catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
});
