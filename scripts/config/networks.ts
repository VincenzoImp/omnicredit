/**
 * Network Configuration for OmniCredit Protocol
 *
 * Contains all network-specific addresses and configuration parameters
 * required for deploying and configuring the protocol across multiple chains.
 */

export interface NetworkConfig {
  chainId: number;
  name: string;
  isTestnet: boolean;
  isBaseChain: boolean; // True for Base, false for satellite chains

  // External protocol addresses
  pythAddress?: string;
  usdcAddress?: string;
  lzEndpoint?: string;
  lzEndpointId?: number; // LayerZero endpoint ID for this chain
  poolManager?: string; // Uniswap V4 PoolManager

  // Deployed contract addresses (filled after deployment)
  deployed?: {
    // Base chain contracts
    creditScore?: string;
    priceOracle?: string;
    feeBasedLimits?: string;
    protocolCore?: string;
    liquidationManager?: string;
    crossChainCoordinator?: string;
    liquidationHook?: string;

    // Satellite chain contracts
    collateralVault?: string;
    usdcOFTAdapter?: string;
    usdcOmnitoken?: string;
  };

  // Configuration parameters
  config?: {
    feeCollector?: string;
    maxPriceAge?: number; // In seconds
    maxConfidenceRatio?: number; // In basis points
    liquidationBonus?: number; // In basis points
  };
}

// Pyth price feed IDs (same across all networks)
export const PYTH_PRICE_FEEDS = {
  "ETH/USD": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "BTC/USD": "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "USDC/USD": "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"
};

// Network configurations
export const NETWORKS: { [key: string]: NetworkConfig } = {
  // ============ TESTNET CONFIGURATIONS ============

  "baseSepolia": {
    chainId: 84532,
    name: "Base Sepolia",
    isTestnet: true,
    isBaseChain: true,

    // Base Sepolia testnet addresses
    pythAddress: "0x2880aB155794e7179c9eE2e38200202908C17B43", // Pyth on Base Sepolia
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
    lzEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f", // LayerZero V2 on Base Sepolia
    lzEndpointId: 40245, // Base Sepolia endpoint ID
    poolManager: "", // TODO: Add Uniswap V4 PoolManager when available

    config: {
      feeCollector: "", // TODO: Set fee collector address
      maxPriceAge: 300, // 5 minutes
      maxConfidenceRatio: 500, // 5%
      liquidationBonus: 1000, // 10%
    }
  },

  "sepolia": {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    isTestnet: true,
    isBaseChain: false,

    // Ethereum Sepolia testnet addresses
    pythAddress: "0x2880aB155794e7179c9eE2e38200202908C17B43", // Pyth on Sepolia
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Sepolia
    lzEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f", // LayerZero V2 on Sepolia
    lzEndpointId: 40161, // Sepolia endpoint ID

    config: {
      maxPriceAge: 300,
      maxConfidenceRatio: 500,
    }
  }
};

/**
 * Helper function to get network configuration
 */
export function getNetworkConfig(networkName: string): NetworkConfig {
  const config = NETWORKS[networkName];
  if (!config) {
    throw new Error(`Unknown network: ${networkName}`);
  }
  return config;
}

/**
 * Helper function to get the base chain configuration for a given network
 */
export function getBaseChainConfig(isTestnet: boolean): NetworkConfig {
  return NETWORKS.baseSepolia; // Base Sepolia is always the base chain
}

/**
 * Helper function to validate network configuration
 */
export function validateNetworkConfig(networkName: string): string[] {
  const config = getNetworkConfig(networkName);
  const errors: string[] = [];

  if (config.isBaseChain) {
    // Base chain validation
    if (!config.pythAddress || config.pythAddress === "") {
      errors.push("Pyth address not configured");
    }
    if (!config.usdcAddress || config.usdcAddress === "") {
      errors.push("USDC address not configured");
    }
    if (!config.lzEndpoint || config.lzEndpoint === "") {
      errors.push("LayerZero endpoint not configured");
    }
    // Fee collector is optional - will default to deployer address if not set
  } else {
    // Satellite chain validation
    if (!config.lzEndpoint || config.lzEndpoint === "") {
      errors.push("LayerZero endpoint not configured");
    }
    if (!config.lzEndpointId || config.lzEndpointId === 0) {
      errors.push("LayerZero endpoint ID not configured");
    }
  }

  return errors;
}

/**
 * Asset configuration for different chains
 */
export const ASSET_DECIMALS: { [asset: string]: number } = {
  "ETH": 18,
  "WETH": 18,
  "BTC": 8,
  "WBTC": 8,
  "USDC": 6,
  "USDT": 6,
  "DAI": 18
};

/**
 * Get the coordinator endpoint ID based on network
 */
export function getCoordinatorEndpointId(isTestnet: boolean): number {
  const baseConfig = getBaseChainConfig(isTestnet);
  return baseConfig.lzEndpointId || 0;
}