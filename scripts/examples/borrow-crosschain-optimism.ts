import hre from "hardhat";

const { ethers } = hre as any;
import { Contract } from "ethers";
import { getAddress } from "./helpers.js";

import ProtocolCoreArtifact from "../../artifacts/contracts/base/ProtocolCore.sol/ProtocolCore.json" assert { type: "json" };

const BORROW_AMOUNT_USDC = "20";
const OPTIMISM_EID = 40232; // LayerZero endpoint ID for Optimism Sepolia

async function main() {

  const [signer] = await ethers.getSigners();
  const protocolAddress = getAddress("arbitrumSepolia", "protocolCore");
  const protocol = new Contract(
    protocolAddress,
    ProtocolCoreArtifact.abi,
    signer
  );

  const amount = ethers.parseUnits(BORROW_AMOUNT_USDC, 6);
  console.log(
    `Requesting to borrow ${BORROW_AMOUNT_USDC} MockUSDC to Optimism Sepolia`
  );

  console.log("Quoting cross-chain borrow fee...");
  const fee = await protocol.quoteBorrowCrossChain(
    amount,
    OPTIMISM_EID,
    amount
  );
  const nativeFee = fee.nativeFee ?? fee[0];
  console.log(`LayerZero fee: ${ethers.formatEther(nativeFee)} ETH`);

  const tx = await protocol.borrowCrossChain(
    amount,
    OPTIMISM_EID,
    amount,
    {
      value: nativeFee,
    }
  );
  console.log(`Borrow transaction sent: ${tx.hash}`);
  await tx.wait();
  console.log(
    "Borrow initiated. After finalization, MockUSDC will arrive on Optimism and you can verify with show-balances.ts on that network."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


