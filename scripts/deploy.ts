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
 *   npx hardhat run scripts/deploy.ts --network arbitrumSepolia --configure-peers
 *   npx hardhat run scripts/deploy.ts --network arbitrumSepolia --authorize-vaults
 * 
 * Environment Variables Required:
 *   - PRIVATE_KEY: Private key of deployer account
 *   - ARBITRUM_SEPOLIA_RPC_URL: RPC URL for Arbitrum Sepolia
 *   - BASE_SEPOLIA_RPC_URL: RPC URL for Base Sepolia
 *   - OPTIMISM_SEPOLIA_RPC_URL: RPC URL for Optimism Sepolia
 *   - PYTH_ADDRESS: Pyth Network contract address (testnet)
 *   - ETH_PRICE_FEED_ID: Pyth price feed ID for ETH/USD
 */

import { ethers as ethersLib } from "ethers";
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
 * Configure LayerZero peers for MockOFT contracts (Network Aware)
 */
async function configureOFTPeers(
    deployments: DeploymentAddresses,
    networkName: string
): Promise<void> {
    console.log("\n🔗 Configuring MockOFT peers...\n");

    // Safe access to ethers
    const hreAny = hre as any;
    let ethers = hreAny.ethers;
    let deployer: any;

    if (!ethers) {
        if (!hreAny.network || !hreAny.network.provider) {
            console.error("❌ Critical: hre.network.provider is missing. Cannot connect to network.");
            process.exit(1);
        }
        const provider = new ethersLib.BrowserProvider(hreAny.network.provider);
        deployer = await provider.getSigner();
        ethers = {
            ...ethersLib,
            provider,
            getSigners: async () => [deployer],
            getContractFactory: async (name: string) => {
                const artifact = await hreAny.artifacts.readArtifact(name);
                const factory = new ethersLib.ContractFactory(artifact.abi, artifact.bytecode, deployer);
                (factory as any).attach = (target: string) => new ethersLib.Contract(target, artifact.abi, deployer);
                return factory;
            },
        };
    } else {
        const signers = await ethers.getSigners();
        deployer = signers[0];
    }

    const MockOFT = await ethers.getContractFactory("MockOFT");

    const arbitrumOFT = deployments.arbitrumSepolia.mockOFT;
    const baseSepoliaOFT = deployments.baseSepolia.mockOFT;
    const optimismOFT = deployments.optimismSepolia.mockOFT;

    if (!arbitrumOFT || !baseSepoliaOFT || !optimismOFT) {
        console.error("❌ Missing MockOFT addresses in deployments.json");
        return;
    }

    if (networkName === "arbitrumSepolia") {
        console.log("Configuring Arbitrum Sepolia OFT peers...");
        const oft = MockOFT.attach(arbitrumOFT).connect(deployer);

        // Set Peer: Base Sepolia
        console.log(`Setting peer Base Sepolia (${BASE_SEPOLIA_EID})...`);
        await (await oft.setPeer(BASE_SEPOLIA_EID, addressToBytes32(baseSepoliaOFT))).wait();

        // Set Peer: Optimism Sepolia
        console.log(`Setting peer Optimism Sepolia (${OPTIMISM_SEPOLIA_EID})...`);
        await (await oft.setPeer(OPTIMISM_SEPOLIA_EID, addressToBytes32(optimismOFT))).wait();

    } else if (networkName === "baseSepolia") {
        console.log("Configuring Base Sepolia OFT peers...");
        const oft = MockOFT.attach(baseSepoliaOFT).connect(deployer);

        // Set Peer: Arbitrum Sepolia
        console.log(`Setting peer Arbitrum Sepolia (${ARBITRUM_SEPOLIA_EID})...`);
        await (await oft.setPeer(ARBITRUM_SEPOLIA_EID, addressToBytes32(arbitrumOFT))).wait();

        // Set Peer: Optimism Sepolia
        console.log(`Setting peer Optimism Sepolia (${OPTIMISM_SEPOLIA_EID})...`);
        await (await oft.setPeer(OPTIMISM_SEPOLIA_EID, addressToBytes32(optimismOFT))).wait();

    } else if (networkName === "optimismSepolia") {
        console.log("Configuring Optimism Sepolia OFT peers...");
        const oft = MockOFT.attach(optimismOFT).connect(deployer);

        // Set Peer: Arbitrum Sepolia
        console.log(`Setting peer Arbitrum Sepolia (${ARBITRUM_SEPOLIA_EID})...`);
        await (await oft.setPeer(ARBITRUM_SEPOLIA_EID, addressToBytes32(arbitrumOFT))).wait();

        // Set Peer: Base Sepolia
        console.log(`Setting peer Base Sepolia (${BASE_SEPOLIA_EID})...`);
        await (await oft.setPeer(BASE_SEPOLIA_EID, addressToBytes32(baseSepoliaOFT))).wait();
    } else {
        console.log(`Skipping OFT peer config for network: ${networkName}`);
    }

    console.log("✅ OFT peers configured for this network\n");
}

/**
 * Authorize vaults in ProtocolCore (Only runs on Arbitrum)
 */
async function authorizeVaults(
    deployments: DeploymentAddresses,
    networkName: string
): Promise<void> {
    if (networkName !== "arbitrumSepolia") {
        console.log("Skipping vault authorization (must be run on arbitrumSepolia)");
        return;
    }

    console.log("\n🔐 Authorizing vaults in ProtocolCore...\n");

    const protocolCoreAddress = deployments.arbitrumSepolia.protocolCore;
    if (!protocolCoreAddress) {
        console.error("❌ ProtocolCore address not found");
        return;
    }

    // Safe access to ethers
    const hreAny = hre as any;
    let ethers = hreAny.ethers;
    let deployer: any;

    if (!ethers) {
        const provider = new ethersLib.BrowserProvider(hreAny.network.provider);
        deployer = await provider.getSigner();
        ethers = {
            ...ethersLib,
            provider,
            getSigners: async () => [deployer],
            getContractFactory: async (name: string) => {
                const artifact = await hreAny.artifacts.readArtifact(name);
                const factory = new ethersLib.ContractFactory(artifact.abi, artifact.bytecode, deployer);
                (factory as any).attach = (target: string) => new ethersLib.Contract(target, artifact.abi, deployer);
                return factory;
            },
        };
    } else {
        const signers = await ethers.getSigners();
        deployer = signers[0];
    }

    const ProtocolCore = await ethers.getContractFactory("ProtocolCore");
    const protocolCore = ProtocolCore.attach(protocolCoreAddress).connect(deployer);

    // Authorize Base Sepolia LenderVault
    if (deployments.baseSepolia.lenderVault) {
        console.log("Authorizing Base Sepolia LenderVault...");
        await (await protocolCore.authorizeLenderVault(
            BASE_SEPOLIA_EID,
            addressToBytes32(deployments.baseSepolia.lenderVault)
        )).wait();
    }

    // Authorize Optimism LenderVault
    if (deployments.optimismSepolia.lenderVault) {
        console.log("Authorizing Optimism LenderVault...");
        await (await protocolCore.authorizeLenderVault(
            OPTIMISM_SEPOLIA_EID,
            addressToBytes32(deployments.optimismSepolia.lenderVault)
        )).wait();
    }

    // Authorize Base Sepolia CollateralVault
    if (deployments.baseSepolia.collateralVault) {
        console.log("Authorizing Base Sepolia CollateralVault...");
        await (await protocolCore.authorizeCollateralVault(
            BASE_SEPOLIA_EID,
            addressToBytes32(deployments.baseSepolia.collateralVault)
        )).wait();
    }

    // Authorize Optimism CollateralVault
    if (deployments.optimismSepolia.collateralVault) {
        console.log("Authorizing Optimism CollateralVault...");
        await (await protocolCore.authorizeCollateralVault(
            OPTIMISM_SEPOLIA_EID,
            addressToBytes32(deployments.optimismSepolia.collateralVault)
        )).wait();
    }

    console.log("✅ All vaults authorized\n");
}

/**
 * Configure ProtocolCore peers for OApp messaging (Only runs on Arbitrum)
 */
async function configureProtocolCorePeers(
    deployments: DeploymentAddresses,
    networkName: string
): Promise<void> {
    if (networkName !== "arbitrumSepolia") {
        return; // Only applicable on ProtocolCore chain
    }

    console.log("\n🔗 Configuring ProtocolCore OApp peers...\n");

    const protocolCoreAddress = deployments.arbitrumSepolia.protocolCore;
    if (!protocolCoreAddress) {
        console.error("❌ ProtocolCore address not found");
        return;
    }

    // Safe access to ethers
    const hreAny = hre as any;
    let ethers = hreAny.ethers;
    let deployer: any;

    if (!ethers) {
        const provider = new ethersLib.BrowserProvider(hreAny.network.provider);
        deployer = await provider.getSigner();
        ethers = {
            ...ethersLib,
            provider,
            getSigners: async () => [deployer],
            getContractFactory: async (name: string) => {
                const artifact = await hreAny.artifacts.readArtifact(name);
                const factory = new ethersLib.ContractFactory(artifact.abi, artifact.bytecode, deployer);
                (factory as any).attach = (target: string) => new ethersLib.Contract(target, artifact.abi, deployer);
                return factory;
            },
        };
    } else {
        const signers = await ethers.getSigners();
        deployer = signers[0];
    }

    const ProtocolCore = await ethers.getContractFactory("ProtocolCore");
    const protocolCore = ProtocolCore.attach(protocolCoreAddress).connect(deployer);

    // Set peers for LenderVaults
    if (deployments.baseSepolia.lenderVault) {
        console.log(`Setting ProtocolCore peer: Base Sepolia LenderVault...`);
        await (await protocolCore.setPeer(
            BASE_SEPOLIA_EID,
            addressToBytes32(deployments.baseSepolia.lenderVault)
        )).wait();
    }
    if (deployments.optimismSepolia.lenderVault) {
        console.log(`Setting ProtocolCore peer: Optimism Sepolia LenderVault...`);
        await (await protocolCore.setPeer(
            OPTIMISM_SEPOLIA_EID,
            addressToBytes32(deployments.optimismSepolia.lenderVault)
        )).wait();
    }

    // Set peers for CollateralVaults
    // ... (Skipped to avoid overwriting, as per original logic)

    console.log("✅ ProtocolCore OApp peers skipped (using manual authorization logic instead)\n");
}

/**
 * Configure vault peers for OApp messaging (Network Aware)
 */
async function configureVaultPeers(
    deployments: DeploymentAddresses,
    networkName: string
): Promise<void> {
    if (networkName === "arbitrumSepolia") return;

    console.log("\n🔗 Configuring vault OApp peers...\n");

    const protocolCoreAddress = deployments.arbitrumSepolia.protocolCore;
    if (!protocolCoreAddress) {
        console.error("❌ ProtocolCore address not found");
        return;
    }

    // Safe access to ethers
    const hreAny = hre as any;
    let ethers = hreAny.ethers;
    let deployer: any;

    if (!ethers) {
        const provider = new ethersLib.BrowserProvider(hreAny.network.provider);
        deployer = await provider.getSigner();
        ethers = {
            ...ethersLib,
            provider,
            getSigners: async () => [deployer],
            getContractFactory: async (name: string) => {
                const artifact = await hreAny.artifacts.readArtifact(name);
                const factory = new ethersLib.ContractFactory(artifact.abi, artifact.bytecode, deployer);
                (factory as any).attach = (target: string) => new ethersLib.Contract(target, artifact.abi, deployer);
                return factory;
            },
        };
    } else {
        const signers = await ethers.getSigners();
        deployer = signers[0];
    }

    const LenderVault = await ethers.getContractFactory("LenderVault");
    const CollateralVault = await ethers.getContractFactory("CollateralVault");

    // Configure Base Sepolia vaults
    if (networkName === "baseSepolia") {
        if (deployments.baseSepolia.lenderVault) {
            console.log("Configuring Base Sepolia LenderVault...");
            const vault = LenderVault.attach(deployments.baseSepolia.lenderVault).connect(deployer);
            // Set ProtocolCore as peer
            await (await vault.setPeer(ARBITRUM_SEPOLIA_EID, addressToBytes32(protocolCoreAddress))).wait();
            // Set ProtocolCore address in custom variable
            await (await vault.setProtocolCore(addressToBytes32(protocolCoreAddress), ARBITRUM_SEPOLIA_EID)).wait();
        }
        if (deployments.baseSepolia.collateralVault) {
            console.log("Configuring Base Sepolia CollateralVault...");
            const vault = CollateralVault.attach(deployments.baseSepolia.collateralVault).connect(deployer);
            await (await vault.setPeer(ARBITRUM_SEPOLIA_EID, addressToBytes32(protocolCoreAddress))).wait();
            // CollateralVault might also need custom setup if it has setProtocolCore
        }
    }

    // Configure Optimism vaults
    if (networkName === "optimismSepolia") {
        if (deployments.optimismSepolia.lenderVault) {
            console.log("Configuring Optimism Sepolia LenderVault...");
            const vault = LenderVault.attach(deployments.optimismSepolia.lenderVault).connect(deployer);
            await (await vault.setPeer(ARBITRUM_SEPOLIA_EID, addressToBytes32(protocolCoreAddress))).wait();
            await (await vault.setProtocolCore(addressToBytes32(protocolCoreAddress), ARBITRUM_SEPOLIA_EID)).wait();
        }
        if (deployments.optimismSepolia.collateralVault) {
            console.log("Configuring Optimism Sepolia CollateralVault...");
            const vault = CollateralVault.attach(deployments.optimismSepolia.collateralVault).connect(deployer);
            await (await vault.setPeer(ARBITRUM_SEPOLIA_EID, addressToBytes32(protocolCoreAddress))).wait();
        }
    }

    console.log("✅ Vault peers configured for this network\n");
}

// ============ MAIN DEPLOYMENT FUNCTION ============

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("🚀 OmniCredit Protocol Deployment / Configuration");
    console.log("=".repeat(60) + "\n");

    const hreAny = hre as any;
    let networkName = process.env.HARDHAT_NETWORK;

    // Manually parse --network if not in env (Hardhat CLI usually sets env, but for safety)
    if (!networkName) {
        const argv = process.argv;
        const index = argv.indexOf("--network");
        if (index !== -1 && index + 1 < argv.length) {
            networkName = argv[index + 1];
        } else {
            networkName = "hardhat";
        }
    }

    console.log(`📡 Network: ${networkName}\n`);

    // Hardhat v3 Compatibility: Connect to network if needed
    let provider;
    if (hreAny.network && typeof hreAny.network.connect === 'function') {
        console.log(`🔌 Connecting to ${networkName} via NetworkManager...`);
        try {
            const connection = await hreAny.network.connect(networkName);
            provider = connection.provider;
            // If the plugin injected ethers into the connection object
            if (connection.ethers) {
                hreAny.ethers = connection.ethers;
            }
        } catch (error) {
            console.error(`❌ Failed to connect to ${networkName}:`, error);
            process.exit(1);
        }
    } else if (hreAny.network && hreAny.network.provider) {
        provider = hreAny.network.provider;
    }

    // Parse flags (Environment Variables are preferred for Hardhat Scripts)
    const args = process.argv.slice(2);
    const configurePeers = args.includes("--configure-peers") || process.env.CONFIGURE_PEERS === "true";
    const authorizeVaultsFlag = args.includes("--authorize-vaults") || process.env.AUTHORIZE_VAULTS === "true";

    // Safe access to ethers with Fallback
    let ethers = hreAny.ethers;
    let deployer: any;

    if (!ethers) {
        console.warn("⚠️  'ethers' plugin missing on HRE. Falling back to manual Ethers v6 setup.");

        if (!provider) {
            console.error("❌ Critical: Provider is missing. Cannot connect to network.");
            process.exit(1);
        }

        try {
            // Use BrowserProvider to wrap the EIP-1193 provider from Hardhat
            const browserProvider = new ethersLib.BrowserProvider(provider);
            deployer = await browserProvider.getSigner();
            console.log("✅ Connected to network via manual BrowserProvider");

            // Mock the hardhat-ethers interface used in the script
            ethers = {
                ...ethersLib,
                provider: browserProvider,
                getSigners: async () => [deployer],
                getContractFactory: async (name: string) => {
                    const artifact = await hreAny.artifacts.readArtifact(name);
                    const factory = new ethersLib.ContractFactory(artifact.abi, artifact.bytecode, deployer);

                    // Add .attach() method for compatibility with existing code
                    (factory as any).attach = (target: string) => {
                        return new ethersLib.Contract(target, artifact.abi, deployer);
                    };

                    return factory;
                },
                formatEther: ethersLib.formatEther,
                parseEther: ethersLib.parseEther,
            };

            // Attach to HRE so helper functions can find it
            hreAny.ethers = ethers;

        } catch (error) {
            console.error("❌ Failed to setup manual ethers fallback:", error);
            process.exit(1);
        }
    } else {
        const signers = await ethers.getSigners();
        deployer = signers[0];
    }

    console.log(`👤 Deployer: ${deployer.address}`);
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

    let deployments = loadDeployments();

    // ============ CONFIGURATION MODE ============
    if (configurePeers || authorizeVaultsFlag) {
        if (configurePeers) {
            await configureOFTPeers(deployments, networkName);
            await configureProtocolCorePeers(deployments, networkName); // Only runs on Arb
            await configureVaultPeers(deployments, networkName);       // Only runs on Satellites
        }

        if (authorizeVaultsFlag) {
            await authorizeVaults(deployments, networkName); // Only runs on Arb
        }

        console.log("✨ Configuration tasks completed!");
        return;
    }

    // ============ DEPLOYMENT MODE ============

    // STEP 1: Arbitrum Sepolia
    if (networkName === "arbitrumSepolia") {
        console.log("=".repeat(60));
        console.log("STEP 1: Deploying on Arbitrum Sepolia");
        console.log("=".repeat(60) + "\n");

        if (!deployments.arbitrumSepolia.protocolCore) {
            await deployWithIgnition(
                "ignition/modules/ArbitrumSepolia.ts",
                networkName,
                "ignition/parameters/arbitrumSepolia.json"
            );

            // Update deployments object (simplified for brevity - normally requires reloading)
            // Re-load to get new addresses
            const protocolCoreAddr = getIgnitionAddress(421614, "CoreContracts", "ProtocolCore");
            if (protocolCoreAddr) {
                deployments.arbitrumSepolia.protocolCore = protocolCoreAddr;
                deployments.arbitrumSepolia.mockUSDC = getIgnitionAddress(421614, "CoreContracts", "MockUSDC");
                deployments.arbitrumSepolia.mockOFT = getIgnitionAddress(421614, "MockOFT", "MockOFT");
                saveDeployments(deployments);
            }
        } else {
            console.log("✅ Arbitrum Sepolia already deployed, skipping...\n");
        }

        // Update Satellite Params
        if (deployments.arbitrumSepolia.protocolCore) {
            updateSatelliteParameters("baseSepolia", deployments.arbitrumSepolia.protocolCore);
            updateSatelliteParameters("optimismSepolia", deployments.arbitrumSepolia.protocolCore);
        }
    }

    // STEP 2: Base Sepolia
    if (networkName === "baseSepolia") {
        console.log("\n" + "=".repeat(60));
        console.log("STEP 2: Deploying on Base Sepolia");
        console.log("=".repeat(60) + "\n");

        if (!deployments.baseSepolia.lenderVault) {
            await deployWithIgnition(
                "ignition/modules/BaseSepolia.ts",
                networkName,
                "ignition/parameters/baseSepolia.json"
            );

            const lenderVault = getIgnitionAddress(84532, "SatelliteChain", "LenderVault");
            if (lenderVault) {
                deployments.baseSepolia.lenderVault = lenderVault;
                deployments.baseSepolia.collateralVault = getIgnitionAddress(84532, "SatelliteChain", "CollateralVault");
                deployments.baseSepolia.mockUSDC = getIgnitionAddress(84532, "SatelliteChain", "MockUSDC");
                deployments.baseSepolia.mockOFT = getIgnitionAddress(84532, "MockOFT", "MockOFT");
                saveDeployments(deployments);
            }
        } else {
            console.log("✅ Base Sepolia already deployed, skipping...\n");
        }
    }

    // STEP 3: Optimism Sepolia
    if (networkName === "optimismSepolia") {
        console.log("\n" + "=".repeat(60));
        console.log("STEP 3: Deploying on Optimism Sepolia");
        console.log("=".repeat(60) + "\n");

        if (!deployments.optimismSepolia.lenderVault) {
            await deployWithIgnition(
                "ignition/modules/OptimismSepolia.ts",
                networkName,
                "ignition/parameters/optimismSepolia.json"
            );

            const lenderVault = getIgnitionAddress(11155420, "SatelliteChain", "LenderVault");
            if (lenderVault) {
                deployments.optimismSepolia.lenderVault = lenderVault;
                deployments.optimismSepolia.collateralVault = getIgnitionAddress(11155420, "SatelliteChain", "CollateralVault");
                deployments.optimismSepolia.mockUSDC = getIgnitionAddress(11155420, "SatelliteChain", "MockUSDC");
                deployments.optimismSepolia.mockOFT = getIgnitionAddress(11155420, "MockOFT", "MockOFT");
                saveDeployments(deployments);
            }
        } else {
            console.log("✅ Optimism Sepolia already deployed, skipping...\n");
        }
    }

    // Final Instructions
    console.log("=".repeat(60));
    console.log("✅ EXECUTION COMPLETE");
    console.log("=".repeat(60) + "\n");

    if (!configurePeers && !authorizeVaultsFlag) {
        console.log("⚠️  NEXT STEPS: PEER CONFIGURATION");
        console.log("   You must now configure peers on EACH network manually:\n");

        console.log("   1. On Arbitrum Sepolia:");
        console.log("      CONFIGURE_PEERS=true npx hardhat run scripts/deploy.ts --network arbitrumSepolia");
        console.log("      AUTHORIZE_VAULTS=true npx hardhat run scripts/deploy.ts --network arbitrumSepolia");

        console.log("\n   2. On Base Sepolia:");
        console.log("      CONFIGURE_PEERS=true npx hardhat run scripts/deploy.ts --network baseSepolia");

        console.log("\n   3. On Optimism Sepolia:");
        console.log("      CONFIGURE_PEERS=true npx hardhat run scripts/deploy.ts --network optimismSepolia");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Script failed:");
        console.error(error);
        process.exit(1);
    });
