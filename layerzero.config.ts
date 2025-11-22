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

const baseSepoliaContracts = {
  lendingPool: {
    eid: EndpointId.BASESEP_V2_TESTNET, // 40245
    contractName: "LendingPool",
  },
  creditScore: {
    eid: EndpointId.BASESEP_V2_TESTNET,
    contractName: "ContinuousCreditScore",
  },
  usdcOmnitoken: {
    eid: EndpointId.BASESEP_V2_TESTNET,
    contractName: "USDCOmnitoken",
  },
  coordinator: {
    eid: EndpointId.BASESEP_V2_TESTNET,
    contractName: "CrossChainCoordinator",
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

const optimismSepoliaContracts = {
  collateralVault: {
    eid: EndpointId.OPTSEP_V2_TESTNET, // 40232
    contractName: "CollateralVault",
  },
  usdcOmnitoken: {
    eid: EndpointId.OPTSEP_V2_TESTNET,
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
    { contract: baseSepoliaContracts.usdcOmnitoken },
    { contract: arbitrumSepoliaContracts.usdcOmnitoken },
    { contract: optimismSepoliaContracts.usdcOmnitoken },
  ],
  connections: [
    // Ethereum Sepolia (OFTAdapter) ↔ All other chains (OFT)
    {
      from: sepoliaContracts.usdcAdapter,
      to: baseSepoliaContracts.usdcOmnitoken,
      config: {
        sendLibrary: "0x...", // To be filled
        receiveLibraryConfig: {
          receiveLibrary: "0x...",
          gracePeriod: 0,
        },
        sendConfig: {
          executorConfig: {
            maxMessageSize: 10000,
            executor: "0x...",
          },
          ulnConfig: {
            confirmations: 15,
            requiredDVNs: [], // Fill with actual DVN addresses
            optionalDVNs: [],
            optionalDVNThreshold: 0,
          },
        },
      },
    },
    {
      from: sepoliaContracts.usdcAdapter,
      to: arbitrumSepoliaContracts.usdcOmnitoken,
    },
    {
      from: sepoliaContracts.usdcAdapter,
      to: optimismSepoliaContracts.usdcOmnitoken,
    },
  ],
};

// OApp Configuration - Cross-Chain Collateral Messaging
export const oappConfig = {
  contracts: [
    { contract: sepoliaContracts.collateralVault },
    { contract: baseSepoliaContracts.coordinator },
    { contract: arbitrumSepoliaContracts.collateralVault },
    { contract: optimismSepoliaContracts.collateralVault },
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
