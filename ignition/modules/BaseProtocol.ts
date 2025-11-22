import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Base Protocol Module - Deploys core protocol contracts on Base chain
 *
 * This module deploys:
 * 1. ContinuousCreditScore - Credit scoring system
 * 2. PriceOracle - Pyth-based price oracle
 * 3. FeeBasedLimits - Anti-gaming borrow limits
 * 4. ProtocolCore - Main lending pool
 * 5. LiquidationManager - Dutch auction liquidation system
 * 6. CrossChainCoordinator - LayerZero hub for cross-chain collateral
 */
const BaseProtocolModule = buildModule("BaseProtocol", (m) => {
  // Get deployment parameters with defaults for testing
  const pythAddress = m.getParameter("pythAddress", ZERO_ADDRESS);
  const usdcAddress = m.getParameter("usdcAddress", ZERO_ADDRESS);
  const lzEndpoint = m.getParameter("lzEndpoint", ZERO_ADDRESS);
  const lzDelegate = m.getParameter("lzDelegate", ZERO_ADDRESS);
  const poolManager = m.getParameter("poolManager", ZERO_ADDRESS);
  const feeCollector = m.getParameter("feeCollector", ZERO_ADDRESS);

  // Phase 1: Core Building Blocks
  console.log("Deploying Phase 1: Core Building Blocks...");

  // 1. Deploy ContinuousCreditScore (no dependencies)
  const creditScore = m.contract("ContinuousCreditScore", [], {
    id: "CreditScore"
  });

  // 2. Deploy PriceOracle (requires Pyth address)
  const priceOracle = m.contract("PriceOracle", [pythAddress], {
    id: "PriceOracle"
  });

  // 3. Deploy FeeBasedLimits (requires CreditScore)
  const feeBasedLimits = m.contract("FeeBasedLimits", [creditScore], {
    id: "FeeBasedLimits"
  });

  // Phase 2: Main Protocol
  console.log("Deploying Phase 2: Main Protocol...");

  // 4. Deploy ProtocolCore (main lending pool)
  const protocolCore = m.contract("ProtocolCore", [
    usdcAddress,        // _lendingToken
    creditScore,        // _creditScore
    feeBasedLimits,     // _feeBasedLimits
    priceOracle         // _priceOracle
  ], {
    id: "ProtocolCore"
  });

  // 5. Deploy LiquidationManager
  const liquidationManager = m.contract("LiquidationManager", [
    priceOracle,        // _priceOracle
    creditScore,        // _creditScore
    protocolCore,       // _lendingPool
    usdcAddress         // _usdc
  ], {
    id: "LiquidationManager"
  });

  // Phase 3: Cross-Chain Infrastructure
  console.log("Deploying Phase 3: Cross-Chain Infrastructure...");

  // 6. Deploy CrossChainCoordinator (LayerZero hub on Base)
  const crossChainCoordinator = m.contract("CrossChainCoordinator", [
    lzEndpoint,         // _endpoint
    lzDelegate          // _delegate
  ], {
    id: "CrossChainCoordinator"
  });

  // Phase 4: Hooks (optional, only if Uniswap V4 is available)
  const result: any = {
    creditScore,
    priceOracle,
    feeBasedLimits,
    protocolCore,
    liquidationManager,
    crossChainCoordinator,
  };

  // For now, skip LiquidationHook deployment as it requires Uniswap V4 PoolManager
  // Uncomment when PoolManager is available:
  // if (poolManager !== ZERO_ADDRESS) {
  //   console.log("Deploying Phase 4: Uniswap V4 Hooks...");
  //   result.liquidationHook = m.contract("LiquidationHook", [poolManager], {
  //     id: "LiquidationHook"
  //   });
  // }

  return result;
});

export default BaseProtocolModule;