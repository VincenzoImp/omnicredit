#!/usr/bin/env node

/**
 * @file deploy-cross-chain.ts
 * @notice Deploys cross-chain contracts (CollateralVault, USDCOFTAdapter, USDCOmnitoken) on satellite chains
 * @dev Uses Hardhat Ignition to deploy the appropriate contract based on chain type
 */

import { execSync, spawn } from "child_process";
import { readFileSync, existsSync, unlinkSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const NETWORK = process.env.NETWORK || "sepolia";
const PARAMETERS_FILE = `ignition/parameters/${NETWORK}.json`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function log(message: string) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

async function deployCrossChain(): Promise<void> {
    log(`🚀 Deploying CrossChain contracts on ${NETWORK}...`);

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
    } catch (error: any) {
        log(`   ⚠️  Could not move LiquidationHook: ${error.message}`);
    }

    // Check if parameters file exists and determine which module to use
    const paramsPath = join(process.cwd(), PARAMETERS_FILE);
    let moduleFile: string;
    
    try {
        const paramsContent = readFileSync(paramsPath, "utf-8");
        const params = JSON.parse(paramsContent);
        
        // Check which module parameters are present
        if (params.CrossChainEthereum) {
            moduleFile = "ignition/modules/CrossChainEthereum.ts";
            log("   Will deploy: USDCOFTAdapter");
        } else if (params.CrossChainSatellite) {
            moduleFile = "ignition/modules/CrossChainSatellite.ts";
            log("   Will deploy: CollateralVault");
        } else if (params.CrossChainNonUsdc) {
            moduleFile = "ignition/modules/CrossChainNonUsdc.ts";
            log("   Will deploy: USDCOmnitoken");
        } else if (params.CrossChain) {
            // Legacy format - extract chainType
            const chainType = params.CrossChain.chainType || "satellite";
            log(`   Chain type: ${chainType}`);
            
            if (chainType === "ethereum") {
                moduleFile = "ignition/modules/CrossChainEthereum.ts";
                log("   Will deploy: USDCOFTAdapter");
            } else if (chainType === "satellite") {
                moduleFile = "ignition/modules/CrossChainSatellite.ts";
                log("   Will deploy: CollateralVault");
            } else if (chainType === "non-usdc") {
                moduleFile = "ignition/modules/CrossChainNonUsdc.ts";
                log("   Will deploy: USDCOmnitoken");
            } else {
                throw new Error(`Unknown chainType: ${chainType}`);
            }
        } else {
            throw new Error(`Missing CrossChain parameters in ${PARAMETERS_FILE}. Expected CrossChainEthereum, CrossChainSatellite, CrossChainNonUsdc, or CrossChain (legacy)`);
        }
    } catch (error: any) {
        log(`❌ Error reading parameters file: ${error.message}`);
        log(`📋 Make sure ${PARAMETERS_FILE} exists and contains CrossChain parameters`);
        if (hookMoved) {
            // Restore hook before throwing
            try {
                if (existsSync(hookBackupPath)) {
                    renameSync(hookBackupPath, hookPath);
                }
            } catch {
                // Ignore restore errors
            }
        }
        throw error;
    }
    
    const command = `npx hardhat ignition deploy ${moduleFile} --network ${NETWORK} --parameters ${PARAMETERS_FILE} --reset`;

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

    log("✅ CrossChain deployment completed!");

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

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("🌐 OmniCredit Cross-Chain Deployment");
    console.log("=".repeat(60) + "\n");

    log(`Network: ${NETWORK}`);
    log(`Parameters file: ${PARAMETERS_FILE}`);

    try {
        await deployCrossChain();

        console.log("\n" + "=".repeat(60));
        console.log("✅ Cross-Chain Deployment Complete!");
        console.log("=".repeat(60));
        console.log("\n📋 Next steps:");
        console.log("   1. Configure the deployed contract with the Base chain coordinator");
        console.log("   2. Set up LayerZero message paths between chains");
        console.log("   3. Test cross-chain collateral deposits\n");
    } catch (error: any) {
        console.error("\n❌ Deployment failed:", error.message);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
});

