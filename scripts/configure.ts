import { ethers } from "hardhat";
import { getNetworkConfig, PYTH_PRICE_FEEDS, ASSET_DECIMALS, getCoordinatorEndpointId } from "./config/networks";
import { Contract } from "ethers";

/**
 * Post-Deployment Configuration Script
 *
 * This script handles all post-deployment configuration required to make
 * the OmniCredit protocol functional after contracts are deployed.
 *
 * Usage: npx hardhat run scripts/configure.ts --network <network-name>
 */

interface DeployedContracts {
  // Base chain contracts
  creditScore?: Contract;
  priceOracle?: Contract;
  feeBasedLimits?: Contract;
  protocolCore?: Contract;
  liquidationManager?: Contract;
  crossChainCoordinator?: Contract;
  liquidationHook?: Contract;

  // Satellite chain contracts
  collateralVault?: Contract;
  usdcOFTAdapter?: Contract;
  usdcOmnitoken?: Contract;
}

/**
 * Configure base chain contracts after deployment
 */
async function configureBaseChain(
  contracts: DeployedContracts,
  networkName: string
) {
  console.log("\n=== Configuring Base Chain Contracts ===\n");

  const config = getNetworkConfig(networkName);
  const [deployer] = await ethers.getSigners();

  // 1. Configure ContinuousCreditScore
  if (contracts.creditScore && contracts.protocolCore && contracts.liquidationManager) {
    console.log("Configuring ContinuousCreditScore...");

    // Authorize ProtocolCore to update scores
    const tx1 = await contracts.creditScore.setAuthorizedUpdater(
      await contracts.protocolCore.getAddress(),
      true
    );
    await tx1.wait();
    console.log("✓ Authorized ProtocolCore as score updater");

    // Authorize LiquidationManager to record liquidations
    const tx2 = await contracts.creditScore.setAuthorizedUpdater(
      await contracts.liquidationManager.getAddress(),
      true
    );
    await tx2.wait();
    console.log("✓ Authorized LiquidationManager as score updater");
  }

  // 2. Configure PriceOracle
  if (contracts.priceOracle) {
    console.log("\nConfiguring PriceOracle...");

    // Add price feeds for major assets
    for (const [pair, feedId] of Object.entries(PYTH_PRICE_FEEDS)) {
      console.log(`Adding price feed for ${pair}...`);

      // Determine asset address based on pair
      let assetAddress = ethers.ZeroAddress;
      if (pair === "ETH/USD") {
        // Use WETH address or native ETH placeholder
        assetAddress = config.deployed?.wethAddress || ethers.ZeroAddress;
      } else if (pair === "BTC/USD") {
        assetAddress = config.deployed?.wbtcAddress || ethers.ZeroAddress;
      } else if (pair === "USDC/USD") {
        assetAddress = config.usdcAddress || ethers.ZeroAddress;
      }

      if (assetAddress !== ethers.ZeroAddress) {
        const tx = await contracts.priceOracle.addPriceFeed(assetAddress, feedId);
        await tx.wait();
        console.log(`✓ Added ${pair} price feed`);
      }
    }

    // Set price validation parameters
    if (config.config?.maxPriceAge) {
      const tx = await contracts.priceOracle.setMaxPriceAge(config.config.maxPriceAge);
      await tx.wait();
      console.log(`✓ Set max price age to ${config.config.maxPriceAge} seconds`);
    }

    if (config.config?.maxConfidenceRatio) {
      const tx = await contracts.priceOracle.setMaxConfidenceRatio(config.config.maxConfidenceRatio);
      await tx.wait();
      console.log(`✓ Set max confidence ratio to ${config.config.maxConfidenceRatio} bps`);
    }
  }

  // 3. Configure ProtocolCore
  if (contracts.protocolCore && contracts.crossChainCoordinator && contracts.liquidationManager) {
    console.log("\nConfiguring ProtocolCore...");

    // Set CrossChainCoordinator
    const tx1 = await contracts.protocolCore.setCoordinator(
      await contracts.crossChainCoordinator.getAddress()
    );
    await tx1.wait();
    console.log("✓ Set CrossChainCoordinator address");

    // Set LiquidationManager
    const tx2 = await contracts.protocolCore.setLiquidationManager(
      await contracts.liquidationManager.getAddress()
    );
    await tx2.wait();
    console.log("✓ Set LiquidationManager address");

    // Set fee collector
    if (config.config?.feeCollector) {
      const tx3 = await contracts.protocolCore.setFeeCollector(config.config.feeCollector);
      await tx3.wait();
      console.log("✓ Set fee collector address");
    }
  }

  // 4. Configure LiquidationManager
  if (contracts.liquidationManager && contracts.protocolCore) {
    console.log("\nConfiguring LiquidationManager...");

    // Set lending pool reference
    const tx = await contracts.liquidationManager.setLendingPool(
      await contracts.protocolCore.getAddress()
    );
    await tx.wait();
    console.log("✓ Set lending pool address");

    // Configure Uniswap V4 pool if available
    if (config.poolManager && config.poolManager !== ethers.ZeroAddress) {
      // TODO: Set pool key when Uniswap V4 is deployed
      console.log("⚠ Uniswap V4 pool configuration pending (pool manager not yet available)");
    }
  }

  // 5. Configure CrossChainCoordinator
  if (contracts.crossChainCoordinator && contracts.protocolCore) {
    console.log("\nConfiguring CrossChainCoordinator...");

    // Set lending pool
    const tx1 = await contracts.crossChainCoordinator.setLendingPool(
      await contracts.protocolCore.getAddress()
    );
    await tx1.wait();
    console.log("✓ Set lending pool address");

    // Authorize ProtocolCore as sender
    const tx2 = await contracts.crossChainCoordinator.setAuthorizedSender(
      await contracts.protocolCore.getAddress(),
      true
    );
    await tx2.wait();
    console.log("✓ Authorized ProtocolCore as message sender");

    console.log("\n⚠ Note: CollateralVault addresses from satellite chains must be authorized manually");
    console.log("  Use: crossChainCoordinator.authorizeVault(chainEid, vaultAddress)");
  }

  console.log("\n✅ Base chain configuration complete!");
}

/**
 * Configure satellite chain contracts after deployment
 */
async function configureSatelliteChain(
  contracts: DeployedContracts,
  networkName: string
) {
  console.log("\n=== Configuring Satellite Chain Contracts ===\n");

  const config = getNetworkConfig(networkName);
  const [deployer] = await ethers.getSigners();

  // Configure CollateralVault
  if (contracts.collateralVault) {
    console.log("Configuring CollateralVault...");

    // Set coordinator endpoint ID
    const coordinatorEid = getCoordinatorEndpointId(config.isTestnet);
    if (coordinatorEid > 0) {
      const tx = await contracts.collateralVault.setCoordinatorEid(coordinatorEid);
      await tx.wait();
      console.log(`✓ Set coordinator endpoint ID to ${coordinatorEid}`);
    }

    // Configure asset decimals for common assets
    console.log("\nConfiguring asset decimals...");
    for (const [asset, decimals] of Object.entries(ASSET_DECIMALS)) {
      // Skip if no address is known for this asset
      const assetAddress = (config.deployed as any)?.[`${asset.toLowerCase()}Address`];
      if (assetAddress && assetAddress !== ethers.ZeroAddress) {
        const tx = await contracts.collateralVault.setAssetDecimals(assetAddress, decimals);
        await tx.wait();
        console.log(`✓ Set ${asset} decimals to ${decimals}`);
      }
    }

    // Set price oracle address (if available)
    if (contracts.priceOracle) {
      const tx = await contracts.collateralVault.setPriceOracle(
        await contracts.priceOracle.getAddress()
      );
      await tx.wait();
      console.log("✓ Set price oracle address");
    } else {
      console.log("⚠ Price oracle not available on this chain");
    }

    console.log("\n⚠ Note: This vault must be authorized on the Base chain CrossChainCoordinator");
    console.log(`  Vault address: ${await contracts.collateralVault.getAddress()}`);
    console.log(`  Chain endpoint ID: ${config.lzEndpointId}`);
  }

  // Configure USDCOFTAdapter (for Ethereum)
  if (contracts.usdcOFTAdapter) {
    console.log("\nConfiguring USDCOFTAdapter...");

    // Set trusted remotes for other chains
    console.log("⚠ Trusted remotes must be configured for cross-chain transfers");
    console.log("  Use: usdcOFTAdapter.setTrustedRemote(remoteEid, remotePath)");
  }

  // Configure USDCOmnitoken (for non-USDC chains)
  if (contracts.usdcOmnitoken) {
    console.log("\nConfiguring USDCOmnitoken...");

    // Set trusted remotes for other chains
    console.log("⚠ Trusted remotes must be configured for cross-chain transfers");
    console.log("  Use: usdcOmnitoken.setTrustedRemote(remoteEid, remotePath)");
  }

  console.log("\n✅ Satellite chain configuration complete!");
}

/**
 * Load deployed contracts from saved addresses file
 */
async function loadDeployedContracts(networkName: string): Promise<DeployedContracts> {
  const contracts: DeployedContracts = {};
  const fs = await import("fs");
  const path = await import("path");

  try {
    const addressesPath = path.join(process.cwd(), "deployments", `${networkName}-addresses.json`);
    
    if (!fs.existsSync(addressesPath)) {
      console.log("⚠ Deployment addresses file not found:", addressesPath);
      console.log("  Make sure contracts are deployed first.");
      console.log("  Run: npx hardhat run scripts/deploy-all.ts --network", networkName);
      return contracts;
    }

    const addressesData = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));

    // Load BaseProtocol contracts
    if (addressesData.BaseProtocol) {
      const addrs = addressesData.BaseProtocol;
      
      if (addrs.CreditScore) {
        contracts.creditScore = await ethers.getContractAt("ContinuousCreditScore", addrs.CreditScore);
      }
      if (addrs.PriceOracle) {
        contracts.priceOracle = await ethers.getContractAt("PriceOracle", addrs.PriceOracle);
      }
      if (addrs.FeeBasedLimits) {
        contracts.feeBasedLimits = await ethers.getContractAt("FeeBasedLimits", addrs.FeeBasedLimits);
      }
      if (addrs.ProtocolCore) {
        contracts.protocolCore = await ethers.getContractAt("ProtocolCore", addrs.ProtocolCore);
      }
      if (addrs.LiquidationManager) {
        contracts.liquidationManager = await ethers.getContractAt("LiquidationManager", addrs.LiquidationManager);
      }
      if (addrs.CrossChainCoordinator) {
        contracts.crossChainCoordinator = await ethers.getContractAt("CrossChainCoordinator", addrs.CrossChainCoordinator);
      }
      if (addrs.LiquidationHook) {
        contracts.liquidationHook = await ethers.getContractAt("LiquidationHook", addrs.LiquidationHook);
      }
    }

    // Load CrossChain contracts
    if (addressesData.CrossChain) {
      const addrs = addressesData.CrossChain;
      
      if (addrs.CollateralVault) {
        contracts.collateralVault = await ethers.getContractAt("CollateralVault", addrs.CollateralVault);
      }
      if (addrs.USDCOFTAdapter) {
        contracts.usdcOFTAdapter = await ethers.getContractAt("USDCOFTAdapter", addrs.USDCOFTAdapter);
      }
      if (addrs.USDCOmnitoken) {
        contracts.usdcOmnitoken = await ethers.getContractAt("USDCOmnitoken", addrs.USDCOmnitoken);
      }
    }
  } catch (error: any) {
    console.log("⚠ Could not load deployment addresses:", error.message);
    console.log("  Make sure contracts are deployed first.");
    console.log("  Run: npx hardhat run scripts/deploy-all.ts --network", networkName);
  }

  return contracts;
}

/**
 * Main configuration function
 */
async function main() {
  // Get network from Hardhat
  const hre = await import("hardhat");
  const network = await ethers.provider.getNetwork();
  const networkName = hre.network.name;

  console.log(`\n🔧 Configuring OmniCredit Protocol on ${networkName}`);
  console.log(`   Chain ID: ${network.chainId}`);

  // Load deployed contracts
  const contracts = await loadDeployedContracts(networkName);

  if (Object.keys(contracts).length === 0) {
    console.log("\n❌ No deployed contracts found. Deploy contracts first!");
    return;
  }

  // Determine if this is a base chain or satellite chain
  const config = getNetworkConfig(networkName);

  if (config.isBaseChain) {
    await configureBaseChain(contracts, networkName);
  } else {
    await configureSatelliteChain(contracts, networkName);
  }

  console.log("\n🎉 Configuration complete!");
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });