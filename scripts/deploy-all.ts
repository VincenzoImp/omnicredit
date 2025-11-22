import { ethers } from "hardhat";
import hre from "hardhat";
import { getNetworkConfig, validateNetworkConfig, getCoordinatorEndpointId } from "./config/networks";

/**
 * Complete Deployment Script
 *
 * This script handles the complete deployment process for OmniCredit protocol,
 * including both base chain and satellite chain deployments.
 *
 * Usage:
 *   Base chain: npx hardhat run scripts/deploy-all.ts --network baseSepolia
 *   Satellite: npx hardhat run scripts/deploy-all.ts --network arbitrumSepolia
 */

async function deployBaseChain() {
  const networkName = hre.network.name;
  const config = getNetworkConfig(networkName);

  console.log("\n🚀 Deploying OmniCredit Protocol to Base Chain");
  console.log(`   Network: ${networkName}`);
  console.log(`   Chain ID: ${config.chainId}\n`);

  // Validate configuration
  const errors = validateNetworkConfig(networkName);
  if (errors.length > 0) {
    console.log("❌ Configuration errors found:");
    errors.forEach(e => console.log(`   - ${e}`));
    console.log("\nPlease update scripts/config/networks.ts with the required values.");
    process.exit(1);
  }

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📦 Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("   Balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy using Hardhat Ignition
  console.log("=== Phase 1: Deploying Contracts ===\n");

  const result = await hre.ignition.deploy("BaseProtocol", {
    parameters: {
      BaseProtocol: {
        pythAddress: config.pythAddress,
        usdcAddress: config.usdcAddress,
        lzEndpoint: config.lzEndpoint,
        lzDelegate: deployer.address, // Use deployer as delegate initially
        poolManager: config.poolManager || ethers.ZeroAddress,
        feeCollector: config.config?.feeCollector || deployer.address
      }
    }
  });

  console.log("\n✅ Base protocol contracts deployed!");

  // Display deployed addresses
  console.log("\n📋 Deployed Contract Addresses:");
  console.log("   CreditScore:", await result.creditScore.getAddress());
  console.log("   PriceOracle:", await result.priceOracle.getAddress());
  console.log("   FeeBasedLimits:", await result.feeBasedLimits.getAddress());
  console.log("   ProtocolCore:", await result.protocolCore.getAddress());
  console.log("   LiquidationManager:", await result.liquidationManager.getAddress());
  console.log("   CrossChainCoordinator:", await result.crossChainCoordinator.getAddress());

  if (result.liquidationHook) {
    console.log("   LiquidationHook:", await result.liquidationHook.getAddress());
  }

  // Run configuration
  console.log("\n=== Phase 2: Configuring Contracts ===\n");
  console.log("Running configuration script...");

  await hre.run("run", {
    script: "scripts/configure.ts"
  });

  // Run verification
  console.log("\n=== Phase 3: Verifying Deployment ===\n");
  console.log("Running verification script...");

  await hre.run("run", {
    script: "scripts/verify.ts"
  });

  console.log("\n🎉 Base chain deployment complete!");
  console.log("\n📝 Next steps:");
  console.log("1. Deploy CollateralVault contracts on satellite chains");
  console.log("2. Authorize vaults in CrossChainCoordinator");
  console.log("3. Configure LayerZero trusted remotes");
  console.log("4. Set up Uniswap V4 pool when available");
}

async function deploySatelliteChain() {
  const networkName = hre.network.name;
  const config = getNetworkConfig(networkName);

  console.log("\n🚀 Deploying OmniCredit Contracts to Satellite Chain");
  console.log(`   Network: ${networkName}`);
  console.log(`   Chain ID: ${config.chainId}\n`);

  // Determine chain type
  let chainType = "satellite";
  if (networkName === "sepolia" || networkName === "mainnet") {
    chainType = "ethereum";
  } else if (!config.usdcAddress || config.usdcAddress === ethers.ZeroAddress) {
    chainType = "non-usdc";
  }

  console.log(`   Chain Type: ${chainType}`);

  // Validate configuration
  const errors = validateNetworkConfig(networkName);
  if (errors.length > 0) {
    console.log("\n❌ Configuration errors found:");
    errors.forEach(e => console.log(`   - ${e}`));
    console.log("\nPlease update scripts/config/networks.ts with the required values.");
    process.exit(1);
  }

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("\n📦 Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("   Balance:", ethers.formatEther(balance), "ETH\n");

  // Get coordinator endpoint ID
  const coordinatorEid = getCoordinatorEndpointId(config.isTestnet);
  console.log(`   Coordinator Endpoint ID: ${coordinatorEid}`);

  // Deploy using Hardhat Ignition
  console.log("\n=== Deploying Contracts ===\n");

  const result = await hre.ignition.deploy("CrossChain", {
    parameters: {
      CrossChain: {
        chainType: chainType,
        lzEndpoint: config.lzEndpoint,
        lzDelegate: deployer.address,
        coordinatorEid: coordinatorEid,
        usdcAddress: config.usdcAddress || ethers.ZeroAddress
      }
    }
  });

  console.log("\n✅ Satellite chain contracts deployed!");

  // Display deployed addresses
  console.log("\n📋 Deployed Contract Addresses:");
  if (result.collateralVault) {
    console.log("   CollateralVault:", await result.collateralVault.getAddress());
  }
  if (result.usdcOFTAdapter) {
    console.log("   USDCOFTAdapter:", await result.usdcOFTAdapter.getAddress());
  }
  if (result.usdcOmnitoken) {
    console.log("   USDCOmnitoken:", await result.usdcOmnitoken.getAddress());
  }

  // Run configuration
  console.log("\n=== Configuring Contracts ===\n");
  console.log("Running configuration script...");

  await hre.run("run", {
    script: "scripts/configure.ts"
  });

  // Run verification
  console.log("\n=== Verifying Deployment ===\n");
  console.log("Running verification script...");

  await hre.run("run", {
    script: "scripts/verify.ts"
  });

  console.log("\n🎉 Satellite chain deployment complete!");

  if (result.collateralVault) {
    const vaultAddress = await result.collateralVault.getAddress();
    console.log("\n📝 Next steps:");
    console.log("1. Authorize this vault on the Base chain CrossChainCoordinator:");
    console.log(`   coordinator.authorizeVault(${config.lzEndpointId}, "${vaultAddress}")`);
    console.log("2. Configure LayerZero trusted remotes between chains");
    console.log("3. Set asset decimals for supported collateral types");
  }
}

async function main() {
  const networkName = hre.network.name;
  const config = getNetworkConfig(networkName);

  if (config.isBaseChain) {
    await deployBaseChain();
  } else {
    await deploySatelliteChain();
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed!");
    console.error(error);
    process.exit(1);
  });