import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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
  const lzEndpoint = m.getParameter("lzEndpoint", ZERO_ADDRESS);
  const lzDelegate = m.getParameter("lzDelegate", ZERO_ADDRESS);
  const coordinatorEid = m.getParameter("coordinatorEid", 0); // Base chain endpoint ID
  const usdcAddress = m.getParameter("usdcAddress", ZERO_ADDRESS);

  const result: any = {};

  // Use string comparison for chainType parameter
  const chainTypeValue = typeof chainType === "string" ? chainType : "satellite";

  if (chainTypeValue === "satellite") {
    // Deploy CollateralVault for satellite chains (Arbitrum, Optimism, etc.)
    console.log("Deploying CollateralVault for satellite chain...");

    result.collateralVault = m.contract("CollateralVault", [
      lzEndpoint,      // _endpoint
      lzDelegate,      // _delegate
      coordinatorEid   // _coordinatorEid (Base chain EID)
    ], {
      id: "CollateralVault"
    });

  } else if (chainTypeValue === "ethereum") {
    // Deploy USDCOFTAdapter for Ethereum (wraps native USDC)
    console.log("Deploying USDCOFTAdapter for Ethereum...");

    const usdcAddr = typeof usdcAddress === "string" ? usdcAddress : ZERO_ADDRESS;
    if (usdcAddr === ZERO_ADDRESS) {
      throw new Error("USDC address required for Ethereum deployment");
    }

    result.usdcOFTAdapter = m.contract("USDCOFTAdapter", [
      usdcAddr,        // _token (native USDC)
      lzEndpoint,      // _lzEndpoint
      lzDelegate       // _delegate
    ], {
      id: "USDCOFTAdapter"
    });

  } else if (chainTypeValue === "non-usdc") {
    // Deploy USDCOmnitoken for chains without native USDC
    console.log("Deploying USDCOmnitoken for non-USDC chain...");

    result.usdcOmnitoken = m.contract("USDCOmnitoken", [
      lzEndpoint,      // _lzEndpoint
      lzDelegate       // _delegate
    ], {
      id: "USDCOmnitoken"
    });
  } else {
    throw new Error(`Unknown chain type: ${chainTypeValue}`);
  }

  return result;
});

export default CrossChainModule;