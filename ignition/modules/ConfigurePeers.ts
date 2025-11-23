import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Configure Peers Module
 * 
 * Configures LayerZero peers between contracts after deployment.
 * This module should be run after all contracts are deployed on all chains.
 * 
 * NOTE: This module requires manual configuration after deployment.
 * Use the addresses from previous deployments and configure peers manually
 * or via a separate script, as Ignition doesn't support cross-chain operations
 * in a single module.
 * 
 * For automated peer configuration, use a separate script that reads
 * deployment addresses and configures peers.
 */
export default buildModule("ConfigurePeers", (m) => {
  // This module is a placeholder for documentation
  // Actual peer configuration should be done via script after deployment
  // or manually through each contract's setPeer/authorize functions
  
  return {
    note: "Peer configuration should be done manually or via script after deployment",
  };
});

