#!/usr/bin/env node

/**
 * LayerZero Peer Configuration Script
 * 
 * Configures LayerZero peers between all contracts after deployment.
 * 
 * This script:
 * 1. Configures MockOFT peers (bidirectional between all chains)
 * 2. Configures ProtocolCore OApp peers with vaults
 * 3. Configures vault OApp peers with ProtocolCore
 * 4. Authorizes vaults in ProtocolCore
 * 
 * Usage:
 *   npx hardhat run scripts/configure-peers.ts --network arbitrumSepolia
 * 
 * Note: This script must be run on each network to configure peers.
 * Run on Arbitrum Sepolia first to authorize vaults, then on other networks.
 */

import hre from "hardhat";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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
    mockOFT?: string;
  };
  baseSepolia: {
    lenderVault?: string;
    collateralVault?: string;
    mockOFT?: string;
  };
  optimismSepolia: {
    lenderVault?: string;
    collateralVault?: string;
    mockOFT?: string;
  };
}

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
  if (!existsSync(DEPLOYMENT_FILE)) {
    throw new Error(`Deployment file not found: ${DEPLOYMENT_FILE}`);
  }
  return JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf-8"));
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🔗 LayerZero Peer Configuration");
  console.log("=".repeat(60) + "\n");

  // Get network name
  const networkName = process.env.HARDHAT_NETWORK ||
    (process.argv.includes("--network")
      ? process.argv[process.argv.indexOf("--network") + 1]
      : "hardhat");
  console.log(`📡 Network: ${networkName}\n`);

  // Get ethers from hre (available when @nomicfoundation/hardhat-ethers is configured)
  const ethers = (hre as any).ethers;
  if (!ethers) {
    console.error("❌ ethers not available. Make sure @nomicfoundation/hardhat-ethers is configured.");
    process.exit(1);
  }

  const deployments = loadDeployments();
  const [deployer] = await ethers.getSigners();

  console.log(`👤 Deployer: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    console.error("❌ Deployer account has no balance!");
    process.exit(1);
  }

  // ============ Configure MockOFT Peers ============
  if (networkName === "arbitrumSepolia") {
    console.log("=".repeat(60));
    console.log("STEP 1: Configuring MockOFT Peers");
    console.log("=".repeat(60) + "\n");

    const MockOFT = await ethers.getContractFactory("MockOFT");
    const arbitrumOFT = MockOFT.attach(deployments.arbitrumSepolia.mockOFT!);

    // Arbitrum <-> Sepolia
    if (deployments.baseSepolia.mockOFT) {
      console.log("Configuring Arbitrum <-> Base Sepolia OFT peers...");
      await arbitrumOFT
        .connect(deployer)
        .setPeer(
          BASE_SEPOLIA_EID,
          addressToBytes32(deployments.baseSepolia.mockOFT)
        );
      console.log("✅ Arbitrum -> Base Sepolia peer set");
    }

    // Arbitrum <-> Optimism
    if (deployments.optimismSepolia.mockOFT) {
      console.log("Configuring Arbitrum <-> Optimism OFT peers...");
      await arbitrumOFT
        .connect(deployer)
        .setPeer(
          OPTIMISM_SEPOLIA_EID,
          addressToBytes32(deployments.optimismSepolia.mockOFT)
        );
      console.log("✅ Arbitrum -> Optimism peer set");
    }
  } else if (networkName === "baseSepolia") {
    const MockOFT = await ethers.getContractFactory("MockOFT");
    const baseSepoliaOFT = MockOFT.attach(deployments.baseSepolia.mockOFT!);

    // Base Sepolia <-> Arbitrum
    if (deployments.arbitrumSepolia.mockOFT) {
      console.log("Configuring Base Sepolia <-> Arbitrum OFT peers...");
      await baseSepoliaOFT
        .connect(deployer)
        .setPeer(
          ARBITRUM_SEPOLIA_EID,
          addressToBytes32(deployments.arbitrumSepolia.mockOFT)
        );
      console.log("✅ Base Sepolia -> Arbitrum peer set");
    }

    // Base Sepolia <-> Optimism
    if (deployments.optimismSepolia.mockOFT) {
      console.log("Configuring Base Sepolia <-> Optimism OFT peers...");
      await baseSepoliaOFT
        .connect(deployer)
        .setPeer(
          OPTIMISM_SEPOLIA_EID,
          addressToBytes32(deployments.optimismSepolia.mockOFT)
        );
      console.log("✅ Base Sepolia -> Optimism peer set");
    }
  } else if (networkName === "optimismSepolia") {
    const MockOFT = await ethers.getContractFactory("MockOFT");
    const optimismOFT = MockOFT.attach(
      deployments.optimismSepolia.mockOFT!
    );

    // Optimism <-> Arbitrum
    if (deployments.arbitrumSepolia.mockOFT) {
      console.log("Configuring Optimism <-> Arbitrum OFT peers...");
      await optimismOFT
        .connect(deployer)
        .setPeer(
          ARBITRUM_SEPOLIA_EID,
          addressToBytes32(deployments.arbitrumSepolia.mockOFT)
        );
      console.log("✅ Optimism -> Arbitrum peer set");
    }

    // Optimism <-> Base Sepolia
    if (deployments.baseSepolia.mockOFT) {
      console.log("Configuring Optimism <-> Base Sepolia OFT peers...");
      await optimismOFT
        .connect(deployer)
        .setPeer(
          BASE_SEPOLIA_EID,
          addressToBytes32(deployments.baseSepolia.mockOFT)
        );
      console.log("✅ Optimism -> Base Sepolia peer set");
    }
  }

  // ============ Configure ProtocolCore and Authorize Vaults ============
  if (networkName === "arbitrumSepolia") {
    console.log("\n" + "=".repeat(60));
    console.log("STEP 2: Configuring ProtocolCore OApp Peers");
    console.log("=".repeat(60) + "\n");

    const ProtocolCore = await ethers.getContractFactory("ProtocolCore");
    const protocolCore = ProtocolCore.attach(
      deployments.arbitrumSepolia.protocolCore!
    );

    // Set peers for LenderVaults
    if (deployments.baseSepolia.lenderVault) {
      console.log("Setting ProtocolCore peer for Base Sepolia LenderVault...");
      await protocolCore
        .connect(deployer)
        .setPeer(
          BASE_SEPOLIA_EID,
          addressToBytes32(deployments.baseSepolia.lenderVault)
        );
      console.log("✅ Peer set");
    }

    if (deployments.optimismSepolia.lenderVault) {
      console.log("Setting ProtocolCore peer for Optimism LenderVault...");
      await protocolCore
        .connect(deployer)
        .setPeer(
          OPTIMISM_SEPOLIA_EID,
          addressToBytes32(deployments.optimismSepolia.lenderVault)
        );
      console.log("✅ Peer set");
    }

    // Set peers for CollateralVaults
    if (deployments.baseSepolia.collateralVault) {
      console.log("Setting ProtocolCore peer for Base Sepolia CollateralVault...");
      await protocolCore
        .connect(deployer)
        .setPeer(
          BASE_SEPOLIA_EID,
          addressToBytes32(deployments.baseSepolia.collateralVault)
        );
      console.log("✅ Peer set");
    }

    if (deployments.optimismSepolia.collateralVault) {
      console.log(
        "Setting ProtocolCore peer for Optimism CollateralVault..."
      );
      await protocolCore
        .connect(deployer)
        .setPeer(
          OPTIMISM_SEPOLIA_EID,
          addressToBytes32(deployments.optimismSepolia.collateralVault)
        );
      console.log("✅ Peer set");
    }

    console.log("\n" + "=".repeat(60));
    console.log("STEP 3: Authorizing Vaults in ProtocolCore");
    console.log("=".repeat(60) + "\n");

    // Authorize LenderVaults
    if (deployments.baseSepolia.lenderVault) {
      console.log("Authorizing Base Sepolia LenderVault...");
      await protocolCore
        .connect(deployer)
        .authorizeLenderVault(
          BASE_SEPOLIA_EID,
          addressToBytes32(deployments.baseSepolia.lenderVault)
        );
      console.log("✅ Authorized");
    }

    if (deployments.optimismSepolia.lenderVault) {
      console.log("Authorizing Optimism LenderVault...");
      await protocolCore
        .connect(deployer)
        .authorizeLenderVault(
          OPTIMISM_SEPOLIA_EID,
          addressToBytes32(deployments.optimismSepolia.lenderVault)
        );
      console.log("✅ Authorized");
    }

    // Authorize CollateralVaults
    if (deployments.baseSepolia.collateralVault) {
      console.log("Authorizing Base Sepolia CollateralVault...");
      await protocolCore
        .connect(deployer)
        .authorizeCollateralVault(
          BASE_SEPOLIA_EID,
          addressToBytes32(deployments.baseSepolia.collateralVault)
        );
      console.log("✅ Authorized");
    }

    if (deployments.optimismSepolia.collateralVault) {
      console.log("Authorizing Optimism CollateralVault...");
      await protocolCore
        .connect(deployer)
        .authorizeCollateralVault(
          OPTIMISM_SEPOLIA_EID,
          addressToBytes32(deployments.optimismSepolia.collateralVault)
        );
      console.log("✅ Authorized");
    }
  }

  // ============ Configure Vault Peers ============
  if (networkName === "baseSepolia") {
    console.log("\n" + "=".repeat(60));
    console.log("STEP 2: Configuring Base Sepolia Vault OApp Peers");
    console.log("=".repeat(60) + "\n");

    const LenderVault = await hre.ethers.getContractFactory("LenderVault");
    const CollateralVault = await hre.ethers.getContractFactory(
      "CollateralVault"
    );

    if (
      deployments.baseSepolia.lenderVault &&
      deployments.arbitrumSepolia.protocolCore
    ) {
      console.log("Setting Base Sepolia LenderVault peer for ProtocolCore...");
      const lenderVault = LenderVault.attach(
        deployments.baseSepolia.lenderVault
      );
      await lenderVault
        .connect(deployer)
        .setPeer(
          ARBITRUM_SEPOLIA_EID,
          addressToBytes32(deployments.arbitrumSepolia.protocolCore)
        );
      console.log("✅ Peer set");
    }

    if (
      deployments.baseSepolia.collateralVault &&
      deployments.arbitrumSepolia.protocolCore
    ) {
      console.log("Setting Base Sepolia CollateralVault peer for ProtocolCore...");
      const collateralVault = CollateralVault.attach(
        deployments.baseSepolia.collateralVault
      );
      await collateralVault
        .connect(deployer)
        .setPeer(
          ARBITRUM_SEPOLIA_EID,
          addressToBytes32(deployments.arbitrumSepolia.protocolCore)
        );
      console.log("✅ Peer set");
    }
  } else if (networkName === "optimismSepolia") {
    console.log("\n" + "=".repeat(60));
    console.log("STEP 2: Configuring Optimism Vault OApp Peers");
    console.log("=".repeat(60) + "\n");

    const LenderVault = await hre.ethers.getContractFactory("LenderVault");
    const CollateralVault = await hre.ethers.getContractFactory(
      "CollateralVault"
    );

    if (
      deployments.optimismSepolia.lenderVault &&
      deployments.arbitrumSepolia.protocolCore
    ) {
      console.log("Setting Optimism LenderVault peer for ProtocolCore...");
      const lenderVault = LenderVault.attach(
        deployments.optimismSepolia.lenderVault
      );
      await lenderVault
        .connect(deployer)
        .setPeer(
          ARBITRUM_SEPOLIA_EID,
          addressToBytes32(deployments.arbitrumSepolia.protocolCore)
        );
      console.log("✅ Peer set");
    }

    if (
      deployments.optimismSepolia.collateralVault &&
      deployments.arbitrumSepolia.protocolCore
    ) {
      console.log("Setting Optimism CollateralVault peer for ProtocolCore...");
      const collateralVault = CollateralVault.attach(
        deployments.optimismSepolia.collateralVault
      );
      await collateralVault
        .connect(deployer)
        .setPeer(
          ARBITRUM_SEPOLIA_EID,
          addressToBytes32(deployments.arbitrumSepolia.protocolCore)
        );
      console.log("✅ Peer set");
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ PEER CONFIGURATION COMPLETE");
  console.log("=".repeat(60) + "\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Configuration failed:");
    console.error(error);
    process.exit(1);
  });

