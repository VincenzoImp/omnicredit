// Deployment addresses loaded from deployments.json (bundled at build-time)
import rawDeployments from './deployments.json';

export interface DeploymentAddresses {
  arbitrumSepolia: {
    protocolCore: string;
    creditScore: string;
    feeBasedLimits: string;
    priceOracle: string;
    liquidationManager: string;
    mockUSDC: string;
    mockOFT: string;
  };
  baseSepolia: {
    lenderVault: string;
    collateralVault: string;
    mockUSDC: string;
    mockOFT: string;
  };
  optimismSepolia: {
    lenderVault: string;
    collateralVault: string;
    mockUSDC: string;
    mockOFT: string;
  };
}

// Typed deployments object, always available
export const deployments = rawDeployments as DeploymentAddresses;

// Kept for backwards compatibility; now a no-op
export async function loadDeployments(): Promise<void> {
  return Promise.resolve();
}

export function getAddress(
  chain: keyof DeploymentAddresses,
  contract: string
): `0x${string}` | undefined {
  const chainDeployments = deployments[chain] as Record<string, string>;
  const address = chainDeployments[contract];
  
  if (!address) {
    console.error(`Available contracts on ${chain}:`, Object.keys(chainDeployments));
    return undefined;
  }
  
  return address as `0x${string}`;
}

