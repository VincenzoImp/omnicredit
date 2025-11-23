import { EndpointId } from "@layerzerolabs/lz-definitions";

// LayerZero V2 Configuration for OmniCredit
// This configures cross-chain messaging for OFT tokens and OApp contracts

// Define contract deployment points for each chain
const sepoliaContracts = {
  collateralVault: {
    eid: EndpointId.SEPOLIA_V2_TESTNET, // 40161
    contractName: "CollateralVault",
  },
  usdcAdapter: {
    eid: EndpointId.SEPOLIA_V2_TESTNET,
    contractName: "USDCOFTAdapter",
  },
};

const arbitrumSepoliaContracts = {
  collateralVault: {
    eid: EndpointId.ARBSEP_V2_TESTNET, // 40231
    contractName: "CollateralVault",
  },
  usdcOmnitoken: {
    eid: EndpointId.ARBSEP_V2_TESTNET,
    contractName: "USDCOmnitoken",
  },
};

// DVN (Decentralized Verifier Network) Addresses for Testnets
// These provide cross-chain message verification
const TESTNET_DVNS = {
  layerzeroLabs: "0x...", // To be filled with actual testnet DVN addresses
  googleCloud: "0x...",
  polyhedra: "0x...",
};

// OFT Configuration - Unified USDC Liquidity
export const oftConfig = {
  contracts: [
    { contract: sepoliaContracts.usdcAdapter },
    { contract: arbitrumSepoliaContracts.usdcOmnitoken },
  ],
  connections: [
    // Ethereum Sepolia (OFTAdapter) ↔ All other chains (OFT)
    {
      from: sepoliaContracts.usdcAdapter,
      to: arbitrumSepoliaContracts.usdcOmnitoken,
    }
  ],
};

// OApp Configuration - Cross-Chain Collateral Messaging
export const oappConfig = {
  contracts: [
    { contract: sepoliaContracts.collateralVault },
    { contract: arbitrumSepoliaContracts.collateralVault },
  ],
  connections: [
    // All CollateralVaults ↔ Base Coordinator
    {
      from: sepoliaContracts.collateralVault,
      to: baseSepoliaContracts.coordinator,
    },
    {
      from: baseSepoliaContracts.coordinator,
      to: sepoliaContracts.collateralVault,
    },
    {
      from: arbitrumSepoliaContracts.collateralVault,
      to: baseSepoliaContracts.coordinator,
    },
    {
      from: baseSepoliaContracts.coordinator,
      to: arbitrumSepoliaContracts.collateralVault,
    },
    {
      from: optimismSepoliaContracts.collateralVault,
      to: baseSepoliaContracts.coordinator,
    },
    {
      from: baseSepoliaContracts.coordinator,
      to: optimismSepoliaContracts.collateralVault,
    },
  ],
};

// Export default config (can be OFT or OApp depending on deployment)
export default oftConfig;
