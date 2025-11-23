import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * @file CrossChainSatellite.ts
 * @notice Deploys CollateralVault for satellite chains (Arbitrum, Optimism, etc.)
 * @dev Use this module for L2 chains that have USDC
 */

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const CrossChainSatelliteModule = buildModule("CrossChainSatellite", (m) => {
  const lzEndpoint = m.getParameter("lzEndpoint", ZERO_ADDRESS);
  const lzDelegate = m.getParameter("lzDelegate", ZERO_ADDRESS);
  const coordinatorEid = m.getParameter("coordinatorEid", 0);

  console.log("\n📦 Deploying CollateralVault for satellite chain...");
  console.log(`   Coordinator EID: ${coordinatorEid}`);

  const collateralVault = m.contract("CollateralVault", [
    lzEndpoint,
    lzDelegate,
    coordinatorEid,
  ], {
    id: "CollateralVault",
  });

  console.log("✅ CollateralVault deployment configured\n");

  return { collateralVault };
});

export default CrossChainSatelliteModule;

