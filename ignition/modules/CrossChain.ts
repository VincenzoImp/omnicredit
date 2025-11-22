import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * @file CrossChain.ts
 * @notice Hardhat Ignition module for deploying cross-chain contracts on satellite chains
 * @dev Supports three deployment modes: satellite, ethereum, and non-usdc chains
 */

// ============ CONSTANTS ============

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Chain type definitions
const CHAIN_TYPES = {
  SATELLITE: "satellite",
  ETHEREUM: "ethereum",
  NON_USDC: "non-usdc",
} as const;

type ChainType = typeof CHAIN_TYPES[keyof typeof CHAIN_TYPES];

// ============ PARAMETER VALIDATION ============

/**
 * Validates and normalizes chain type parameter
 * @param chainType The chain type parameter from Ignition
 * @returns Normalized chain type
 */
function validateChainType(chainType: any): ChainType {
  const type = typeof chainType === "string" ? chainType.toLowerCase() : CHAIN_TYPES.SATELLITE;
  
  if (
    type !== CHAIN_TYPES.SATELLITE &&
    type !== CHAIN_TYPES.ETHEREUM &&
    type !== CHAIN_TYPES.NON_USDC
  ) {
    throw new Error(
      `Invalid chainType: "${type}". ` +
      `Must be one of: "${CHAIN_TYPES.SATELLITE}", "${CHAIN_TYPES.ETHEREUM}", or "${CHAIN_TYPES.NON_USDC}"`
    );
  }
  
  return type as ChainType;
}

// ============ MODULE DEFINITION ============

/**
 * CrossChain Module
 * 
 * Deploys the appropriate cross-chain contract based on chain type:
 * - Satellite: CollateralVault (for Arbitrum, Optimism, etc.)
 * - Ethereum: USDCOFTAdapter (wraps native USDC for cross-chain)
 * - Non-USDC: USDCOmnitoken (synthetic USDC for chains without native USDC)
 * 
 * @param m Module builder instance
 * @returns Deployed contract instance
 */
const CrossChainModule = buildModule("CrossChain", (m) => {
  // ============ PARAMETER EXTRACTION ============
  
  const chainTypeParam = m.getParameter("chainType", CHAIN_TYPES.SATELLITE);
  const lzEndpoint = m.getParameter("lzEndpoint", ZERO_ADDRESS);
  const lzDelegate = m.getParameter("lzDelegate", ZERO_ADDRESS);
  const coordinatorEid = m.getParameter("coordinatorEid", 0);
  const usdcAddress = m.getParameter("usdcAddress", ZERO_ADDRESS);

  // Validate and normalize chain type
  const chainType = validateChainType(chainTypeParam);

  // ============ DEPLOYMENT LOGIC ============
  
  const result: {
    collateralVault?: any;
    usdcOFTAdapter?: any;
    usdcOmnitoken?: any;
    chainType: ChainType;
  } = {
    chainType,
  };

  if (chainType === CHAIN_TYPES.SATELLITE) {
    // ============ SATELLITE CHAIN DEPLOYMENT ============
    
    console.log("\n📦 Deploying CollateralVault for satellite chain...");
    console.log(`   Coordinator EID: ${coordinatorEid}`);

    result.collateralVault = m.contract("CollateralVault", [
      lzEndpoint,      // _endpoint
      lzDelegate,      // _delegate
      coordinatorEid,   // _coordinatorEid (Base chain EID)
    ], {
      id: "CollateralVault",
    });

    console.log("✅ CollateralVault deployment configured");

  } else if (chainType === CHAIN_TYPES.ETHEREUM) {
    // ============ ETHEREUM CHAIN DEPLOYMENT ============
    
    console.log("\n📦 Deploying USDCOFTAdapter for Ethereum...");
    console.log(`   USDC Address: ${usdcAddress}`);

    result.usdcOFTAdapter = m.contract("USDCOFTAdapter", [
      usdcAddress,     // _token (native USDC)
      lzEndpoint,      // _lzEndpoint
      lzDelegate,      // _delegate
    ], {
      id: "USDCOFTAdapter",
    });

    console.log("✅ USDCOFTAdapter deployment configured");

  } else if (chainType === CHAIN_TYPES.NON_USDC) {
    // ============ NON-USDC CHAIN DEPLOYMENT ============
    
    console.log("\n📦 Deploying USDCOmnitoken for non-USDC chain...");

    result.usdcOmnitoken = m.contract("USDCOmnitoken", [
      lzEndpoint,      // _lzEndpoint
      lzDelegate,      // _delegate
    ], {
      id: "USDCOmnitoken",
    });

    console.log("✅ USDCOmnitoken deployment configured");
  }

  console.log("\n✅ CrossChain module deployment plan complete\n");

  return result;
});

export default CrossChainModule;
