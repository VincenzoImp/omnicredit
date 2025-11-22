import { getNetworkConfig, validateNetworkConfig, getCoordinatorEndpointId } from "./config/networks";

/**
 * Complete Deployment Script
 *
 * This script handles the complete deployment process for OmniCredit protocol,
 * including both base chain and satellite chain deployments.
 *
 * Usage:
 *   Base chain: npx hardhat run scripts/deploy-all.ts --network baseSepolia
 *   Satellite: npx hardhat run scripts/deploy-all.ts --network sepolia
 */

async function deployBaseChain() {
  const hreModule = await import("hardhat");
  const hre = hreModule.default || hreModule;
  
  // Connect to network and get ethers
  const connection = await hre.network.connect();
  const { ethers } = connection;
  
  // Get network name from chain ID or environment
  let networkName: string | undefined;
  
  // Try to get from process.argv first (most reliable)
  const networkArgIndex = process.argv.indexOf("--network");
  if (networkArgIndex !== -1 && process.argv[networkArgIndex + 1]) {
    networkName = process.argv[networkArgIndex + 1];
  } else {
    // Fallback: use chain ID to determine network
    const network = await ethers.provider.getNetwork();
    const chainIdToName: { [key: number]: string } = {
      84532: "baseSepolia",
      11155111: "sepolia",
      31337: "hardhat"
    };
    networkName = chainIdToName[Number(network.chainId)];
  }
  
  if (!networkName) {
    throw new Error("Could not determine network name. Please specify --network flag.");
  }
  
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

  // Get all deployed addresses
  const addresses = {
    CreditScore: await result.creditScore.getAddress(),
    PriceOracle: await result.priceOracle.getAddress(),
    FeeBasedLimits: await result.feeBasedLimits.getAddress(),
    ProtocolCore: await result.protocolCore.getAddress(),
    LiquidationManager: await result.liquidationManager.getAddress(),
    CrossChainCoordinator: await result.crossChainCoordinator.getAddress(),
    ...(result.liquidationHook ? { LiquidationHook: await result.liquidationHook.getAddress() } : {})
  };

  // Display deployed addresses
  console.log("\n📋 Deployed Contract Addresses:");
  console.log("   CreditScore:", addresses.CreditScore);
  console.log("   PriceOracle:", addresses.PriceOracle);
  console.log("   FeeBasedLimits:", addresses.FeeBasedLimits);
  console.log("   ProtocolCore:", addresses.ProtocolCore);
  console.log("   LiquidationManager:", addresses.LiquidationManager);
  console.log("   CrossChainCoordinator:", addresses.CrossChainCoordinator);

  if (addresses.LiquidationHook) {
    console.log("   LiquidationHook:", addresses.LiquidationHook);
  }

  // Save addresses to file for configure/verify scripts
  const fs = await import("fs");
  const path = await import("path");
  const addressesPath = path.join(process.cwd(), "deployments", `${networkName}-addresses.json`);
  const deploymentsDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(addressesPath, JSON.stringify({ BaseProtocol: addresses }, null, 2));
  console.log(`\n💾 Saved addresses to ${addressesPath}`);

  // Run configuration
  console.log("\n=== Phase 2: Configuring Contracts ===\n");
  console.log("Running configuration script...");

  // Import and run configure script
  const { execSync } = await import("child_process");
  try {
    execSync(`npx hardhat run scripts/configure.ts --network ${networkName}`, {
      stdio: "inherit"
    });
  } catch (error) {
    console.log("⚠️  Configuration script encountered issues, but continuing...");
    console.log("   You can run it manually later: npx hardhat run scripts/configure.ts --network", networkName);
  }

  // Run verification
  console.log("\n=== Phase 3: Verifying Deployment ===\n");
  console.log("Running verification script...");

  try {
    execSync(`npx hardhat run scripts/verify.ts --network ${networkName}`, {
      stdio: "inherit"
    });
  } catch (error) {
    console.log("⚠️  Verification script encountered issues, but continuing...");
    console.log("   You can run it manually later: npx hardhat run scripts/verify.ts --network", networkName);
  }

  console.log("\n🎉 Base chain deployment complete!");
  console.log("\n📝 Next steps:");
  console.log("1. Deploy CollateralVault contracts on satellite chains");
  console.log("2. Authorize vaults in CrossChainCoordinator");
  console.log("3. Configure LayerZero trusted remotes");
  console.log("4. Set up Uniswap V4 pool when available");
}

async function deploySatelliteChain() {
  const hreModule = await import("hardhat");
  const hre = hreModule.default || hreModule;
  
  // Connect to network and get ethers
  const connection = await hre.network.connect();
  const { ethers } = connection;
  
  // Get network name from chain ID or environment
  let networkName: string | undefined;
  
  // Try to get from process.argv first (most reliable)
  const networkArgIndex = process.argv.indexOf("--network");
  if (networkArgIndex !== -1 && process.argv[networkArgIndex + 1]) {
    networkName = process.argv[networkArgIndex + 1];
  } else {
    // Fallback: use chain ID to determine network
    const network = await ethers.provider.getNetwork();
    const chainIdToName: { [key: number]: string } = {
      84532: "baseSepolia",
      11155111: "sepolia",
      31337: "hardhat"
    };
    networkName = chainIdToName[Number(network.chainId)];
  }
  
  if (!networkName) {
    throw new Error("Could not determine network name. Please specify --network flag.");
  }
  
  const config = getNetworkConfig(networkName);

  console.log("\n🚀 Deploying OmniCredit Contracts to Satellite Chain");
  console.log(`   Network: ${networkName}`);
  console.log(`   Chain ID: ${config.chainId}\n`);

  // Determine chain type
  let chainType = "satellite";
  if (networkName === "sepolia") {
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

  // Get all deployed addresses
  const addresses: any = {};
  if (result.collateralVault) {
    addresses.CollateralVault = await result.collateralVault.getAddress();
  }
  if (result.usdcOFTAdapter) {
    addresses.USDCOFTAdapter = await result.usdcOFTAdapter.getAddress();
  }
  if (result.usdcOmnitoken) {
    addresses.USDCOmnitoken = await result.usdcOmnitoken.getAddress();
  }

  // Display deployed addresses
  console.log("\n📋 Deployed Contract Addresses:");
  if (addresses.CollateralVault) {
    console.log("   CollateralVault:", addresses.CollateralVault);
  }
  if (addresses.USDCOFTAdapter) {
    console.log("   USDCOFTAdapter:", addresses.USDCOFTAdapter);
  }
  if (addresses.USDCOmnitoken) {
    console.log("   USDCOmnitoken:", addresses.USDCOmnitoken);
  }

  // Save addresses to file for configure/verify scripts
  const fs = await import("fs");
  const path = await import("path");
  const addressesPath = path.join(process.cwd(), "deployments", `${networkName}-addresses.json`);
  const deploymentsDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(addressesPath, JSON.stringify({ CrossChain: addresses }, null, 2));
  console.log(`\n💾 Saved addresses to ${addressesPath}`);

  // Run configuration
  console.log("\n=== Configuring Contracts ===\n");
  console.log("Running configuration script...");

  // Import and run configure script
  const { execSync } = await import("child_process");
  try {
    execSync(`npx hardhat run scripts/configure.ts --network ${networkName}`, {
      stdio: "inherit"
    });
  } catch (error) {
    console.log("⚠️  Configuration script encountered issues, but continuing...");
    console.log("   You can run it manually later: npx hardhat run scripts/configure.ts --network", networkName);
  }

  // Run verification
  console.log("\n=== Verifying Deployment ===\n");
  console.log("Running verification script...");

  try {
    execSync(`npx hardhat run scripts/verify.ts --network ${networkName}`, {
      stdio: "inherit"
    });
  } catch (error) {
    console.log("⚠️  Verification script encountered issues, but continuing...");
    console.log("   You can run it manually later: npx hardhat run scripts/verify.ts --network", networkName);
  }

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
  const hreModule = await import("hardhat");
  const hre = hreModule.default || hreModule;
  
  // Connect to network and get ethers
  const connection = await hre.network.connect();
  const { ethers } = connection;
  
  // Get network name from chain ID or environment
  let networkName: string | undefined;
  
  // Try to get from process.argv first (most reliable)
  const networkArgIndex = process.argv.indexOf("--network");
  if (networkArgIndex !== -1 && process.argv[networkArgIndex + 1]) {
    networkName = process.argv[networkArgIndex + 1];
  } else {
    // Fallback: use chain ID to determine network
    const network = await ethers.provider.getNetwork();
    const chainIdToName: { [key: number]: string } = {
      84532: "baseSepolia",
      11155111: "sepolia",
      31337: "hardhat"
    };
    networkName = chainIdToName[Number(network.chainId)];
  }
  
  if (!networkName) {
    throw new Error("Could not determine network name. Please specify --network flag.");
  }
  
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