import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import SatelliteChain from "./SatelliteChain";

/**
 * Base Sepolia Deployment Module
 * 
 * Deploys all contracts for Base Sepolia testnet.
 * Uses the SatelliteChain module with Base-specific parameters.
 */
export default buildModule("BaseSepolia", (m) => {
  return m.useModule(SatelliteChain);
});

