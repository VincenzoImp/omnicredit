// Deployment addresses loaded from deployments.json
export const deployments = {
  arbitrumSepolia: {
    protocolCore: "",
    creditScore: "",
    feeBasedLimits: "",
    priceOracle: "",
    liquidationManager: "",
    mockUSDC: "",
    usdcOFT: "",
  },
  baseSepolia: {
    lenderVault: "",
    collateralVault: "",
    mockUSDC: "",
    usdcOFT: "",
  },
  optimismSepolia: {
    lenderVault: "",
    collateralVault: "",
    mockUSDC: "",
    usdcOFT: "",
  },
};

// Load deployments from the backend
export async function loadDeployments() {
  try {
    const response = await fetch('/deployments.json');
    const data = await response.json();
    Object.assign(deployments, data);
  } catch (error) {
    console.error('Failed to load deployments:', error);
  }
}

export function getAddress(chain: keyof typeof deployments, contract: string): `0x${string}` {
  const chainDeployments = deployments[chain] as Record<string, string>;
  const address = chainDeployments[contract];
  if (!address) {
    throw new Error(`Missing address for ${contract} on ${chain}`);
  }
  return address as `0x${string}`;
}

