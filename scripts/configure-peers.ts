import hre from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Configure LayerZero Peers Script
 * 
 * This script configures LayerZero peers between all deployed contracts.
 * Run this after deploying all contracts on all chains.
 * 
 * Usage:
 *   npx hardhat run scripts/configure-peers.ts --network arbitrumSepolia
 */
async function main() {
  const network = hre.network.name;
  console.log(`\n🔗 Configuring LayerZero peers on ${network}\n`);

  // Chain endpoint IDs
  const ARBITRUM_SEPOLIA_EID = 40231;
  const SEPOLIA_EID = 40161;
  const OPTIMISM_SEPOLIA_EID = 40232;

  // Load deployment addresses
  const deploymentsPath = join(
    __dirname,
    "../ignition/deployments",
    `chain-${hre.network.config.chainId}`
  );

  let arbitrumDeployment: any;
  let sepoliaDeployment: any;
  let optimismDeployment: any;

  try {
    // Load Arbitrum Sepolia deployment
    const arbitrumPath = join(
      __dirname,
      "../ignition/deployments/chain-421614/deployed_addresses.json"
    );
    arbitrumDeployment = JSON.parse(readFileSync(arbitrumPath, "utf-8"));
  } catch (e) {
    console.log("⚠️  Arbitrum Sepolia deployment not found");
  }

  try {
    // Load Sepolia deployment
    const sepoliaPath = join(
      __dirname,
      "../ignition/deployments/chain-11155111/deployed_addresses.json"
    );
    sepoliaDeployment = JSON.parse(readFileSync(sepoliaPath, "utf-8"));
  } catch (e) {
    console.log("⚠️  Sepolia deployment not found");
  }

  try {
    // Load Optimism Sepolia deployment
    const optimismPath = join(
      __dirname,
      "../ignition/deployments/chain-11155420/deployed_addresses.json"
    );
    optimismDeployment = JSON.parse(readFileSync(optimismPath, "utf-8"));
  } catch (e) {
    console.log("⚠️  Optimism Sepolia deployment not found");
  }

  // Helper function to convert address to bytes32
  const addressToBytes32 = (address: string): string => {
    return "0x" + address.slice(2).padStart(64, "0");
  };

  // Configure peers on Arbitrum Sepolia
  if (network === "arbitrumSepolia" && arbitrumDeployment && sepoliaDeployment && optimismDeployment) {
    const protocolCore = await hre.ethers.getContractAt(
      "ProtocolCore",
      arbitrumDeployment.ArbitrumSepolia.ProtocolCore
    );
    const arbitrumMockOFT = await hre.ethers.getContractAt(
      "MockOFT",
      arbitrumDeployment.ArbitrumSepolia.MockOFT
    );

    console.log("📝 Configuring MockOFT peers...");
    
    // Arbitrum ↔ Sepolia
    if (sepoliaDeployment.Sepolia?.MockOFT) {
      const sepoliaMockOFT = addressToBytes32(sepoliaDeployment.Sepolia.MockOFT);
      await arbitrumMockOFT.setPeer(SEPOLIA_EID, sepoliaMockOFT);
      console.log("✅ Arbitrum ↔ Sepolia MockOFT peer configured");
    }

    // Arbitrum ↔ Optimism
    if (optimismDeployment.OptimismSepolia?.MockOFT) {
      const optimismMockOFT = addressToBytes32(optimismDeployment.OptimismSepolia.MockOFT);
      await arbitrumMockOFT.setPeer(OPTIMISM_SEPOLIA_EID, optimismMockOFT);
      console.log("✅ Arbitrum ↔ Optimism MockOFT peer configured");
    }

    console.log("\n📝 Authorizing vaults in ProtocolCore...");

    // Authorize LenderVaults
    if (sepoliaDeployment.Sepolia?.LenderVault) {
      const sepoliaLenderVault = addressToBytes32(sepoliaDeployment.Sepolia.LenderVault);
      await protocolCore.authorizeLenderVault(SEPOLIA_EID, sepoliaLenderVault);
      console.log("✅ Sepolia LenderVault authorized");
    }

    if (optimismDeployment.OptimismSepolia?.LenderVault) {
      const optimismLenderVault = addressToBytes32(optimismDeployment.OptimismSepolia.LenderVault);
      await protocolCore.authorizeLenderVault(OPTIMISM_SEPOLIA_EID, optimismLenderVault);
      console.log("✅ Optimism LenderVault authorized");
    }

    // Authorize CollateralVaults
    if (sepoliaDeployment.Sepolia?.CollateralVault) {
      const sepoliaCollateralVault = addressToBytes32(sepoliaDeployment.Sepolia.CollateralVault);
      await protocolCore.authorizeCollateralVault(SEPOLIA_EID, sepoliaCollateralVault);
      console.log("✅ Sepolia CollateralVault authorized");
    }

    if (optimismDeployment.OptimismSepolia?.CollateralVault) {
      const optimismCollateralVault = addressToBytes32(optimismDeployment.OptimismSepolia.CollateralVault);
      await protocolCore.authorizeCollateralVault(OPTIMISM_SEPOLIA_EID, optimismCollateralVault);
      console.log("✅ Optimism CollateralVault authorized");
    }
  }

  // Configure peers on Sepolia
  if (network === "sepolia" && sepoliaDeployment && arbitrumDeployment && optimismDeployment) {
    const sepoliaMockOFT = await hre.ethers.getContractAt(
      "MockOFT",
      sepoliaDeployment.Sepolia.MockOFT
    );
    const lenderVault = await hre.ethers.getContractAt(
      "LenderVault",
      sepoliaDeployment.Sepolia.LenderVault
    );
    const collateralVault = await hre.ethers.getContractAt(
      "CollateralVault",
      sepoliaDeployment.Sepolia.CollateralVault
    );

    console.log("📝 Configuring MockOFT peers...");

    // Sepolia ↔ Arbitrum
    if (arbitrumDeployment.ArbitrumSepolia?.MockOFT) {
      const arbitrumMockOFT = addressToBytes32(arbitrumDeployment.ArbitrumSepolia.MockOFT);
      await sepoliaMockOFT.setPeer(ARBITRUM_SEPOLIA_EID, arbitrumMockOFT);
      console.log("✅ Sepolia ↔ Arbitrum MockOFT peer configured");
    }

    // Sepolia ↔ Optimism
    if (optimismDeployment.OptimismSepolia?.MockOFT) {
      const optimismMockOFT = addressToBytes32(optimismDeployment.OptimismSepolia.MockOFT);
      await sepoliaMockOFT.setPeer(OPTIMISM_SEPOLIA_EID, optimismMockOFT);
      console.log("✅ Sepolia ↔ Optimism MockOFT peer configured");
    }

    console.log("\n📝 Configuring vault peers...");

    // Configure LenderVault
    if (arbitrumDeployment.ArbitrumSepolia?.ProtocolCore) {
      const protocolCore = addressToBytes32(arbitrumDeployment.ArbitrumSepolia.ProtocolCore);
      await lenderVault.setProtocolCore(protocolCore, ARBITRUM_SEPOLIA_EID);
      console.log("✅ LenderVault ProtocolCore peer configured");
    }

    // Configure CollateralVault
    if (arbitrumDeployment.ArbitrumSepolia?.ProtocolCore) {
      const protocolCore = addressToBytes32(arbitrumDeployment.ArbitrumSepolia.ProtocolCore);
      await collateralVault.setProtocolCore(protocolCore, ARBITRUM_SEPOLIA_EID);
      console.log("✅ CollateralVault ProtocolCore peer configured");
    }
  }

  // Configure peers on Optimism Sepolia
  if (network === "optimismSepolia" && optimismDeployment && arbitrumDeployment && sepoliaDeployment) {
    const optimismMockOFT = await hre.ethers.getContractAt(
      "MockOFT",
      optimismDeployment.OptimismSepolia.MockOFT
    );
    const lenderVault = await hre.ethers.getContractAt(
      "LenderVault",
      optimismDeployment.OptimismSepolia.LenderVault
    );
    const collateralVault = await hre.ethers.getContractAt(
      "CollateralVault",
      optimismDeployment.OptimismSepolia.CollateralVault
    );

    console.log("📝 Configuring MockOFT peers...");

    // Optimism ↔ Arbitrum
    if (arbitrumDeployment.ArbitrumSepolia?.MockOFT) {
      const arbitrumMockOFT = addressToBytes32(arbitrumDeployment.ArbitrumSepolia.MockOFT);
      await optimismMockOFT.setPeer(ARBITRUM_SEPOLIA_EID, arbitrumMockOFT);
      console.log("✅ Optimism ↔ Arbitrum MockOFT peer configured");
    }

    // Optimism ↔ Sepolia
    if (sepoliaDeployment.Sepolia?.MockOFT) {
      const sepoliaMockOFT = addressToBytes32(sepoliaDeployment.Sepolia.MockOFT);
      await optimismMockOFT.setPeer(SEPOLIA_EID, sepoliaMockOFT);
      console.log("✅ Optimism ↔ Sepolia MockOFT peer configured");
    }

    console.log("\n📝 Configuring vault peers...");

    // Configure LenderVault
    if (arbitrumDeployment.ArbitrumSepolia?.ProtocolCore) {
      const protocolCore = addressToBytes32(arbitrumDeployment.ArbitrumSepolia.ProtocolCore);
      await lenderVault.setProtocolCore(protocolCore, ARBITRUM_SEPOLIA_EID);
      console.log("✅ LenderVault ProtocolCore peer configured");
    }

    // Configure CollateralVault
    if (arbitrumDeployment.ArbitrumSepolia?.ProtocolCore) {
      const protocolCore = addressToBytes32(arbitrumDeployment.ArbitrumSepolia.ProtocolCore);
      await collateralVault.setProtocolCore(protocolCore, ARBITRUM_SEPOLIA_EID);
      console.log("✅ CollateralVault ProtocolCore peer configured");
    }
  }

  console.log("\n✅ Peer configuration complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

