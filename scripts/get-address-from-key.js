/**
 * Quick script to get address from private key
 * Usage: node scripts/get-address-from-key.js
 */

import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
  console.error("❌ PRIVATE_KEY not found in .env file");
  process.exit(1);
}

try {
  const wallet = new ethers.Wallet(privateKey);
  console.log("\n📋 Your Deployer Address:");
  console.log(`   ${wallet.address}\n`);
  console.log("💡 Copy this address and replace the zero addresses in:");
  console.log("   - ignition/parameters/arbitrumSepolia.json (for lzDelegate and feeCollector)");
  console.log("   - ignition/parameters/sepolia.json (for lzDelegate)\n");
} catch (error) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}

