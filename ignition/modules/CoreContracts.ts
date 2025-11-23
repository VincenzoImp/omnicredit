import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Core Contracts Module
 * 
 * Deploys the core protocol contracts on Arbitrum Sepolia:
 * - ContinuousCreditScore
 * - FeeBasedLimits
 * - PriceOracle
 * - ProtocolCore
 * - LiquidationManager
 * 
 * These contracts form the foundation of the lending protocol.
 */
export default buildModule("CoreContracts", (m) => {
    // Get parameters from config
    const pythAddress = m.getParameter("pythAddress");
    const lzEndpoint = m.getParameter("lzEndpoint");
    const delegate = m.getParameter("delegate", m.getAccount(0));

    // Deploy ContinuousCreditScore
    const creditScore = m.contract("ContinuousCreditScore");

    // Deploy FeeBasedLimits
    const feeBasedLimits = m.contract("FeeBasedLimits");

    // Deploy PriceOracle
    const priceOracle = m.contract("PriceOracle", [pythAddress]);

    // Deploy MockUSDC (for testing)
    const mockUSDC = m.contract("MockUSDC", ["Mock USDC", "mUSDC"]);

    // Deploy ProtocolCore
    const protocolCore = m.contract("ProtocolCore", [
        mockUSDC,
        creditScore,
        feeBasedLimits,
        priceOracle,
        lzEndpoint,
        delegate,
    ]);

    // Deploy LiquidationManager
    const liquidationManager = m.contract("LiquidationManager", [
        priceOracle,
        creditScore,
        protocolCore,
        mockUSDC,
    ]);

    // Post-deployment configuration
    // Set liquidation manager in ProtocolCore
    m.call(protocolCore, "setLiquidationManager", [liquidationManager]);

    // Configure ETH price feed in PriceOracle
    const ethPriceFeedId = m.getParameter("ethPriceFeedId");
    if (ethPriceFeedId) {
        m.call(priceOracle, "addPriceFeed", [
            "0x0000000000000000000000000000000000000000", // address(0) for ETH
            ethPriceFeedId,
        ]);
    }

    return {
        creditScore,
        feeBasedLimits,
        priceOracle,
        mockUSDC,
        protocolCore,
        liquidationManager,
    };
});

