import hre from "hardhat";

const { ethers } = hre as any;
import { Contract } from "ethers";
import { getAddress } from "./helpers.js";

import MockUSDCArtifact from "../../artifacts/contracts/mocks/MockUSDC.sol/MockUSDC.json" assert { type: "json" };
import LenderVaultArtifact from "../../artifacts/contracts/cross-chain/LenderVault.sol/LenderVault.json" assert { type: "json" };

const DEPOSIT_AMOUNT_USDC = "25"; // 25 MockUSDC (6 decimals)

async function main() {
    const [signer] = await ethers.getSigners();

    const mockAddress = getAddress("baseSepolia", "mockUSDC");
    const vaultAddress = getAddress("baseSepolia", "lenderVault");

    const mockUSDC = new Contract(mockAddress, MockUSDCArtifact.abi, signer);
    const lenderVault = new Contract(
        vaultAddress,
        LenderVaultArtifact.abi,
        signer
    );

    const amount = ethers.parseUnits(DEPOSIT_AMOUNT_USDC, 6);

    // Mint tokens if balance is low (MockUSDC has open mint for dev purposes)
    const currentBalance: bigint = await mockUSDC.balanceOf(signer.address);
    if (currentBalance < amount) {
        console.log(
            `Minting ${DEPOSIT_AMOUNT_USDC} MockUSDC for ${signer.address}`
        );
        const mintTx = await mockUSDC.mintUSD(signer.address, 100);
        await mintTx.wait();
    }

    console.log(`Approving LenderVault at ${vaultAddress}...`);
    const approveTx = await mockUSDC.approve(vaultAddress, amount);
    await approveTx.wait();

    console.log("Quoting LayerZero deposit fee...");
    const fee = await lenderVault.quoteDeposit(amount);
    const nativeFee = fee.nativeFee ?? fee[0];
    console.log(`Native fee: ${ethers.formatEther(nativeFee)} ETH`);

    console.log(
        `Depositing ${DEPOSIT_AMOUNT_USDC} MockUSDC (gas fee paid in native currency)...`
    );
    const depositTx = await lenderVault.deposit(amount, amount, {
        value: nativeFee,
    });
    await depositTx.wait();
    console.log(
        "Deposit sent cross-chain. Shares will be minted on Arbitrum once the message finalizes."
    );
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});


