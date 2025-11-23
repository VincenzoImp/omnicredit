import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * @file CrossChainEthereum.ts
 * @notice Deploys USDCOFTAdapter for Ethereum chains
 * @dev Use this module for Ethereum mainnet and testnets
 */

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const CrossChainEthereumModule = buildModule("CrossChainEthereum", (m) => {
  const lzEndpoint = m.getParameter("lzEndpoint", ZERO_ADDRESS);
  const lzDelegate = m.getParameter("lzDelegate", ZERO_ADDRESS);
  const usdcAddress = m.getParameter("usdcAddress", ZERO_ADDRESS);

  console.log("\n📦 Deploying USDCOFTAdapter for Ethereum...");
  console.log(`   USDC Address: ${usdcAddress}`);

  const usdcOFTAdapter = m.contract("USDCOFTAdapter", [
    usdcAddress,
    lzEndpoint,
    lzDelegate,
  ], {
    id: "USDCOFTAdapter",
  });

  console.log("✅ USDCOFTAdapter deployment configured\n");

  return { usdcOFTAdapter };
});

export default CrossChainEthereumModule;

