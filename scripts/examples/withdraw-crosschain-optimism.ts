import hre from "hardhat";

const { ethers } = hre as any;
import { Contract } from "ethers";
import { getAddress } from "./helpers.js";

import ProtocolCoreArtifact from "../../artifacts/contracts/base/ProtocolCore.sol/ProtocolCore.json" assert { type: "json" };

const WITHDRAW_SHARES = 5n * 10n ** 6n; // 5 shares -> roughly 5 MockUSDC
const OPTIMISM_EID = 40232;

async function main() {

  const [signer] = await ethers.getSigners();
  const protocolAddress = getAddress("arbitrumSepolia", "protocolCore");
  const protocol = new Contract(
    protocolAddress,
    ProtocolCoreArtifact.abi,
    signer
  );

  const shares: bigint = await protocol.shares(signer.address);
  if (shares < WITHDRAW_SHARES) {
    console.log(
      "Not enough shares for the example cross-chain withdrawal. Deposit more first."
    );
    return;
  }

  const poolValue: bigint =
    (await protocol.totalDeposits()) + (await protocol.totalBorrowed());
  const totalShares: bigint = await protocol.totalShares();
  const estimatedAmount = (WITHDRAW_SHARES * poolValue) / totalShares;

  console.log(
    `Withdrawing ${WITHDRAW_SHARES.toString()} shares cross-chain (≈ ${ethers.formatUnits(
      estimatedAmount,
      6
    )} MockUSDC)`
  );

  console.log("Estimating LayerZero fee...");
  const fee = await protocol.quoteBorrowCrossChain(
    estimatedAmount,
    OPTIMISM_EID,
    estimatedAmount
  );
  const nativeFee = fee.nativeFee ?? fee[0];
  console.log(`LayerZero fee: ${ethers.formatEther(nativeFee)} ETH`);

  const tx = await protocol.withdrawCrossChain(
    WITHDRAW_SHARES,
    OPTIMISM_EID,
    estimatedAmount,
    { value: nativeFee }
  );
  await tx.wait();
  console.log(
    "Shares burned; MockUSDC will arrive on Optimism once the message finalizes."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


