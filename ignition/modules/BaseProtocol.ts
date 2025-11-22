import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";

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
  const pythAddress = m.getParameter("pythAddress", ethers.ZeroAddress);
  const usdcAddress = m.getParameter("usdcAddress", ethers.ZeroAddress);
  const lzEndpoint = m.getParameter("lzEndpoint", ethers.ZeroAddress);
  const lzDelegate = m.getParameter("lzDelegate", ethers.ZeroAddress);
  const poolManager = m.getParameter("poolManager", ethers.ZeroAddress);
  const feeCollector = m.getParameter("feeCollector", ethers.ZeroAddress);

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
  let liquidationHook = null;
  if (poolManager !== ethers.ZeroAddress) {
    console.log("Deploying Phase 4: Uniswap V4 Hooks...");
    liquidationHook = m.contract("LiquidationHook", [poolManager], {
      id: "LiquidationHook"
    });
  }

  // Return all deployed contracts for post-deployment configuration
  return {
    creditScore,
    priceOracle,
    feeBasedLimits,
    protocolCore,
    liquidationManager,
    crossChainCoordinator,
    liquidationHook,
    // Include parameter addresses for reference
    pythAddress,
    usdcAddress,
    lzEndpoint,
    lzDelegate,
    poolManager,
    feeCollector
  };
});

export default BaseProtocolModule;