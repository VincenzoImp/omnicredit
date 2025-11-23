import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import CoreContracts from "./CoreContracts";
import MockOFT from "./MockOFT";

/**
 * Arbitrum Sepolia Deployment Module
 * 
 * Complete deployment for Arbitrum Sepolia (main protocol chain):
 * - Core protocol contracts
 * - MockUSDC
 * - MockOFT
 * - Configuration and setup
 */
export default buildModule("ArbitrumSepolia", (m) => {
    // Deploy core contracts
    const core = m.useModule(CoreContracts);

    // Deploy MockOFT
    const oft = m.useModule(MockOFT);

    // Configure ProtocolCore with MockOFT
    m.call(core.protocolCore, "setUSDCOTF", [oft.mockOFT]);

    return {
        ...core,
        ...oft,
    };
});

