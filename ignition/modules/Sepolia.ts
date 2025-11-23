import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import SatelliteChain from "./SatelliteChain";

/**
 * Sepolia Deployment Module
 * 
 * Deploys all contracts for Sepolia testnet.
 * Uses the SatelliteChain module with Sepolia-specific parameters.
 */
export default buildModule("Sepolia", (m) => {
  return m.useModule(SatelliteChain);
});

