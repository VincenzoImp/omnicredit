import { EndpointId } from "@layerzerolabs/lz-definitions";

/**
 * LayerZero V2 Configuration for OmniCredit Protocol
 * 
 * Architecture:
 * - ProtocolCore deployed on Arbitrum Sepolia (main protocol)
 * - LenderVault and CollateralVault deployed on Sepolia and Optimism Sepolia
 * - MockUSDC and MockOFT deployed on each chain
 * 
 * Chain Support:
 * - Arbitrum Sepolia (40231): ProtocolCore, MockUSDC, MockOFT
 * - Sepolia (40161): LenderVault, CollateralVault, MockUSDC, MockOFT
 * - Optimism Sepolia (40232): LenderVault, CollateralVault, MockUSDC, MockOFT
 */

// ============ CHAIN ENDPOINT IDs ============
const ARBITRUM_SEPOLIA_EID = EndpointId.ARBSEP_V2_TESTNET; // 40231
const SEPOLIA_EID = EndpointId.SEPOLIA_V2_TESTNET; // 40161
const OPTIMISM_SEPOLIA_EID = EndpointId.OPTSEP_V2_TESTNET; // 40232

// ============ ARBITRUM SEPOLIA (Main Protocol) ============
const arbitrumSepoliaContracts = {
  protocolCore: {
    eid: ARBITRUM_SEPOLIA_EID,
    contractName: "ProtocolCore",
    description: "Main lending/borrowing protocol",
  },
  mockUSDC: {
    eid: ARBITRUM_SEPOLIA_EID,
    contractName: "MockUSDC",
    description: "Local MockUSDC token for Arbitrum Sepolia",
  },
  mockOFT: {
    eid: ARBITRUM_SEPOLIA_EID,
    contractName: "MockOFT",
    description: "Cross-chain bridge for MockUSDC from Arbitrum Sepolia",
  },
};

// ============ SEPOLIA ============
const sepoliaContracts = {
  lenderVault: {
    eid: SEPOLIA_EID,
    contractName: "LenderVault",
    description: "Vault for lenders to deposit MockUSDC and send to ProtocolCore",
  },
  collateralVault: {
    eid: SEPOLIA_EID,
    contractName: "CollateralVault",
    description: "Vault for borrowers to deposit native tokens (ETH, etc.)",
  },
  mockUSDC: {
    eid: SEPOLIA_EID,
    contractName: "MockUSDC",
    description: "Local MockUSDC token for Sepolia",
  },
  mockOFT: {
    eid: SEPOLIA_EID,
    contractName: "MockOFT",
    description: "Cross-chain bridge for MockUSDC from Sepolia",
  },
};

// ============ OPTIMISM SEPOLIA ============
const optimismSepoliaContracts = {
  lenderVault: {
    eid: OPTIMISM_SEPOLIA_EID,
    contractName: "LenderVault",
    description: "Vault for lenders to deposit MockUSDC and send to ProtocolCore",
  },
  collateralVault: {
    eid: OPTIMISM_SEPOLIA_EID,
    contractName: "CollateralVault",
    description: "Vault for borrowers to deposit native tokens (ETH, etc.)",
  },
  mockUSDC: {
    eid: OPTIMISM_SEPOLIA_EID,
    contractName: "MockUSDC",
    description: "Local MockUSDC token for Optimism Sepolia",
  },
  mockOFT: {
    eid: OPTIMISM_SEPOLIA_EID,
    contractName: "MockOFT",
    description: "Cross-chain bridge for MockUSDC from Optimism Sepolia",
  },
};

// ============ OFT CONFIGURATION ============
// MockOFT connections for cross-chain MockUSDC transfers
// Each chain has its own MockUSDC, but they can bridge to each other
export const oftConfig = {
  contracts: [
    { contract: arbitrumSepoliaContracts.mockOFT },
    { contract: sepoliaContracts.mockOFT },
    { contract: optimismSepoliaContracts.mockOFT },
  ],
  connections: [
    // Arbitrum Sepolia ↔ Sepolia
    {
      from: arbitrumSepoliaContracts.mockOFT,
      to: sepoliaContracts.mockOFT,
    },
    {
      from: sepoliaContracts.mockOFT,
      to: arbitrumSepoliaContracts.mockOFT,
    },
    // Arbitrum Sepolia ↔ Optimism Sepolia
    {
      from: arbitrumSepoliaContracts.mockOFT,
      to: optimismSepoliaContracts.mockOFT,
    },
    {
      from: optimismSepoliaContracts.mockOFT,
      to: arbitrumSepoliaContracts.mockOFT,
    },
    // Sepolia ↔ Optimism Sepolia
    {
      from: sepoliaContracts.mockOFT,
      to: optimismSepoliaContracts.mockOFT,
    },
    {
      from: optimismSepoliaContracts.mockOFT,
      to: sepoliaContracts.mockOFT,
    },
  ],
};

// ============ OAPP CONFIGURATION ============
// OApp connections for cross-chain messaging
export const oappConfig = {
  contracts: [
    // Arbitrum Sepolia
    { contract: arbitrumSepoliaContracts.protocolCore },
    // Sepolia
    { contract: sepoliaContracts.lenderVault },
    { contract: sepoliaContracts.collateralVault },
    // Optimism Sepolia
    { contract: optimismSepoliaContracts.lenderVault },
    { contract: optimismSepoliaContracts.collateralVault },
  ],
  connections: [
    // ============ LENDER DEPOSITS ============
    // Sepolia LenderVault → Arbitrum ProtocolCore
    {
      from: sepoliaContracts.lenderVault,
      to: arbitrumSepoliaContracts.protocolCore,
      description: "Lenders deposit MockUSDC on Sepolia, ProtocolCore receives on Arbitrum",
    },
    // Optimism Sepolia LenderVault → Arbitrum ProtocolCore
    {
      from: optimismSepoliaContracts.lenderVault,
      to: arbitrumSepoliaContracts.protocolCore,
      description: "Lenders deposit MockUSDC on Optimism, ProtocolCore receives on Arbitrum",
    },
    // ProtocolCore → LenderVault (confirmations)
    {
      from: arbitrumSepoliaContracts.protocolCore,
      to: sepoliaContracts.lenderVault,
      description: "ProtocolCore sends deposit confirmation to Sepolia LenderVault",
    },
    {
      from: arbitrumSepoliaContracts.protocolCore,
      to: optimismSepoliaContracts.lenderVault,
      description: "ProtocolCore sends deposit confirmation to Optimism LenderVault",
    },

    // ============ COLLATERAL UPDATES ============
    // Sepolia CollateralVault → Arbitrum ProtocolCore
    {
      from: sepoliaContracts.collateralVault,
      to: arbitrumSepoliaContracts.protocolCore,
      description: "Borrowers deposit native tokens on Sepolia, ProtocolCore updates collateral on Arbitrum",
    },
    // Optimism Sepolia CollateralVault → Arbitrum ProtocolCore
    {
      from: optimismSepoliaContracts.collateralVault,
      to: arbitrumSepoliaContracts.protocolCore,
      description: "Borrowers deposit native tokens on Optimism, ProtocolCore updates collateral on Arbitrum",
    },
    // ProtocolCore → CollateralVault (withdrawal approvals)
    {
      from: arbitrumSepoliaContracts.protocolCore,
      to: sepoliaContracts.collateralVault,
      description: "ProtocolCore approves collateral withdrawal on Sepolia after loan repayment",
    },
    {
      from: arbitrumSepoliaContracts.protocolCore,
      to: optimismSepoliaContracts.collateralVault,
      description: "ProtocolCore approves collateral withdrawal on Optimism after loan repayment",
    },
  ],
};

// ============ MESSAGE TYPES ============
export const MessageTypes = {
  // Lender deposits
  LENDER_DEPOSIT: 1, // From LenderVault to ProtocolCore
  LENDER_DEPOSIT_CONFIRMATION: 2, // From ProtocolCore to LenderVault

  // Collateral updates
  COLLATERAL_UPDATE: 3, // From CollateralVault to ProtocolCore
  COLLATERAL_WITHDRAWAL_APPROVAL: 4, // From ProtocolCore to CollateralVault
} as const;

// ============ CHAIN CONFIGURATION SUMMARY ============
export const chainConfig = {
  arbitrumSepolia: {
    eid: ARBITRUM_SEPOLIA_EID,
    chainId: 421614,
    contracts: arbitrumSepoliaContracts,
    role: "Main Protocol",
  },
  sepolia: {
    eid: SEPOLIA_EID,
    chainId: 11155111,
    contracts: sepoliaContracts,
    role: "Satellite Chain (Lenders & Borrowers)",
  },
  optimismSepolia: {
    eid: OPTIMISM_SEPOLIA_EID,
    chainId: 11155420,
    contracts: optimismSepoliaContracts,
    role: "Satellite Chain (Lenders & Borrowers)",
  },
} as const;

// ============ DEPLOYMENT ORDER ============
/**
 * Recommended deployment order:
 * 
 * 1. Deploy MockUSDC on all chains
 * 2. Deploy MockOFT on all chains
 * 3. Configure MockOFT peers between all chains
 * 4. Deploy ProtocolCore on Arbitrum Sepolia
 * 5. Deploy LenderVault on Sepolia and Optimism Sepolia
 * 6. Deploy CollateralVault on Sepolia and Optimism Sepolia
 * 7. Configure ProtocolCore peers:
 *    - Authorize LenderVaults (Sepolia, Optimism)
 *    - Authorize CollateralVaults (Sepolia, Optimism)
 * 8. Configure LenderVault peers:
 *    - Set ProtocolCore peer on Arbitrum Sepolia
 * 9. Configure CollateralVault peers:
 *    - Set ProtocolCore peer on Arbitrum Sepolia
 */

// Export default config
export default oappConfig;
