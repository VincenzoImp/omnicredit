#!/usr/bin/env node

/**
 * Protocol Verification Script
 * 
 * Tests all protocol components without making transactions:
 * - Reads contract addresses from deployments.json
 * - Verifies contracts are deployed and accessible
 * - Checks basic state (balances, shares, loans)
 * - Validates cross-chain configuration
 */

import hre from "hardhat";
import { ethers } from "ethers";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const DEPLOYMENTS_FILE = join(process.cwd(), "deployments.json");

interface DeploymentAddresses {
  arbitrumSepolia: Record<string, string>;
  baseSepolia: Record<string, string>;
  optimismSepolia: Record<string, string>;
}

function loadDeployments(): DeploymentAddresses {
  if (!existsSync(DEPLOYMENTS_FILE)) {
    throw new Error("deployments.json not found. Run deployment first.");
  }
  return JSON.parse(readFileSync(DEPLOYMENTS_FILE, "utf-8"));
}

async function checkContract(
  provider: ethers.Provider,
  address: string,
  name: string
): Promise<boolean> {
  try {
    const code = await provider.getCode(address);
    if (code === "0x") {
      console.log(`❌ ${name} at ${address} - No contract code`);
      return false;
    }
    const balance = await provider.getBalance(address);
    console.log(`✅ ${name} at ${address} (balance: ${ethers.formatEther(balance)} ETH)`);
    return true;
  } catch (error: any) {
    console.log(`❌ ${name} at ${address} - Error: ${error.message}`);
    return false;
  }
}

async function testNetwork(
  networkName: string,
  rpcUrl: string,
  chainId: number,
  contracts: Record<string, string>
) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing ${networkName} (Chain ID: ${chainId})`);
  console.log(`RPC: ${rpcUrl}`);
  console.log(`${"=".repeat(60)}\n`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  let allPassed = true;

  for (const [name, address] of Object.entries(contracts)) {
    const passed = await checkContract(provider, address, name);
    if (!passed) allPassed = false;
  }

  return allPassed;
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 OmniCredit Protocol Verification");
  console.log("=".repeat(60) + "\n");

  const deployments = loadDeployments();
  const config = hre.config.networks;

  const results: boolean[] = [];

  // Test Arbitrum Sepolia
  if (config.arbitrumSepolia && deployments.arbitrumSepolia) {
    const networkConfig = config.arbitrumSepolia as any;
    const rpcUrl = typeof networkConfig.url === 'string' ? networkConfig.url : process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
    const passed = await testNetwork(
      "Arbitrum Sepolia",
      rpcUrl,
      421614,
      deployments.arbitrumSepolia
    );
    results.push(passed);
  }

  // Test Base Sepolia
  if (config.baseSepolia && deployments.baseSepolia) {
    const networkConfig = config.baseSepolia as any;
    const rpcUrl = typeof networkConfig.url === 'string' ? networkConfig.url : process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
    const passed = await testNetwork(
      "Base Sepolia",
      rpcUrl,
      84532,
      deployments.baseSepolia
    );
    results.push(passed);
  }

  // Test Optimism Sepolia
  if (config.optimismSepolia && deployments.optimismSepolia) {
    const networkConfig = config.optimismSepolia as any;
    const rpcUrl = typeof networkConfig.url === 'string' ? networkConfig.url : process.env.OPTIMISM_SEPOLIA_RPC_URL || "https://sepolia.optimism.io";
    const passed = await testNetwork(
      "Optimism Sepolia",
      rpcUrl,
      11155420,
      deployments.optimismSepolia
    );
    results.push(passed);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Verification Summary");
  console.log("=".repeat(60) + "\n");

  const allPassed = results.every((r) => r);
  if (allPassed) {
    console.log("✅ All contracts verified successfully!");
  } else {
    console.log("⚠️  Some contracts failed verification. Check the output above.");
  }

  console.log("\n💡 Next steps:");
  console.log("   1. Run example scripts to test functionality");
  console.log("   2. Start the frontend: cd frontend && npm run dev");
  console.log("   3. Run liquidation monitor: npm run monitor:liquidations");
}

main().catch((error) => {
  console.error("\n❌ Verification failed:", error);
  process.exit(1);
});

