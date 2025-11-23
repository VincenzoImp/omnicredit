// Deployment addresses loaded from deployments.json
interface DeploymentAddresses {
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

export let deployments: DeploymentAddresses | null = null;

// Load deployments from the backend
export async function loadDeployments(): Promise<void> {
  try {
    const response = await fetch('/deployments.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch deployments: ${response.statusText}`);
    }
    const data = await response.json();
    deployments = data;
    console.log('✅ Deployments loaded:', deployments);
  } catch (error) {
    console.error('❌ Failed to load deployments:', error);
    throw error;
  }
}

export function getAddress(chain: keyof DeploymentAddresses, contract: string): `0x${string}` | undefined {
  if (!deployments) {
    console.warn('Deployments not loaded yet');
    return undefined;
  }
  
  const chainDeployments = deployments[chain] as Record<string, string>;
  const address = chainDeployments[contract];
  
  if (!address) {
    console.error(`Available contracts on ${chain}:`, Object.keys(chainDeployments));
    return undefined;
  }
  
  return address as `0x${string}`;
}

