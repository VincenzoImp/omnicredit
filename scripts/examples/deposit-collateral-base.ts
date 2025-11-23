import hre from "hardhat";

const { ethers } = hre as any;
import { Contract } from "ethers";
import { getAddress } from "./helpers.js";

import CollateralVaultArtifact from "../../artifacts/contracts/cross-chain/CollateralVault.sol/CollateralVault.json" assert { type: "json" };

const COLLATERAL_AMOUNT_ETH = "0.0001";

async function main() {

  const [signer] = await ethers.getSigners();
  const vaultAddress = getAddress("baseSepolia", "collateralVault");
  const vault = new Contract(
    vaultAddress,
    CollateralVaultArtifact.abi,
    signer
  );

  const amountWei = ethers.parseEther(COLLATERAL_AMOUNT_ETH);
  console.log(
    `Depositing ${COLLATERAL_AMOUNT_ETH} ETH as collateral from ${signer.address}`
  );

  const tx = await vault.depositNative({
    value: amountWei,
  });

  console.log(`Waiting for deposit tx ${tx.hash}...`);
  await tx.wait();
  console.log(
    "Collateral deposited. Wait for the cross-chain message (Base → Arbitrum) before borrowing."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


