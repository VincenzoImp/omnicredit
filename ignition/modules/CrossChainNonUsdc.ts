import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * @file CrossChainNonUsdc.ts
 * @notice Deploys USDCOmnitoken for chains without native USDC
 * @dev Use this module for chains that don't have native USDC token
 */

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const CrossChainNonUsdcModule = buildModule("CrossChainNonUsdc", (m) => {
  const lzEndpoint = m.getParameter("lzEndpoint", ZERO_ADDRESS);
  const lzDelegate = m.getParameter("lzDelegate", ZERO_ADDRESS);

  console.log("\n📦 Deploying USDCOmnitoken for non-USDC chain...");

  const usdcOmnitoken = m.contract("USDCOmnitoken", [
    lzEndpoint,
    lzDelegate,
  ], {
    id: "USDCOmnitoken",
  });

  console.log("✅ USDCOmnitoken deployment configured\n");

  return { usdcOmnitoken };
});

export default CrossChainNonUsdcModule;

