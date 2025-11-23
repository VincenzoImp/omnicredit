import hre from "hardhat";
import { ethers, Contract, Wallet } from "ethers";
import { getAddress, ChainKey, formatAmount } from "./helpers.js";

import MockUSDCArtifact from "../../artifacts/contracts/mocks/MockUSDC.sol/MockUSDC.json" assert { type: "json" };
import ProtocolCoreArtifact from "../../artifacts/contracts/base/ProtocolCore.sol/ProtocolCore.json" assert { type: "json" };

const SIX_DECIMALS = 6;
const CHAINS: ChainKey[] = [
  "arbitrumSepolia",
  "baseSepolia",
  "optimismSepolia",
];

async function main() {
  const networkName = process.env.HARDHAT_NETWORK || "hardhat";
  const config = hre.config.networks[networkName] as any;
  
  if (!config || !config.url) {
    throw new Error(`Network ${networkName} not configured in hardhat.config.ts`);
  }
  
  const provider = new ethers.JsonRpcProvider(config.url);
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error("PRIVATE_KEY not found in .env");
  }
  
  const signer = new Wallet(privateKey, provider);
  const signerAddress = await signer.getAddress();
  console.log(`Checking balances for ${signerAddress}`);

  const nativeBalance = await provider.getBalance(signerAddress);
  console.log(
    `• Native balance: ${ethers.formatEther(nativeBalance)} ${networkName}`
  );

  if (networkName === "arbitrumSepolia") {
    await reportArbitrumState(provider, signerAddress);
  } else if (networkName === "baseSepolia") {
    await reportMockUSDC(provider, "baseSepolia", signerAddress);
  } else if (networkName === "optimismSepolia") {
    await reportMockUSDC(provider, "optimismSepolia", signerAddress);
  } else {
    console.warn(
      "Unknown network. Supported: arbitrumSepolia/baseSepolia/optimismSepolia"
    );
  }
}

async function reportArbitrumState(provider: any, user: string) {
  const mockAddress = getAddress("arbitrumSepolia", "mockUSDC");
  const protocolAddress = getAddress("arbitrumSepolia", "protocolCore");

  const mockUSDC = new Contract(mockAddress, MockUSDCArtifact.abi, provider);
  const protocol = new Contract(
    protocolAddress,
    ProtocolCoreArtifact.abi,
    provider
  );

  const balance: bigint = await mockUSDC.balanceOf(user);
  console.log(
    `• MockUSDC (Arbitrum) balance: ${formatAmount(balance, SIX_DECIMALS)}`
  );

  const shares: bigint = await protocol.shares(user);
  console.log(
    `• Lending shares: ${shares.toString()} (pool value: ${
      await protocol.totalShares()
    } total)`
  );

  const loan = await protocol.loans(user);
  if (loan.isActive) {
    console.log(
      `• Active loan principal: ${formatAmount(
        loan.principal,
        SIX_DECIMALS
      )} USDC`
    );
    console.log(
      `  Accrued interest: ${formatAmount(loan.accruedInterest, SIX_DECIMALS)}`
    );
  } else {
    console.log("• No active loan on Arbitrum");
  }
}

async function reportMockUSDC(provider: any, chain: ChainKey, user: string) {
  const mockAddress = getAddress(chain, "mockUSDC");
  const contract = new Contract(
    mockAddress,
    MockUSDCArtifact.abi,
    provider
  );
  const balance: bigint = await contract.balanceOf(user);
  console.log(
    `• MockUSDC (${chain}) balance: ${formatAmount(
      balance,
      SIX_DECIMALS
    )}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


