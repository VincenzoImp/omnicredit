import hre from "hardhat";

const { ethers } = hre as any;
import { Contract } from "ethers";
import { getAddress } from "./helpers.js";

import ProtocolCoreArtifact from "../../artifacts/contracts/base/ProtocolCore.sol/ProtocolCore.json" assert { type: "json" };

const MIN_WITHDRAW_SHARES = 5n * 10n ** 6n; // 5 shares (6 decimals since shares mirror USDC scale)

async function main() {

  const [signer] = await ethers.getSigners();
  const protocolAddress = getAddress("arbitrumSepolia", "protocolCore");
  const protocol = new Contract(
    protocolAddress,
    ProtocolCoreArtifact.abi,
    signer
  );

  const shares: bigint = await protocol.shares(signer.address);
  if (shares === 0n) {
    console.log("No shares to withdraw. Run the Base deposit example first.");
    return;
  }

  const shareAmount = shares < MIN_WITHDRAW_SHARES ? shares : MIN_WITHDRAW_SHARES;
  console.log(
    `Withdrawing using ${shareAmount.toString()} shares (out of ${shares.toString()})`
  );

  const tx = await protocol.withdraw(shareAmount);
  await tx.wait();
  console.log("Withdrawal complete. MockUSDC stays on Arbitrum.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


