import { ethers } from "hardhat";
import { getNetworkConfig, getBaseChainConfig, NETWORKS } from "../config/networks";

/**
 * Cross-Chain Management Utilities
 *
 * Helper functions for managing cross-chain configurations,
 * vault authorizations, and LayerZero settings.
 */

/**
 * Authorize a CollateralVault on the CrossChainCoordinator
 */
export async function authorizeVault(
  coordinatorAddress: string,
  chainEid: number,
  vaultAddress: string
) {
  console.log(`\n🔐 Authorizing CollateralVault...`);
  console.log(`   Coordinator: ${coordinatorAddress}`);
  console.log(`   Chain EID: ${chainEid}`);
  console.log(`   Vault: ${vaultAddress}`);

  const coordinator = await ethers.getContractAt("CrossChainCoordinator", coordinatorAddress);

  // Check if already authorized
  const currentVault = await coordinator.authorizedVaults(chainEid);
  if (currentVault === vaultAddress) {
    console.log("   ✅ Vault already authorized!");
    return;
  }

  // Authorize the vault
  const tx = await coordinator.authorizeVault(chainEid, vaultAddress);
  console.log(`   Transaction: ${tx.hash}`);

  await tx.wait();
  console.log("   ✅ Vault authorized successfully!");
}

/**
 * Set up LayerZero trusted remotes between chains
 */
export async function setupTrustedRemotes(
  contractAddress: string,
  contractType: "CrossChainCoordinator" | "CollateralVault" | "USDCOFTAdapter" | "USDCOmnitoken",
  remoteChainName: string,
  remoteContractAddress: string
) {
  console.log(`\n🔗 Setting up trusted remote...`);
  console.log(`   Local contract: ${contractAddress}`);
  console.log(`   Remote chain: ${remoteChainName}`);
  console.log(`   Remote contract: ${remoteContractAddress}`);

  const remoteConfig = getNetworkConfig(remoteChainName);
  if (!remoteConfig.lzEndpointId) {
    throw new Error(`No endpoint ID configured for ${remoteChainName}`);
  }

  // Get the contract based on type
  const contract = await ethers.getContractAt(contractType, contractAddress);

  // Build the trusted remote path (remote address + local address)
  const path = ethers.solidityPacked(
    ["address", "address"],
    [remoteContractAddress, contractAddress]
  );

  // Set the trusted remote
  const tx = await contract.setTrustedRemote(remoteConfig.lzEndpointId, path);
  console.log(`   Transaction: ${tx.hash}`);

  await tx.wait();
  console.log("   ✅ Trusted remote configured!");
}

/**
 * Configure all vaults for a deployed CrossChainCoordinator
 */
export async function configureAllVaults(
  coordinatorAddress: string,
  vaultAddresses: { [chainName: string]: string }
) {
  console.log(`\n📝 Configuring all CollateralVaults...`);

  for (const [chainName, vaultAddress] of Object.entries(vaultAddresses)) {
    if (!vaultAddress || vaultAddress === ethers.ZeroAddress) continue;

    const config = getNetworkConfig(chainName);
    if (!config.lzEndpointId) {
      console.log(`   ⚠️  Skipping ${chainName} - no endpoint ID`);
      continue;
    }

    await authorizeVault(coordinatorAddress, config.lzEndpointId, vaultAddress);
  }

  console.log("\n✅ All vaults configured!");
}

/**
 * Set up complete cross-chain messaging for a network
 */
export async function setupCrossChainMessaging(
  localChainName: string,
  deployedAddresses: { [chainName: string]: any }
) {
  console.log(`\n🌐 Setting up cross-chain messaging for ${localChainName}...`);

  const localConfig = getNetworkConfig(localChainName);
  const localAddresses = deployedAddresses[localChainName];

  if (!localAddresses) {
    console.log("   ❌ No deployed contracts found for this chain");
    return;
  }

  // Set up trusted remotes for each contract type
  for (const [remoteChainName, remoteAddresses] of Object.entries(deployedAddresses)) {
    if (remoteChainName === localChainName) continue;
    if (!remoteAddresses) continue;

    console.log(`\n   Configuring remotes with ${remoteChainName}:`);

    // CrossChainCoordinator <-> CollateralVault
    if (localAddresses.crossChainCoordinator && remoteAddresses.collateralVault) {
      await setupTrustedRemotes(
        localAddresses.crossChainCoordinator,
        "CrossChainCoordinator",
        remoteChainName,
        remoteAddresses.collateralVault
      );
    }

    if (localAddresses.collateralVault && remoteAddresses.crossChainCoordinator) {
      await setupTrustedRemotes(
        localAddresses.collateralVault,
        "CollateralVault",
        remoteChainName,
        remoteAddresses.crossChainCoordinator
      );
    }

    // USDC OFT connections
    if (localAddresses.usdcOFTAdapter && remoteAddresses.usdcOmnitoken) {
      await setupTrustedRemotes(
        localAddresses.usdcOFTAdapter,
        "USDCOFTAdapter",
        remoteChainName,
        remoteAddresses.usdcOmnitoken
      );
    }

    if (localAddresses.usdcOmnitoken && remoteAddresses.usdcOFTAdapter) {
      await setupTrustedRemotes(
        localAddresses.usdcOmnitoken,
        "USDCOmnitoken",
        remoteChainName,
        remoteAddresses.usdcOFTAdapter
      );
    }

    // USDCOmnitoken <-> USDCOmnitoken
    if (localAddresses.usdcOmnitoken && remoteAddresses.usdcOmnitoken) {
      await setupTrustedRemotes(
        localAddresses.usdcOmnitoken,
        "USDCOmnitoken",
        remoteChainName,
        remoteAddresses.usdcOmnitoken
      );
    }
  }

  console.log(`\n✅ Cross-chain messaging configured for ${localChainName}!`);
}

/**
 * Get status of all authorized vaults
 */
export async function getVaultStatus(coordinatorAddress: string) {
  console.log(`\n📊 Vault Authorization Status`);
  console.log(`   Coordinator: ${coordinatorAddress}\n`);

  const coordinator = await ethers.getContractAt("CrossChainCoordinator", coordinatorAddress);

  // Check each configured network
  for (const [networkName, config] of Object.entries(NETWORKS)) {
    if (config.isBaseChain) continue;
    if (!config.lzEndpointId) continue;

    const authorizedVault = await coordinator.authorizedVaults(config.lzEndpointId);
    const isAuthorized = authorizedVault !== ethers.ZeroAddress;

    console.log(`   ${networkName} (EID ${config.lzEndpointId}):`);
    if (isAuthorized) {
      console.log(`     ✅ Authorized: ${authorizedVault}`);
    } else {
      console.log(`     ❌ Not authorized`);
    }
  }
}

/**
 * Batch configuration for post-deployment setup
 */
export async function batchCrossChainSetup(deploymentFile: string) {
  console.log(`\n🚀 Batch Cross-Chain Setup`);
  console.log(`   Loading deployments from: ${deploymentFile}`);

  try {
    const deployments = require(deploymentFile);

    // Find the base chain deployment
    let baseChainName: string | null = null;
    let coordinatorAddress: string | null = null;

    for (const [chainName, addresses] of Object.entries(deployments)) {
      if (addresses.crossChainCoordinator) {
        baseChainName = chainName;
        coordinatorAddress = addresses.crossChainCoordinator;
        break;
      }
    }

    if (!baseChainName || !coordinatorAddress) {
      throw new Error("No CrossChainCoordinator found in deployments");
    }

    console.log(`   Base chain: ${baseChainName}`);
    console.log(`   Coordinator: ${coordinatorAddress}`);

    // Authorize all vaults
    const vaults: { [chainName: string]: string } = {};
    for (const [chainName, addresses] of Object.entries(deployments)) {
      if (addresses.collateralVault) {
        vaults[chainName] = addresses.collateralVault;
      }
    }

    await configureAllVaults(coordinatorAddress, vaults);

    // Set up cross-chain messaging for each chain
    for (const chainName of Object.keys(deployments)) {
      await setupCrossChainMessaging(chainName, deployments);
    }

    console.log("\n🎉 Batch cross-chain setup complete!");

  } catch (error) {
    console.error("   ❌ Failed to load deployment file:", error);
    throw error;
  }
}

/**
 * Export functions for use in other scripts
 */
export default {
  authorizeVault,
  setupTrustedRemotes,
  configureAllVaults,
  setupCrossChainMessaging,
  getVaultStatus,
  batchCrossChainSetup
};