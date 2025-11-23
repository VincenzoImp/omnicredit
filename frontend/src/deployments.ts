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
  console.log('Deployments already loaded from bundle');
  return Promise.resolve();
}

export function getAddress(
  chain: keyof DeploymentAddresses,
  contract: string
): `0x${string}` | undefined {
  // Safety check for deployments object
  if (!deployments) {
    console.error('Deployments object is undefined! Check deployments.json import.');
    return undefined;
  }

  const chainDeployments = deployments[chain] as Record<string, string> | undefined;
  
  if (!chainDeployments) {
    // Warn only once per chain to avoid console spam, or use debug level
    console.warn(`No deployments found for chain "${chain}". Available chains:`, Object.keys(deployments));
    return undefined;
  }

  // Safety check for contract
  if (!contract) {
    console.error('Contract name is undefined or empty');
    return undefined;
  }

  const address = chainDeployments[contract];
  
  if (!address) {
    console.warn(`Contract "${contract}" not found on chain "${chain}". Available contracts:`, Object.keys(chainDeployments));
    return undefined;
  }
  
  return address as `0x${string}`;
}
