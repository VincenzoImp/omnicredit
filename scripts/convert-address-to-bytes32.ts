/**
 * Helper script to convert Ethereum address to bytes32 format
 * 
 * Usage:
 *   tsx scripts/convert-address-to-bytes32.ts <address>
 * 
 * Example:
 *   tsx scripts/convert-address-to-bytes32.ts 0x1234567890123456789012345678901234567890
 * 
 * Output:
 *   0x0000000000000000000000001234567890123456789012345678901234567890
 */

function addressToBytes32(address: string): string {
  if (!address.startsWith("0x")) {
    address = "0x" + address;
  }
  
  if (address.length !== 42) {
    throw new Error("Invalid address length");
  }
  
  return "0x" + address.slice(2).padStart(64, "0");
}

const address = process.argv[2];

if (!address) {
  console.error("Usage: tsx scripts/convert-address-to-bytes32.ts <address>");
  process.exit(1);
}

try {
  const bytes32 = addressToBytes32(address);
  console.log("\n📝 Address to bytes32 conversion:");
  console.log("Address:", address);
  console.log("Bytes32:", bytes32);
  console.log("\n💡 Copy this bytes32 value to your ignition/parameters/*.json file");
} catch (error: any) {
  console.error("❌ Error:", error.message);
  process.exit(1);
}

