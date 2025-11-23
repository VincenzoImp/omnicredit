import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import MockOFT from "./MockOFT";

/**
 * Satellite Chain Deployment Module
 * 
 * Deploys contracts for satellite chains (Sepolia, Optimism Sepolia):
 * - MockUSDC (local token)
 * - MockOFT (for cross-chain bridging)
 * - LenderVault (for lender deposits)
 * - CollateralVault (for borrower collateral)
 * 
 * This module is reusable for any satellite chain.
 */
export default buildModule("SatelliteChain", (m) => {
    const lzEndpoint = m.getParameter("lzEndpoint");
    const delegate = m.getParameter("delegate", m.getAccount(0));
    const protocolCoreEid = m.getParameter("protocolCoreEid"); // Arbitrum Sepolia EID
    const protocolCoreAddress = m.getParameter("protocolCoreAddress"); // ProtocolCore address as bytes32

    // Deploy MockUSDC (local token for this chain)
    const mockUSDC = m.contract("MockUSDC", ["Mock USDC", "mUSDC"]);

    // Deploy MockOFT
    const oft = m.useModule(MockOFT);

    // Deploy LenderVault
    const lenderVault = m.contract("LenderVault", [
        mockUSDC, // _localUSDC
        lzEndpoint, // _lzEndpoint
        delegate, // _delegate
    ]);

    // Deploy CollateralVault
    const collateralVault = m.contract("CollateralVault", [
        lzEndpoint,
        delegate,
    ]);

    // Configure LenderVault
    // Note: protocolCoreAddress should be passed as bytes32 (use helper function in script)
    m.call(lenderVault, "setProtocolCore", [protocolCoreAddress, protocolCoreEid]);
    m.call(lenderVault, "setUSDCOTF", [oft.mockOFT]);

    // Configure CollateralVault
    // Note: protocolCoreAddress should be passed as bytes32 (use helper function in script)
    m.call(collateralVault, "setProtocolCore", [protocolCoreAddress, protocolCoreEid]);

    // Set native token decimals (ETH = 18)
    const nativeTokenAddress = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    m.call(collateralVault, "setAssetDecimals", [nativeTokenAddress, 18]);

    return {
        mockUSDC,
        mockOFT: oft.mockOFT,
        lenderVault,
        collateralVault,
    };
});

