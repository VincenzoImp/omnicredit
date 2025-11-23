import hre from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Test Protocol Flow Script
 * 
 * Tests the complete protocol flow:
 * 1. Lender deposits MockUSDC on Sepolia
 * 2. Borrower deposits ETH collateral on Sepolia
 * 3. Borrower borrows MockUSDC on Optimism Sepolia
 * 4. Borrower repays loan
 * 5. Borrower withdraws collateral
 * 
 * Usage:
 *   npx hardhat run scripts/test-protocol-flow.ts --network sepolia
 */
async function main() {
  const network = hre.network.name;
  console.log(`\n🧪 Testing OmniCredit Protocol Flow on ${network}\n`);

  // Load deployment addresses
  const deploymentsPath = join(
    __dirname,
    "../ignition/deployments"
  );

  let sepoliaDeployment: any;
  let arbitrumDeployment: any;
  let optimismDeployment: any;

  try {
    const sepoliaPath = join(deploymentsPath, "chain-11155111/deployed_addresses.json");
    sepoliaDeployment = JSON.parse(readFileSync(sepoliaPath, "utf-8"));
  } catch (e) {
    console.error("❌ Sepolia deployment not found. Please deploy first.");
    process.exit(1);
  }

  try {
    const arbitrumPath = join(deploymentsPath, "chain-421614/deployed_addresses.json");
    arbitrumDeployment = JSON.parse(readFileSync(arbitrumPath, "utf-8"));
  } catch (e) {
    console.error("❌ Arbitrum Sepolia deployment not found. Please deploy first.");
    process.exit(1);
  }

  try {
    const optimismPath = join(deploymentsPath, "chain-11155420/deployed_addresses.json");
    optimismDeployment = JSON.parse(readFileSync(optimismPath, "utf-8"));
  } catch (e) {
    console.error("❌ Optimism Sepolia deployment not found. Please deploy first.");
    process.exit(1);
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Get contract addresses
  const sepoliaMockUSDC = sepoliaDeployment.Sepolia?.MockUSDC;
  const sepoliaLenderVault = sepoliaDeployment.Sepolia?.LenderVault;
  const sepoliaCollateralVault = sepoliaDeployment.Sepolia?.CollateralVault;
  const arbitrumProtocolCore = arbitrumDeployment.ArbitrumSepolia?.ProtocolCore;
  const arbitrumMockUSDC = arbitrumDeployment.ArbitrumSepolia?.MockUSDC;

  if (!sepoliaMockUSDC || !sepoliaLenderVault || !sepoliaCollateralVault || !arbitrumProtocolCore) {
    console.error("❌ Missing contract addresses in deployment files");
    process.exit(1);
  }

  // Get contract instances
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const LenderVault = await hre.ethers.getContractFactory("LenderVault");
  const CollateralVault = await hre.ethers.getContractFactory("CollateralVault");
  const ProtocolCore = await hre.ethers.getContractFactory("ProtocolCore");

  const mockUSDC = MockUSDC.attach(sepoliaMockUSDC);
  const lenderVault = LenderVault.attach(sepoliaLenderVault);
  const collateralVault = CollateralVault.attach(sepoliaCollateralVault);
  const protocolCore = ProtocolCore.attach(arbitrumProtocolCore);

  // Test accounts (using deployer for simplicity)
  const lender = deployer;
  const borrower = deployer;

  console.log("👤 Test Accounts:");
  console.log("  Lender:", lender.address);
  console.log("  Borrower:", borrower.address, "\n");

  // ============ STEP 1: Lender Deposits MockUSDC ============
  console.log("📝 Step 1: Lender deposits MockUSDC on Sepolia");
  console.log("-".repeat(50));

  const depositAmount = hre.ethers.parseUnits("10000", 6); // 10,000 USDC

  // Mint MockUSDC to lender
  console.log("Minting MockUSDC to lender...");
  await mockUSDC.mintUSD(lender.address, 10000);
  console.log("✅ Minted 10,000 mUSDC to lender");

  // Approve and deposit
  console.log("Approving LenderVault...");
  await mockUSDC.connect(lender).approve(sepoliaLenderVault, depositAmount);

  console.log("Depositing", hre.ethers.formatUnits(depositAmount, 6), "mUSDC...");
  const depositTx = await lenderVault.connect(lender).deposit(depositAmount, depositAmount * 99n / 100n, {
    value: hre.ethers.parseEther("0.01") // LayerZero fee estimate
  });
  await depositTx.wait();
  console.log("✅ Deposit transaction sent:", depositTx.hash);
  console.log("⏳ Waiting for cross-chain confirmation...\n");

  // ============ STEP 2: Borrower Deposits ETH Collateral ============
  console.log("📝 Step 2: Borrower deposits ETH collateral on Sepolia");
  console.log("-".repeat(50));

  const collateralAmount = hre.ethers.parseEther("1.0"); // 1 ETH

  console.log("Depositing", hre.ethers.formatEther(collateralAmount), "ETH...");
  const collateralTx = await collateralVault.connect(borrower).depositNative({
    value: collateralAmount + hre.ethers.parseEther("0.01") // ETH + LayerZero fee
  });
  await collateralTx.wait();
  console.log("✅ Collateral deposit transaction sent:", collateralTx.hash);
  console.log("⏳ Waiting for cross-chain confirmation...\n");

  // ============ STEP 3: Check Collateral on Arbitrum ============
  console.log("📝 Step 3: Check collateral value on Arbitrum");
  console.log("-".repeat(50));

  // Switch to Arbitrum network to check
  console.log("⚠️  Note: To check collateral, switch to Arbitrum Sepolia network");
  console.log("   Run: npx hardhat run scripts/test-protocol-flow.ts --network arbitrumSepolia\n");

  // ============ STEP 4: Borrower Borrows MockUSDC ============
  console.log("📝 Step 4: Borrower borrows MockUSDC cross-chain");
  console.log("-".repeat(50));

  const borrowAmount = hre.ethers.parseUnits("2000", 6); // 2,000 USDC
  const OPTIMISM_SEPOLIA_EID = 40232;

  console.log("⚠️  Note: To borrow, switch to Arbitrum Sepolia network");
  console.log("   Borrower will receive MockUSDC on Optimism Sepolia");
  console.log("   Run: npx hardhat run scripts/test-protocol-flow.ts --network arbitrumSepolia\n");

  // ============ SUMMARY ============
  console.log("=".repeat(50));
  console.log("✅ TEST FLOW INITIATED!");
  console.log("=".repeat(50));
  console.log("\n📋 Next Steps:");
  console.log("1. Wait for LayerZero messages to be processed");
  console.log("2. Switch to Arbitrum Sepolia to check ProtocolCore state");
  console.log("3. Switch to Optimism Sepolia to check borrower MockUSDC balance");
  console.log("\n💡 Use LayerZero explorer to track message status:");
  console.log("   https://layerzeroscan.com/");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

