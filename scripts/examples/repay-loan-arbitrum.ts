import hre from "hardhat";

const { ethers } = hre as any;
import { Contract } from "ethers";
import { getAddress } from "./helpers.js";

import ProtocolCoreArtifact from "../../artifacts/contracts/base/ProtocolCore.sol/ProtocolCore.json" assert { type: "json" };
import MockUSDCArtifact from "../../artifacts/contracts/mocks/MockUSDC.sol/MockUSDC.json" assert { type: "json" };

const REPAY_AMOUNT_USDC = "25";

async function main() {

  const [signer] = await ethers.getSigners();
  const protocolAddress = getAddress("arbitrumSepolia", "protocolCore");
  const mockAddress = getAddress("arbitrumSepolia", "mockUSDC");

  const protocol = new Contract(
    protocolAddress,
    ProtocolCoreArtifact.abi,
    signer
  );
  const mockUSDC = new Contract(
    mockAddress,
    MockUSDCArtifact.abi,
    signer
  );

  const amount = ethers.parseUnits(REPAY_AMOUNT_USDC, 6);
  const balance: bigint = await mockUSDC.balanceOf(signer.address);
  if (balance < amount) {
    console.log(
      `Minting ${REPAY_AMOUNT_USDC} MockUSDC so we can repay the loan...`
    );
    const mintTx = await mockUSDC.mintUSD(signer.address, Number(REPAY_AMOUNT_USDC));
    await mintTx.wait();
  }

  console.log("Approving ProtocolCore to pull MockUSDC...");
  const approveTx = await mockUSDC.approve(protocolAddress, amount);
  await approveTx.wait();

  console.log(`Repaying ${REPAY_AMOUNT_USDC} MockUSDC...`);
  const repayTx = await protocol.repay(amount);
  await repayTx.wait();
  console.log("Loan repayment complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


