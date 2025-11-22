import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers } from "hardhat";

/**
 * Cross-Chain Module - Deploys contracts for satellite chains
 *
 * This module deploys either:
 * - CollateralVault (for satellite chains like Arbitrum, Optimism)
 * - USDCOFTAdapter (for Ethereum mainnet/testnet)
 * - USDCOmnitoken (for non-Ethereum chains without native USDC)
 */
const CrossChainModule = buildModule("CrossChain", (m) => {
  // Get deployment parameters
  const chainType = m.getParameter("chainType", "satellite"); // "ethereum" | "satellite" | "non-usdc"
  const lzEndpoint = m.getParameter("lzEndpoint", ethers.ZeroAddress);
  const lzDelegate = m.getParameter("lzDelegate", ethers.ZeroAddress);
  const coordinatorEid = m.getParameter("coordinatorEid", 0); // Base chain endpoint ID
  const usdcAddress = m.getParameter("usdcAddress", ethers.ZeroAddress);

  let collateralVault = null;
  let usdcOFTAdapter = null;
  let usdcOmnitoken = null;

  if (chainType === "satellite") {
    // Deploy CollateralVault for satellite chains (Arbitrum, Optimism, etc.)
    console.log("Deploying CollateralVault for satellite chain...");

    collateralVault = m.contract("CollateralVault", [
      lzEndpoint,      // _endpoint
      lzDelegate,      // _delegate
      coordinatorEid   // _coordinatorEid (Base chain EID)
    ], {
      id: "CollateralVault"
    });

  } else if (chainType === "ethereum") {
    // Deploy USDCOFTAdapter for Ethereum (wraps native USDC)
    console.log("Deploying USDCOFTAdapter for Ethereum...");

    if (usdcAddress === ethers.ZeroAddress) {
      throw new Error("USDC address required for Ethereum deployment");
    }

    usdcOFTAdapter = m.contract("USDCOFTAdapter", [
      usdcAddress,     // _token (native USDC)
      lzEndpoint,      // _lzEndpoint
      lzDelegate       // _delegate
    ], {
      id: "USDCOFTAdapter"
    });

  } else if (chainType === "non-usdc") {
    // Deploy USDCOmnitoken for chains without native USDC
    console.log("Deploying USDCOmnitoken for non-USDC chain...");

    usdcOmnitoken = m.contract("USDCOmnitoken", [
      lzEndpoint,      // _lzEndpoint
      lzDelegate       // _delegate
    ], {
      id: "USDCOmnitoken"
    });
  } else {
    throw new Error(`Unknown chain type: ${chainType}`);
  }

  return {
    collateralVault,
    usdcOFTAdapter,
    usdcOmnitoken,
    // Include parameters for reference
    chainType,
    lzEndpoint,
    lzDelegate,
    coordinatorEid,
    usdcAddress
  };
});

export default CrossChainModule;