import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * @file BaseProtocol.ts
 * @notice Hardhat Ignition module for deploying the core OmniCredit protocol on Base chain
 * @dev Deploys all core protocol contracts in the correct dependency order
 * 
 * @author OmniCredit Team
 * @version 1.0.0
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Deployment result type
 */
type DeploymentResult = {
  creditScore: any;
  priceOracle: any;
  feeBasedLimits: any;
  protocolCore: any;
  liquidationManager: any;
  crossChainCoordinator: any;
  liquidationHook?: any;
};

// ============================================================================
// MODULE DEFINITION
// ============================================================================

/**
 * BaseProtocol Module
 * 
 * Deploys the complete OmniCredit protocol stack on Base chain in the following order:
 * 
 * Phase 1: Core Building Blocks
 *   - ContinuousCreditScore: Credit scoring system for borrowers
 *   - PriceOracle: Pyth Network integration for price feeds
 *   - FeeBasedLimits: Anti-gaming mechanism for borrow limits
 * 
 * Phase 2: Main Protocol
 *   - ProtocolCore: Main lending pool with share-based accounting
 *   - LiquidationManager: Dutch auction liquidation system
 * 
 * Phase 3: Cross-Chain Infrastructure
 *   - CrossChainCoordinator: LayerZero hub for cross-chain collateral
 * 
 * Phase 4: Uniswap V4 Integration
 *   - LiquidationHook: Uniswap V4 hook for liquidations with dynamic fees
 * 
 * @param m Module builder instance from Hardhat Ignition
 * @returns Object containing all deployed contract instances
 * 
 * @example
 * ```bash
 * npx hardhat ignition deploy ignition/modules/BaseProtocol.ts \
 *   --network arbitrumSepolia \
 *   --parameters ignition/parameters/arbitrumSepolia.json \
 *   --reset
 * ```
 */
const BaseProtocolModule = buildModule("BaseProtocol", (m) => {
  // ============================================================================
  // PARAMETER EXTRACTION
  // ============================================================================

  console.log("\n" + "=".repeat(60));
  console.log("🚀 OmniCredit Base Protocol Deployment");
  console.log("=".repeat(60) + "\n");

  const pythAddress = m.getParameter("pythAddress", ZERO_ADDRESS);
  const usdcAddress = m.getParameter("usdcAddress", ZERO_ADDRESS);
  const lzEndpoint = m.getParameter("lzEndpoint", ZERO_ADDRESS);
  const lzDelegate = m.getParameter("lzDelegate", ZERO_ADDRESS);
  const poolManager = m.getParameter("poolManager", ZERO_ADDRESS);
  const feeCollector = m.getParameter("feeCollector", ZERO_ADDRESS);

  // ============================================================================
  // PHASE 1: CORE BUILDING BLOCKS
  // ============================================================================

  console.log("📦 Phase 1: Core Building Blocks");
  console.log("   └─ Deploying foundational contracts...\n");

  // 1. ContinuousCreditScore - No dependencies
  const creditScore = m.contract("ContinuousCreditScore", [], {
    id: "CreditScore",
  });
  console.log("   ✓ ContinuousCreditScore");

  // 2. PriceOracle - Requires Pyth Network address
  const priceOracle = m.contract("PriceOracle", [pythAddress], {
    id: "PriceOracle",
  });
  console.log("   ✓ PriceOracle");

  // 3. FeeBasedLimits - Requires CreditScore
  const feeBasedLimits = m.contract("FeeBasedLimits", [creditScore], {
    id: "FeeBasedLimits",
  });
  console.log("   ✓ FeeBasedLimits");

  // ============================================================================
  // PHASE 2: MAIN PROTOCOL
  // ============================================================================

  console.log("\n📦 Phase 2: Main Protocol");
  console.log("   └─ Deploying core lending infrastructure...\n");

  // 4. ProtocolCore - Main lending pool
  const protocolCore = m.contract("ProtocolCore", [
    usdcAddress,      // _lendingToken: USDC address
    creditScore,       // _creditScore: Credit scoring system
    feeBasedLimits,    // _feeBasedLimits: Anti-gaming limits
    priceOracle,       // _priceOracle: Price feed oracle
  ], {
    id: "ProtocolCore",
  });
  console.log("   ✓ ProtocolCore");

  // 5. LiquidationManager - Dutch auction liquidation system
  const liquidationManager = m.contract("LiquidationManager", [
    priceOracle,       // _priceOracle: For collateral pricing
    creditScore,       // _creditScore: For credit score penalties
    protocolCore,      // _lendingPool: Main protocol reference
    usdcAddress,       // _usdc: USDC token for debt repayment
  ], {
    id: "LiquidationManager",
  });
  console.log("   ✓ LiquidationManager");

  // ============================================================================
  // PHASE 3: CROSS-CHAIN INFRASTRUCTURE
  // ============================================================================

  console.log("\n📦 Phase 3: Cross-Chain Infrastructure");
  console.log("   └─ Deploying LayerZero coordination hub...\n");

  // 6. CrossChainCoordinator - LayerZero hub for cross-chain collateral
  const crossChainCoordinator = m.contract("CrossChainCoordinator", [
    lzEndpoint,        // _endpoint: LayerZero V2 endpoint
    lzDelegate,        // _delegate: LayerZero delegate address
  ], {
    id: "CrossChainCoordinator",
  });
  console.log("   ✓ CrossChainCoordinator");

  // ============================================================================
  // PHASE 4: UNISWAP V4 INTEGRATION
  // ============================================================================

  console.log("\n📦 Phase 4: Uniswap V4 Integration");
  console.log("   └─ Deploying liquidation hook...\n");

  // 7. LiquidationHook - Uniswap V4 hook for liquidations
  // 
  // ⚠️  CRITICAL REQUIREMENT: Uniswap V4 requires hooks to be deployed at
  // addresses with specific permission bits encoded in the address itself.
  // This is a security mechanism that cannot be bypassed.
  // 
  // ✅ SOLUTION: LiquidationHook must be deployed separately using CREATE2
  //    with salt mining. This cannot be done directly in Ignition modules.
  //    
  //    Options:
  //    1. Deploy using: npx hardhat run scripts/deploy-liquidation-hook.ts --network <network>
  //    2. Use wrapper script: npm run deploy:base-protocol
  //    3. Provide pre-deployed address in parameters file

  const providedHookAddress = m.getParameter("liquidationHook", ZERO_ADDRESS);
  let liquidationHook: any = undefined;

  // Skip hook reference during initial deployment
  // The hook will be deployed separately and can be referenced in a future deployment
  // We check if the address is zero to avoid trying to reference a non-existent contract
  const hookAddressValue = providedHookAddress as any;
  const isZeroAddress = hookAddressValue === ZERO_ADDRESS ||
    hookAddressValue === "0x0000000000000000000000000000000000000000" ||
    (typeof hookAddressValue === "object" && hookAddressValue?.value === ZERO_ADDRESS);

  if (!isZeroAddress) {
    // Only try to reference if we have a valid non-zero address
    // Note: This will fail if the artifact doesn't exist, which is expected during initial deployment
    console.log("   ⚠️  LiquidationHook address provided but artifact may not exist");
    console.log("   📋 Skipping hook reference - it will be deployed separately");
    console.log("   📋 After hook deployment, you can reference it in a future deployment");
  } else {
    // No hook address provided - this is expected during initial deployment
    console.log("   ⚠️  LiquidationHook address not provided in parameters");
    console.log("   📋 Hook will be deployed separately after BaseProtocol");
    console.log(`   📋 After hook deployment, add 'liquidationHook' to ignition/parameters/${process.env.NETWORK || 'arbitrumSepolia'}.json`);
  }

  // ============================================================================
  // DEPLOYMENT SUMMARY
  // ============================================================================

  console.log("\n" + "=".repeat(60));
  console.log("✅ Deployment Plan Complete");
  console.log("=".repeat(60));
  console.log("\n📋 Contracts to be deployed:");
  console.log("   1. ContinuousCreditScore");
  console.log("   2. PriceOracle");
  console.log("   3. FeeBasedLimits");
  console.log("   4. ProtocolCore");
  console.log("   5. LiquidationManager");
  console.log("   6. CrossChainCoordinator");
  if (liquidationHook) {
    console.log("   7. LiquidationHook (referenced)");
  } else {
    console.log("   7. LiquidationHook (skipped - deploy separately)");
  }
  console.log("\n");

  // ============================================================================
  // RETURN DEPLOYED CONTRACTS
  // ============================================================================

  const result: DeploymentResult = {
    creditScore,
    priceOracle,
    feeBasedLimits,
    protocolCore,
    liquidationManager,
    crossChainCoordinator,
  };

  if (liquidationHook) {
    result.liquidationHook = liquidationHook;
  }

  return result;
});

export default BaseProtocolModule;
