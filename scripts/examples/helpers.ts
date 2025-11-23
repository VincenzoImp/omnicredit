import { readFileSync } from "fs";
import path from "path";

export type ChainKey = "arbitrumSepolia" | "baseSepolia" | "optimismSepolia";

interface DeploymentAddresses {
  [chain: string]: Record<string, string | undefined> | undefined;
}

let cachedDeployments: DeploymentAddresses | null = null;

function loadDeployments(): DeploymentAddresses {
  if (cachedDeployments) {
    return cachedDeployments;
  }

  const filePath = path.join(process.cwd(), "deployments.json");
  const raw = readFileSync(filePath, "utf-8");
  cachedDeployments = JSON.parse(raw) as DeploymentAddresses;
  return cachedDeployments;
}

export function getAddress(
  chain: ChainKey,
  contractKey: string
): string {
  const deployments = loadDeployments();
  const chainDeployments = deployments[chain];
  const address = chainDeployments?.[contractKey];
  if (!address) {
    throw new Error(
      `Missing address for ${contractKey} on ${chain}. Update deployments.json`
    );
  }
  return address;
}

export function formatAmount(amount: bigint, decimals = 18): string {
  const divisor = BigInt(10) ** BigInt(decimals);
  const integerPart = amount / divisor;
  const fractionalPart = amount % divisor;
  return `${integerPart}.${fractionalPart.toString().padStart(decimals, "0")}`;
}


