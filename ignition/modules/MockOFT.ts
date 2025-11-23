import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * MockOFT Module
 * 
 * Deploys MockOFT for cross-chain MockUSDC bridging.
 * Can be deployed on any chain (Arbitrum Sepolia, Sepolia, Optimism Sepolia).
 */
export default buildModule("MockOFT", (m) => {
    const lzEndpoint = m.getParameter("lzEndpoint");
    const delegate = m.getParameter("delegate", m.getAccount(0));

    const mockOFT = m.contract("MockOFT", [
        "Mock Omnichain USDC",
        "mUSDC",
        lzEndpoint,
        delegate,
    ]);

    return { mockOFT };
});

