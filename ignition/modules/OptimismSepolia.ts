import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import SatelliteChain from "./SatelliteChain";

/**
 * Optimism Sepolia Deployment Module
 * 
 * Deploys all contracts for Optimism Sepolia testnet.
 * Uses the SatelliteChain module with Optimism Sepolia-specific parameters.
 */
export default buildModule("OptimismSepolia", (m) => {
  return m.useModule(SatelliteChain);
});

