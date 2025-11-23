/**
 * Helper script to get the deployer address for updating parameter files
 * 
 * Usage: npx hardhat run scripts/get-deployer-address.ts --network <network>
 */

async function main() {
  const hreModule = await import("hardhat");
  const hre = hreModule.default || hreModule;
  
  // Connect to network
  const connection = await hre.network.connect();
  
  // Access ethers from connection
  if (!connection.ethers) {
    throw new Error("ethers not available. Make sure @nomicfoundation/hardhat-ethers is installed.");
  }
  
  const ethers = connection.ethers;
  
  // Get deployer
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("No signers found. Make sure PRIVATE_KEY is set in .env file");
  }
  
  const deployer = signers[0];
  const network = await ethers.provider.getNetwork();
  
  console.log("\n📋 Deployer Information:");
  console.log(`   Address: ${deployer.address}`);
  console.log(`   Network: ${network.name || network.chainId}`);
  console.log(`   Chain ID: ${network.chainId}`);
  console.log(`\n💡 Copy this address and replace 'REPLACE_WITH_YOUR_DEPLOYER_ADDRESS' in:`);
  console.log(`   - ignition/parameters/arbitrumSepolia.json (for lzDelegate and feeCollector)`);
  console.log(`   - ignition/parameters/sepolia.json (for lzDelegate)`);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

