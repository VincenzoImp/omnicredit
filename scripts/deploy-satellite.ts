#!/usr/bin/env node

/**
 * Deploy a satellite chain (Base Sepolia, Optimism Sepolia, ...)
 * 
 * Responsibilities:
 * - Read the ProtocolCore address from deployments artifacts
 * - Convert it to bytes32 and patch the Ignition parameter file
 * - Run the corresponding Ignition module with --reset safeguards
 * 
 * Usage (package.json script handles the flags):
 *   hardhat run scripts/deploy-satellite.ts --network baseSepolia -- --chain baseSepolia
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CHAIN_CONFIG = {
    baseSepolia: {
        module: "ignition/modules/BaseSepolia.ts",
        parameters: "ignition/parameters/baseSepolia.json",
        network: "baseSepolia",
    },
    optimismSepolia: {
        module: "ignition/modules/OptimismSepolia.ts",
        parameters: "ignition/parameters/optimismSepolia.json",
        network: "optimismSepolia",
    },
} as const;

type ChainKey = keyof typeof CHAIN_CONFIG;

const DEPLOYMENTS_FILE = join(__dirname, "../deployments.json");
const ARBITRUM_CHAIN_FOLDER = join(__dirname, "../ignition/deployments/chain-421614");

interface DeploymentData {
    arbitrumSepolia: {
        protocolCore?: string;
        [key: string]: string | undefined;
    };
    baseSepolia: Record<string, string>;
    optimismSepolia: Record<string, string>;
}

function loadDeploymentData(): DeploymentData {
    if (!existsSync(DEPLOYMENTS_FILE)) {
        return {
            arbitrumSepolia: {},
            baseSepolia: {},
            optimismSepolia: {},
        };
    }

    try {
        const parsed = JSON.parse(readFileSync(DEPLOYMENTS_FILE, "utf-8"));
        return {
            arbitrumSepolia: parsed.arbitrumSepolia || {},
            baseSepolia: parsed.baseSepolia || {},
            optimismSepolia: parsed.optimismSepolia || {},
        };
    } catch (error) {
        console.warn("⚠️  Unable to parse deployments.json, recreating file:", error);
        return {
            arbitrumSepolia: {},
            baseSepolia: {},
            optimismSepolia: {},
        };
    }
}

function saveDeploymentData(data: DeploymentData): void {
    writeFileSync(DEPLOYMENTS_FILE, JSON.stringify(data, null, 2));
}

function parseChainArg(): ChainKey {
    let chain: string | undefined = process.env.SATELLITE_CHAIN;
    const argv = process.argv.slice(2);

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--chain" && argv[i + 1]) {
            chain = argv[i + 1];
            break;
        }
        if (arg.startsWith("--chain=")) {
            chain = arg.split("=")[1];
            break;
        }
    }

    if (!chain || !(chain in CHAIN_CONFIG)) {
        console.error("❌ Please provide --chain baseSepolia|optimismSepolia");
        process.exit(1);
    }

    return chain as ChainKey;
}

function addressToBytes32(address: string): string {
    if (!address.startsWith("0x")) {
        address = "0x" + address;
    }
    return "0x" + address.slice(2).padStart(64, "0");
}

function readProtocolCoreFromIgnition(): string | undefined {
    const addressesPath = join(ARBITRUM_CHAIN_FOLDER, "deployed_addresses.json");
    if (existsSync(addressesPath)) {
        const mapping = JSON.parse(readFileSync(addressesPath, "utf-8")) as Record<string, string>;
        return mapping["CoreContracts#ProtocolCore"] || mapping["ArbitrumSepolia#ProtocolCore"];
    }
    return undefined;
}

function loadProtocolCoreAddress(): string {
    const fromIgnition = readProtocolCoreFromIgnition();
    if (fromIgnition) {
        return fromIgnition;
    }

    const deployments = loadDeploymentData();
    if (deployments.arbitrumSepolia.protocolCore) {
        return deployments.arbitrumSepolia.protocolCore;
    }

    console.error("❌ ProtocolCore address not found. Deploy Arbitrum first.");
    process.exit(1);
}

function updateParametersFile(parametersRelativePath: string, protocolCore: string): void {
    const paramsPath = join(__dirname, "..", parametersRelativePath);
    if (!existsSync(paramsPath)) {
        console.error(`❌ Parameters file not found: ${paramsPath}`);
        process.exit(1);
    }

    const params = JSON.parse(readFileSync(paramsPath, "utf-8"));
    const protocolCoreBytes32 = addressToBytes32(protocolCore);

    params.protocolCoreAddress = protocolCoreBytes32;
    if (params.SatelliteChain) {
        params.SatelliteChain.protocolCoreAddress = protocolCoreBytes32;
    }

    writeFileSync(paramsPath, JSON.stringify(params, null, 2));
    console.log(`✅ Parameters updated with ProtocolCore bytes32 for ${paramsPath}`);
}

function runIgnitionDeploy(modulePath: string, network: string, parametersPath: string): Promise<void> {
    const args = [
        "hardhat",
        "ignition",
        "deploy",
        modulePath,
        "--network",
        network,
        "--reset",
        "--parameters",
        parametersPath,
    ];

    console.log(`\n📦 Executing satellite deployment via: npx ${args.join(" ")}\n`);

    const proc = spawn("npx", args, { stdio: "inherit" });

    return new Promise((resolve, reject) => {
        proc.on("error", (err) => reject(err));
        proc.on("exit", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Ignition exited with code ${code}`));
            }
        });
    });
}

async function main() {
    const chain = parseChainArg();
    const config = CHAIN_CONFIG[chain];
    const protocolCoreAddress = loadProtocolCoreAddress();
    const deployments = loadDeploymentData();

    // Keep deployments.json in sync so future runs reuse the latest address
    if (deployments.arbitrumSepolia.protocolCore !== protocolCoreAddress) {
        deployments.arbitrumSepolia.protocolCore = protocolCoreAddress;
        saveDeploymentData(deployments);
        console.log("✅ deployments.json updated with latest ProtocolCore address");
    }

    console.log(`\n🔧 Preparing deployment for ${chain}`);
    console.log(`   Using ProtocolCore: ${protocolCoreAddress}`);

    updateParametersFile(config.parameters, protocolCoreAddress);

    await runIgnitionDeploy(config.module, config.network, config.parameters);

    console.log(`\n✅ ${chain} deployment completed`);
}

main().catch((error) => {
    console.error("❌ Satellite deployment script failed:", error);
    process.exit(1);
});

