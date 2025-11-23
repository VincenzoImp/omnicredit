#!/usr/bin/env node

/**
 * OmniCredit Protocol Deployment Script
 * 
 * Professional deployment script using Hardhat Ignition modules.
 * 
 * This script:
 * 1. Deploys ProtocolCore and related contracts on Arbitrum Sepolia
 * 2. Deploys LenderVault and CollateralVault on Base Sepolia and Optimism Sepolia
 * 3. Configures LayerZero peers between all contracts
 * 4. Authorizes vaults in ProtocolCore
 * 5. Saves deployment addresses to a JSON file
 * 
 * Usage:
 *   npx hardhat run scripts/deploy.ts --network arbitrumSepolia
 * 
 * Environment Variables Required:
 *   - PRIVATE_KEY: Private key of deployer account
 *   - ARBITRUM_SEPOLIA_RPC_URL: RPC URL for Arbitrum Sepolia
 *   - BASE_SEPOLIA_RPC_URL: RPC URL for Base Sepolia
 *   - OPTIMISM_SEPOLIA_RPC_URL: RPC URL for Optimism Sepolia
 *   - PYTH_ADDRESS: Pyth Network contract address (testnet)
 *   - ETH_PRICE_FEED_ID: Pyth price feed ID for ETH/USD
 */

import hre from "hardhat";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

// ============ ES MODULE COMPATIBILITY ============
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============ CONFIGURATION ============

const ARBITRUM_SEPOLIA_EID = 40231;
const BASE_SEPOLIA_EID = 40245;
const OPTIMISM_SEPOLIA_EID = 40232;

const DEPLOYMENT_FILE = join(__dirname, "../deployments.json");

interface DeploymentAddresses {
    arbitrumSepolia: {
        protocolCore?: string;
        mockUSDC?: string;
        mockOFT?: string;
        creditScore?: string;
        feeBasedLimits?: string;
        priceOracle?: string;
        liquidationManager?: string;
    };
    baseSepolia: {
        lenderVault?: string;
        collateralVault?: string;
        mockUSDC?: string;
        mockOFT?: string;
    };
    optimismSepolia: {
        lenderVault?: string;
        collateralVault?: string;
        mockUSDC?: string;
        mockOFT?: string;
    };
}

// ============ HELPER FUNCTIONS ============

/**
 * Convert Ethereum address to bytes32 format for LayerZero
 */
function addressToBytes32(address: string): string {
    if (!address.startsWith("0x")) {
        address = "0x" + address;
    }
    return "0x" + address.slice(2).padStart(64, "0");
}

/**
 * Load deployment addresses from file
 */
function loadDeployments(): DeploymentAddresses {
    if (existsSync(DEPLOYMENT_FILE)) {
        return JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf-8"));
    }
    return {
        arbitrumSepolia: {},
        baseSepolia: {},
        optimismSepolia: {},
    };
}

/**
 * Save deployment addresses to file
 */
function saveDeployments(deployments: DeploymentAddresses): void {
    writeFileSync(DEPLOYMENT_FILE, JSON.stringify(deployments, null, 2));
    console.log(`\n✅ Deployment addresses saved to ${DEPLOYMENT_FILE}\n`);
}

/**
 * Get contract address from Ignition deployment.
 *
 * Supports Ignition v3 layout which stores all addresses in
 * `ignition/deployments/chain-<id>/deployed_addresses.json` using
 * keys in the form "<ModuleName>#<ContractName>" (e.g. "CoreContracts#ProtocolCore").
 */
function getIgnitionAddress(
    chainId: number,
    moduleName: string,
    contractName: string
): string | undefined {
    const basePath = join(
        __dirname,
        "../ignition/deployments",
        `chain-${chainId}`
    );

    // New Ignition v3 format: deployed_addresses.json
    const deployedAddressesPath = join(basePath, "deployed_addresses.json");
    if (existsSync(deployedAddressesPath)) {
        try {
            const mapping = JSON.parse(readFileSync(deployedAddressesPath, "utf-8")) as Record<string, string>;
            const key = `${moduleName}#${contractName}`;
            const address = mapping[key];
            if (address) {
                return address;
            }
        } catch (error) {
            console.error(`Error reading deployed_addresses.json: ${error}`);
        }
    }

    // Legacy per-module JSON format (kept as fallback for compatibility)
    const legacyPath = join(basePath, `${moduleName}.json`);
    if (!existsSync(legacyPath)) {
        return undefined;
    }

    try {
        const deployment = JSON.parse(readFileSync(legacyPath, "utf-8"));
        const contract = deployment.contracts?.[contractName];
        return contract?.address || undefined;
    } catch (error) {
        console.error(`Error reading deployment file: ${error}`);
        return undefined;
    }
}

/**
 * Deploy using Hardhat Ignition CLI
 */
function deployWithIgnition(
    modulePath: string,
    networkName: string,
    parametersPath?: string
): Promise<void> {
    const args = [
        "hardhat",
        "ignition",
        "deploy",
        modulePath,
        "--network",
        networkName,
        "--reset", // Reset deployment to handle parameter changes
    ];

    if (parametersPath) {
        args.push("--parameters", parametersPath);
    }

    console.log(`\n📦 Executing: npx ${args.join(" ")}\n`);
    console.log("⚠️  You will be prompted to confirm the deployment (y/N)\n");

    const proc = spawn("npx", args, {
        stdio: "inherit",
    });

    proc.on("error", (error) => {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    });

    proc.on("exit", (code) => {
        if (code !== 0) {
            console.error(`❌ Deployment failed with exit code ${code}`);
            process.exit(code || 1);
        }
    });

    // Wait for process to complete
    return new Promise<void>((resolve, reject) => {
        proc.on("exit", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Process exited with code ${code}`));
            }
        });
    });
}

/**
 * Update parameters file with ProtocolCore address
 */
function updateSatelliteParameters(
    chain: "baseSepolia" | "optimismSepolia",
    protocolCoreAddress: string
): void {
    const paramsPath = join(
        __dirname,
        "../ignition/parameters",
        `${chain}.json`
    );

    if (!existsSync(paramsPath)) {
        console.error(`❌ Parameters file not found: ${paramsPath}`);
        return;
    }

    const params = JSON.parse(readFileSync(paramsPath, "utf-8"));
    const protocolCoreBytes32 = addressToBytes32(protocolCoreAddress);

    params.protocolCoreAddress = protocolCoreBytes32;
    if (params.SatelliteChain) {
        params.SatelliteChain.protocolCoreAddress = protocolCoreBytes32;
    }

    writeFileSync(paramsPath, JSON.stringify(params, null, 2));
    console.log(`✅ Updated ${chain} parameters with ProtocolCore address`);
}

/**
 * Configure LayerZero peers for MockOFT contracts
 */
async function configureOFTPeers(
    deployments: DeploymentAddresses
): Promise<void> {
    console.log("\n🔗 Configuring MockOFT peers...\n");

    const ethers = (hre as any).ethers;
    const MockOFT = await ethers.getContractFactory("MockOFT");

    // Get all MockOFT addresses
    const arbitrumOFT = deployments.arbitrumSepolia.mockOFT;
    const baseSepoliaOFT = deployments.baseSepolia.mockOFT;
    const optimismOFT = deployments.optimismSepolia.mockOFT;

    if (!arbitrumOFT || !baseSepoliaOFT || !optimismOFT) {
        console.error("❌ Missing MockOFT addresses");
        return;
    }

    const arbitrumOFTContract = MockOFT.attach(arbitrumOFT);
    const baseSepoliaOFTContract = MockOFT.attach(baseSepoliaOFT);
    const optimismOFTContract = MockOFT.attach(optimismOFT);

    const [deployer] = await ethers.getSigners();

    // Arbitrum <-> Base Sepolia
    console.log("Configuring Arbitrum <-> Base Sepolia OFT peers...");
    await arbitrumOFTContract
        .connect(deployer)
        .setPeer(BASE_SEPOLIA_EID, addressToBytes32(baseSepoliaOFT));
    await baseSepoliaOFTContract
        .connect(deployer)
        .setPeer(ARBITRUM_SEPOLIA_EID, addressToBytes32(arbitrumOFT));

    // Arbitrum <-> Optimism
    console.log("Configuring Arbitrum <-> Optimism OFT peers...");
    await arbitrumOFTContract
        .connect(deployer)
        .setPeer(OPTIMISM_SEPOLIA_EID, addressToBytes32(optimismOFT));
    await optimismOFTContract
        .connect(deployer)
        .setPeer(ARBITRUM_SEPOLIA_EID, addressToBytes32(arbitrumOFT));

    // Base Sepolia <-> Optimism
    console.log("Configuring Base Sepolia <-> Optimism OFT peers...");
    await baseSepoliaOFTContract
        .connect(deployer)
        .setPeer(OPTIMISM_SEPOLIA_EID, addressToBytes32(optimismOFT));
    await optimismOFTContract
        .connect(deployer)
        .setPeer(BASE_SEPOLIA_EID, addressToBytes32(baseSepoliaOFT));

    console.log("✅ All OFT peers configured\n");
}

/**
 * Authorize vaults in ProtocolCore
 */
async function authorizeVaults(
    deployments: DeploymentAddresses
): Promise<void> {
    console.log("\n🔐 Authorizing vaults in ProtocolCore...\n");

    const protocolCoreAddress = deployments.arbitrumSepolia.protocolCore;
    if (!protocolCoreAddress) {
        console.error("❌ ProtocolCore address not found");
        return;
    }

    const ethers = (hre as any).ethers;
    const ProtocolCore = await ethers.getContractFactory("ProtocolCore");
    const protocolCore = ProtocolCore.attach(protocolCoreAddress);
    const [deployer] = await ethers.getSigners();

    // Authorize Base Sepolia LenderVault
    if (deployments.baseSepolia.lenderVault) {
        console.log("Authorizing Base Sepolia LenderVault...");
        await protocolCore
            .connect(deployer)
            .authorizeLenderVault(
                BASE_SEPOLIA_EID,
                addressToBytes32(deployments.baseSepolia.lenderVault)
            );
    }

    // Authorize Optimism LenderVault
    if (deployments.optimismSepolia.lenderVault) {
        console.log("Authorizing Optimism LenderVault...");
        await protocolCore
            .connect(deployer)
            .authorizeLenderVault(
                OPTIMISM_SEPOLIA_EID,
                addressToBytes32(deployments.optimismSepolia.lenderVault)
            );
    }

    // Authorize Base Sepolia CollateralVault
    if (deployments.baseSepolia.collateralVault) {
        console.log("Authorizing Base Sepolia CollateralVault...");
        await protocolCore
            .connect(deployer)
            .authorizeCollateralVault(
                BASE_SEPOLIA_EID,
                addressToBytes32(deployments.baseSepolia.collateralVault)
            );
    }

    // Authorize Optimism CollateralVault
    if (deployments.optimismSepolia.collateralVault) {
        console.log("Authorizing Optimism CollateralVault...");
        await protocolCore
            .connect(deployer)
            .authorizeCollateralVault(
                OPTIMISM_SEPOLIA_EID,
                addressToBytes32(deployments.optimismSepolia.collateralVault)
            );
    }

    console.log("✅ All vaults authorized\n");
}

/**
 * Configure ProtocolCore peers for OApp messaging
 */
async function configureProtocolCorePeers(
    deployments: DeploymentAddresses
): Promise<void> {
    console.log("\n🔗 Configuring ProtocolCore OApp peers...\n");

    const protocolCoreAddress = deployments.arbitrumSepolia.protocolCore;
    if (!protocolCoreAddress) {
        console.error("❌ ProtocolCore address not found");
        return;
    }

    const ethers = (hre as any).ethers;
    const ProtocolCore = await ethers.getContractFactory("ProtocolCore");
    const protocolCore = ProtocolCore.attach(protocolCoreAddress);
    const [deployer] = await ethers.getSigners();

    // Set peers for LenderVaults
    if (deployments.baseSepolia.lenderVault) {
        await protocolCore
            .connect(deployer)
            .setPeer(BASE_SEPOLIA_EID, addressToBytes32(deployments.baseSepolia.lenderVault));
    }
    if (deployments.optimismSepolia.lenderVault) {
        await protocolCore
            .connect(deployer)
            .setPeer(
                OPTIMISM_SEPOLIA_EID,
                addressToBytes32(deployments.optimismSepolia.lenderVault)
            );
    }

    // Set peers for CollateralVaults
    if (deployments.baseSepolia.collateralVault) {
        await protocolCore
            .connect(deployer)
            .setPeer(
                BASE_SEPOLIA_EID,
                addressToBytes32(deployments.baseSepolia.collateralVault)
            );
    }
    if (deployments.optimismSepolia.collateralVault) {
        await protocolCore
            .connect(deployer)
            .setPeer(
                OPTIMISM_SEPOLIA_EID,
                addressToBytes32(deployments.optimismSepolia.collateralVault)
            );
    }

    console.log("✅ ProtocolCore peers configured\n");
}

/**
 * Configure vault peers for OApp messaging
 */
async function configureVaultPeers(
    deployments: DeploymentAddresses
): Promise<void> {
    console.log("\n🔗 Configuring vault OApp peers...\n");

    const protocolCoreAddress = deployments.arbitrumSepolia.protocolCore;
    if (!protocolCoreAddress) {
        console.error("❌ ProtocolCore address not found");
        return;
    }

    const ethers = (hre as any).ethers;
    const LenderVault = await ethers.getContractFactory("LenderVault");
    const CollateralVault = await ethers.getContractFactory("CollateralVault");
    const [deployer] = await ethers.getSigners();

    // Configure Base Sepolia vaults
    if (deployments.baseSepolia.lenderVault) {
        const lenderVault = LenderVault.attach(deployments.baseSepolia.lenderVault);
        await lenderVault
            .connect(deployer)
            .setPeer(ARBITRUM_SEPOLIA_EID, addressToBytes32(protocolCoreAddress));
    }
    if (deployments.baseSepolia.collateralVault) {
        const collateralVault = CollateralVault.attach(
            deployments.baseSepolia.collateralVault
        );
        await collateralVault
            .connect(deployer)
            .setPeer(ARBITRUM_SEPOLIA_EID, addressToBytes32(protocolCoreAddress));
    }

    // Configure Optimism vaults
    if (deployments.optimismSepolia.lenderVault) {
        const lenderVault = LenderVault.attach(
            deployments.optimismSepolia.lenderVault
        );
        await lenderVault
            .connect(deployer)
            .setPeer(ARBITRUM_SEPOLIA_EID, addressToBytes32(protocolCoreAddress));
    }
    if (deployments.optimismSepolia.collateralVault) {
        const collateralVault = CollateralVault.attach(
            deployments.optimismSepolia.collateralVault
        );
        await collateralVault
            .connect(deployer)
            .setPeer(ARBITRUM_SEPOLIA_EID, addressToBytes32(protocolCoreAddress));
    }

    console.log("✅ Vault peers configured\n");
}

// ============ MAIN DEPLOYMENT FUNCTION ============

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("🚀 OmniCredit Protocol Deployment");
    console.log("=".repeat(60) + "\n");

    // Get network name from command line args or environment
    // When using --network flag, Hardhat sets HARDHAT_NETWORK env var
    const networkName = process.env.HARDHAT_NETWORK ||
        (process.argv.includes("--network")
            ? process.argv[process.argv.indexOf("--network") + 1]
            : "hardhat");
    console.log(`📡 Network: ${networkName}\n`);

    // Get ethers from hre (available when @nomicfoundation/hardhat-ethers is configured)
    // In Hardhat 3, ethers is available via hre.ethers when the plugin is loaded
    let ethers: any;
    try {
        ethers = (hre as any).ethers;
        // If not available, try accessing via network connection
        if (!ethers) {
            const { network: net } = await import("hardhat");
            const connection = await net.connect();
            ethers = (connection as any).ethers;
        }
    } catch (error) {
        console.error("❌ Error accessing ethers:", error);
        console.error("   Make sure @nomicfoundation/hardhat-ethers is configured in hardhat.config.ts");
        process.exit(1);
    }

    if (!ethers) {
        console.error("❌ ethers not available. Make sure @nomicfoundation/hardhat-ethers is configured.");
        process.exit(1);
    }

    const [deployer] = await ethers.getSigners();
    console.log(`👤 Deployer: ${deployer.address}`);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

    if (balance === 0n) {
        console.error("❌ Deployer account has no balance!");
        process.exit(1);
    }

    let deployments = loadDeployments();

    // ============ STEP 1: Deploy Arbitrum Sepolia ============
    console.log("=".repeat(60));
    console.log("STEP 1: Deploying on Arbitrum Sepolia");
    console.log("=".repeat(60) + "\n");

    if (!deployments.arbitrumSepolia.protocolCore) {
        console.log("Deploying ProtocolCore and related contracts...\n");
        await deployWithIgnition(
            "ignition/modules/ArbitrumSepolia.ts",
            networkName,
            "ignition/parameters/arbitrumSepolia.json"
        );

        // Load addresses from Ignition
        const protocolCoreAddr = getIgnitionAddress(
            421614,
            "CoreContracts",
            "ProtocolCore"
        );
        deployments.arbitrumSepolia.protocolCore = protocolCoreAddr ?? undefined;
        deployments.arbitrumSepolia.mockUSDC = getIgnitionAddress(
            421614,
            "CoreContracts",
            "MockUSDC"
        );
        deployments.arbitrumSepolia.mockOFT = getIgnitionAddress(
            421614,
            "MockOFT",
            "MockOFT"
        );
        deployments.arbitrumSepolia.creditScore = getIgnitionAddress(
            421614,
            "CoreContracts",
            "ContinuousCreditScore"
        );
        deployments.arbitrumSepolia.feeBasedLimits = getIgnitionAddress(
            421614,
            "CoreContracts",
            "FeeBasedLimits"
        );
        deployments.arbitrumSepolia.priceOracle = getIgnitionAddress(
            421614,
            "CoreContracts",
            "PriceOracle"
        );
        deployments.arbitrumSepolia.liquidationManager = getIgnitionAddress(
            421614,
            "CoreContracts",
            "LiquidationManager"
        );

        saveDeployments(deployments);
    } else {
        console.log("✅ Arbitrum Sepolia already deployed, skipping...\n");
    }

    if (!deployments.arbitrumSepolia.protocolCore) {
        console.error("❌ Failed to deploy ProtocolCore");
        process.exit(1);
    }

    console.log("✅ Arbitrum Sepolia deployment complete");
    console.log(`   ProtocolCore: ${deployments.arbitrumSepolia.protocolCore}`);
    console.log(`   MockUSDC: ${deployments.arbitrumSepolia.mockUSDC}`);
    console.log(`   MockOFT: ${deployments.arbitrumSepolia.mockOFT}\n`);

    // ============ STEP 2: Update Satellite Parameters ============
    console.log("=".repeat(60));
    console.log("STEP 2: Updating Satellite Chain Parameters");
    console.log("=".repeat(60) + "\n");

    updateSatelliteParameters(
        "baseSepolia",
        deployments.arbitrumSepolia.protocolCore!
    );
    updateSatelliteParameters(
        "optimismSepolia",
        deployments.arbitrumSepolia.protocolCore!
    );

    // ============ STEP 3: Deploy Base Sepolia ============
    console.log("\n" + "=".repeat(60));
    console.log("STEP 3: Deploying on Base Sepolia");
    console.log("=".repeat(60) + "\n");

    if (
        !deployments.baseSepolia.lenderVault ||
        !deployments.baseSepolia.collateralVault
    ) {
        console.log("Deploying LenderVault, CollateralVault, and Mock tokens...\n");
        await deployWithIgnition(
            "ignition/modules/BaseSepolia.ts",
            "baseSepolia",
            "ignition/parameters/baseSepolia.json"
        );

        // Load addresses from Ignition
        deployments.baseSepolia.lenderVault = getIgnitionAddress(
            84532,
            "SatelliteChain",
            "LenderVault"
        );
        deployments.baseSepolia.collateralVault = getIgnitionAddress(
            84532,
            "SatelliteChain",
            "CollateralVault"
        );
        deployments.baseSepolia.mockUSDC = getIgnitionAddress(
            84532,
            "SatelliteChain",
            "MockUSDC"
        );
        deployments.baseSepolia.mockOFT = getIgnitionAddress(
            84532,
            "MockOFT",
            "MockOFT"
        );

        saveDeployments(deployments);
    } else {
        console.log("✅ Base Sepolia already deployed, skipping...\n");
    }

    console.log("✅ Base Sepolia deployment complete");
    console.log(`   LenderVault: ${deployments.baseSepolia.lenderVault}`);
    console.log(`   CollateralVault: ${deployments.baseSepolia.collateralVault}`);
    console.log(`   MockUSDC: ${deployments.baseSepolia.mockUSDC}`);
    console.log(`   MockOFT: ${deployments.baseSepolia.mockOFT}\n`);

    // ============ STEP 4: Deploy Optimism Sepolia ============
    console.log("=".repeat(60));
    console.log("STEP 4: Deploying on Optimism Sepolia");
    console.log("=".repeat(60) + "\n");

    if (
        !deployments.optimismSepolia.lenderVault ||
        !deployments.optimismSepolia.collateralVault
    ) {
        console.log("Deploying LenderVault, CollateralVault, and Mock tokens...\n");
        await deployWithIgnition(
            "ignition/modules/OptimismSepolia.ts",
            "optimismSepolia",
            "ignition/parameters/optimismSepolia.json"
        );

        // Load addresses from Ignition
        deployments.optimismSepolia.lenderVault = getIgnitionAddress(
            11155420,
            "SatelliteChain",
            "LenderVault"
        );
        deployments.optimismSepolia.collateralVault = getIgnitionAddress(
            11155420,
            "SatelliteChain",
            "CollateralVault"
        );
        deployments.optimismSepolia.mockUSDC = getIgnitionAddress(
            11155420,
            "SatelliteChain",
            "MockUSDC"
        );
        deployments.optimismSepolia.mockOFT = getIgnitionAddress(
            11155420,
            "MockOFT",
            "MockOFT"
        );

        saveDeployments(deployments);
    } else {
        console.log("✅ Optimism Sepolia already deployed, skipping...\n");
    }

    console.log("✅ Optimism Sepolia deployment complete");
    console.log(
        `   LenderVault: ${deployments.optimismSepolia.lenderVault}`
    );
    console.log(
        `   CollateralVault: ${deployments.optimismSepolia.collateralVault}`
    );
    console.log(
        `   MockUSDC: ${deployments.optimismSepolia.mockUSDC}`
    );
    console.log(
        `   MockOFT: ${deployments.optimismSepolia.mockOFT}\n`
    );

    // ============ STEP 5: Configure LayerZero Peers ============
    console.log("=".repeat(60));
    console.log("STEP 5: Configuring LayerZero Peers");
    console.log("=".repeat(60) + "\n");

    // Note: Peer configuration requires switching networks
    // This is a simplified version - in production, you might want to
    // run this step separately for each network

    console.log("⚠️  Peer configuration requires manual execution on each network.");
    console.log("   Run the following commands:\n");
    console.log("   # Configure OFT peers");
    console.log("   npx hardhat run scripts/deploy.ts --network arbitrumSepolia --configure-peers");
    console.log("\n   # Authorize vaults");
    console.log("   npx hardhat run scripts/deploy.ts --network arbitrumSepolia --authorize-vaults\n");

    // ============ FINAL SUMMARY ============
    console.log("=".repeat(60));
    console.log("✅ DEPLOYMENT COMPLETE");
    console.log("=".repeat(60) + "\n");

    console.log("📋 Deployment Summary:\n");
    console.log("Arbitrum Sepolia:");
    console.log(`  ProtocolCore: ${deployments.arbitrumSepolia.protocolCore}`);
    console.log(`  MockUSDC: ${deployments.arbitrumSepolia.mockUSDC}`);
    console.log(`  MockOFT: ${deployments.arbitrumSepolia.mockOFT}\n`);

    console.log("Sepolia:");
    console.log(`  LenderVault: ${deployments.baseSepolia.lenderVault}`);
    console.log(`  CollateralVault: ${deployments.baseSepolia.collateralVault}`);
    console.log(`  MockUSDC: ${deployments.baseSepolia.mockUSDC}`);
    console.log(`  MockOFT: ${deployments.baseSepolia.mockOFT}\n`);

    console.log("Optimism Sepolia:");
    console.log(
        `  LenderVault: ${deployments.optimismSepolia.lenderVault}`
    );
    console.log(
        `  CollateralVault: ${deployments.optimismSepolia.collateralVault}`
    );
    console.log(`  MockUSDC: ${deployments.optimismSepolia.mockUSDC}`);
    console.log(`  MockOFT: ${deployments.optimismSepolia.mockOFT}\n`);

    console.log(`📄 Full deployment addresses saved to: ${DEPLOYMENT_FILE}\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });

