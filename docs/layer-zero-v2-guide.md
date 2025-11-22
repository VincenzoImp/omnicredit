# LayerZero V2 Hackathon: Complete Technical Guide for Omnichain Development

**LayerZero V2 represents the next generation of omnichain interoperability**, enabling applications that operate natively across 150+ blockchains with modular architecture, configurable security, and censorship-resistant delivery guarantees. This guide provides everything you need to build winning omnichain applications during the hackathon.

## Table of Contents

1. [LayerZero V2 Architecture](#layerzero-v2-architecture-protocol-fundamentals)
2. [OFT: Omnichain Fungible Tokens](#oft-omnichain-fungible-tokens)
3. [OApp: Omnichain Applications](#oapp-omnichain-applications)
4. [ONFT: Omnichain NFTs](#onft-omnichain-nfts)
5. [Development Setup](#development-setup-from-zero-to-deployment-in-10-minutes)
6. [Deployment Workflow](#deployment-workflow-4-steps-to-go-live)
7. [Testing Cross-Chain Functionality](#testing-ensuring-cross-chain-functionality)
8. [Gas Optimization](#gas-optimization-reducing-cross-chain-costs)
9. [Innovative Use Cases](#innovative-use-cases-for-hackathon)
10. [Security Best Practices](#security-best-practices-building-secure-applications)
11. [Debugging](#debugging-identifying-and-resolving-issues)
12. [Resources & References](#official-resources-complete-list)

---

## LayerZero V2 Architecture: Protocol Fundamentals

LayerZero V2 separates the protocol into three distinct layers that guarantee maximum flexibility and security. The **Protocol Layer** contains immutable contracts (Endpoint + MessageLib registry) that can never be modified, providing long-term security guarantees. The **Standards Layer** defines universal interfaces (OApp, OFT, ONFT) usable on any blockchain. The **Infrastructure Layer** is completely permissionless and configurable, with DVNs (Decentralized Verifier Networks) and Executors that can be freely chosen by each application.

### How Cross-Chain Messaging Works

When you send a message from chain A to chain B, the flow is:

1. Your OApp calls `_lzSend()` on the source chain's Endpoint
2. The Endpoint assigns an incremental nonce, generates a unique GUID, and emits a `PacketSent` event
3. Configured DVNs listen to the event, independently verify the packet on the source chain, and commit the payload hash on the destination chain
4. Once the security threshold is satisfied (X of Y of N DVNs), the packet is marked VERIFIED
5. An Executor (or anyone) calls `lzReceive()` on the destination Endpoint which executes your custom logic

**Protocol Guarantees**:
- **Censorship resistance**: All verified messages must be executable
- **Exactly-once delivery**: The nonce system prevents replay attacks
- **Lossless channel**: No message can be lost once verified
- **Eventual liveness**: Anyone can execute verified messages
- **Immutability**: Core contracts never change

### Endpoint Contracts: Entry Point for Every Chain

Endpoints are immutable smart contracts deployed once per chain that serve as the entry/exit point for all cross-chain messages. Each Endpoint has a unique **Endpoint ID (EID)** – don't confuse with native chainId. EIDs follow the schema: mainnet = 30xxx series, testnet = 40xxx series.

```solidity
// Endpoint interface for sending messages
function send(
    uint32 _dstEid,           // Destination endpoint ID
    bytes calldata _message,   // Encoded message payload  
    bytes calldata _options,   // Execution options (gas, value)
    MessagingFee memory _fee,  // Fee structure
    address payable _refundAddress
) external payable;

// Endpoint interface for receiving messages
function lzReceive(
    Origin calldata _origin,   // Source chain info
    bytes32 _guid,             // Global unique identifier
    bytes calldata _message,   // Message payload
    address _executor,         // Executor address
    bytes calldata _extraData  // Additional data
) external payable;
```

### DVNs and Security Stack: Total Control Over Security

The true innovation of LayerZero V2 is **modular security**. Instead of a shared security model, each application configures its own Decentralized Verifier Networks (DVNs). You can choose X-of-Y-of-N configurations: for example "1 required + 2 of 5 optional" means 1 REQUIRED DVN (e.g., LayerZero Labs) MUST verify PLUS at least 2 of 5 optional DVNs (Google Cloud, Polyhedra, Axelar, Chainlink CCIP, Wormhole).

**Available DVNs include**:
- **Oracle-based**: Google Cloud, LayerZero Labs
- **ZK-based**: Polyhedra zkLightClient
- **Bridge Adapters**: Axelar, Chainlink CCIP, Wormhole
- **Decentralized**: EigenLayer-backed with slashing
- **Custom**: You can build and run your own DVN

---

## OFT: Omnichain Fungible Tokens

**OFT is the standard for natively omnichain fungible tokens**. The critical difference from wrapped tokens:
- **Wrapped tokens**: Lock on source chain and mint a wrapped version on destination (fragmented liquidity)
- **OFT**: Burns on source and mints on destination maintaining a **unified global supply**

### Basic OFT Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";

contract MyOFT is OFT {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _owner
    ) OFT(_name, _symbol, _lzEndpoint, _owner) Ownable(_owner) {
        // Mint initial supply
        _mint(_owner, 1_000_000 * 10 ** decimals());
    }
}
```

### Sending Tokens Cross-Chain

```solidity
// 1. QUOTE - Get fee estimate
MessagingFee memory fee = oft.quoteSend(
    SendParam({
        dstEid: 30110,              // Arbitrum mainnet
        to: addressToBytes32(recipient),
        amountLD: 1000 * 10**18,    // 1000 tokens
        minAmountLD: 950 * 10**18,  // 5% slippage
        extraOptions: "0x",
        composeMsg: "",
        oftCmd: ""
    }),
    false
);

// 2. SEND - Execute transfer
oft.send{value: fee.nativeFee}(sendParam, fee, msg.sender);
```

### OFT vs OFTAdapter: When to Use Which

**Use OFT** when creating a NEW token that will be omnichain from launch:
- Deploy the OFT contract on ALL chains where you want the token to exist
- Mechanism: burn on source → mint on destination

**Use OFTAdapter** when you have an EXISTING ERC20 token you want to make omnichain:
- Deploy ONE OFTAdapter on the token's original chain + standard OFT on other chains
- Mechanism: lock/unlock on original chain, burn/mint on other chains

⚠️ **CRITICAL**: Only ONE OFTAdapter per token globally! Multiple adapters cause race conditions and permanent token loss.

### Key Internal Methods for Custom Logic

```solidity
// Override to add custom logic on debit
function _debit(
    address _from,
    uint256 _amountLD,
    uint256 _minAmountLD,
    uint32 _dstEid
) internal virtual override returns (uint256 amountSentLD, uint256 amountReceivedLD) {
    // Add your custom logic here (rate limiting, fees, etc.)
    return super._debit(_from, _amountLD, _minAmountLD, _dstEid);
}

// Override to add custom logic on credit
function _credit(
    address _to,
    uint256 _amountLD,
    uint32 _srcEid
) internal virtual override returns (uint256 amountReceivedLD) {
    // Add your custom logic here
    return super._credit(_to, _amountLD, _srcEid);
}
```

---

## OApp: Omnichain Applications

**OApp is the base interface for any omnichain application**. While OFT is specialized for tokens, OApp allows you to send arbitrary data between chains for any use case: cross-chain governance, gaming state synchronization, DeFi protocols, identity systems, etc.

### Complete OApp Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OApp, Origin, MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

contract MyOApp is OApp, OAppOptionsType3 {
    using OptionsBuilder for bytes;
    
    string public lastMessage;
    uint16 public constant SEND = 1;
    uint16 public constant SEND_ABA = 2;  // For ABA pattern

    constructor(address _endpoint, address _owner) 
        OApp(_endpoint, _owner) Ownable(_owner) {}
    
    /**
     * @notice Send message to destination chain
     * @param _dstEid Destination endpoint ID
     * @param _message The message to send
     * @param _options Execution options (gas limit, msg.value)
     */
    function sendMessage(
        uint32 _dstEid,
        string calldata _message,
        bytes calldata _options
    ) external payable {
        bytes memory payload = abi.encode(_message);
        
        _lzSend(
            _dstEid,
            payload,
            _options,
            MessagingFee(msg.value, 0),
            payable(msg.sender)
        );
    }
    
    /**
     * @dev Override this method with your business logic
     * @param _origin Info about source chain (srcEid, sender, nonce)
     * @param _message The received message payload
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        // Decode and process the message
        string memory receivedMessage = abi.decode(_message, (string));
        lastMessage = receivedMessage;
        
        // Add your custom logic here
        // Example: update state, emit events, trigger actions
    }
    
    /**
     * @notice Quote fee for sending message
     */
    function quote(
        uint32 _dstEid,
        string calldata _message,
        bytes calldata _options
    ) public view returns (MessagingFee memory fee) {
        bytes memory payload = abi.encode(_message);
        fee = _quote(_dstEid, payload, _options, false);
    }
}
```

### Message Options: Configuring Gas and Execution

Options define how the message will be executed on the destination chain. Insufficient gas limit = failed execution.

```solidity
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

contract MyOApp is OApp {
    using OptionsBuilder for bytes;
    
    function sendWithOptions(uint32 _dstEid, string memory _message) external payable {
        // Build options with gas limit
        bytes memory options = OptionsBuilder
            .newOptions()
            .addExecutorLzReceiveOption(200000, 0)  // 200k gas, 0 msg.value
            .toBytes();
            
        bytes memory payload = abi.encode(_message);
        _lzSend(_dstEid, payload, options, MessagingFee(msg.value, 0), payable(msg.sender));
    }
    
    // For composed messages
    function sendWithCompose(uint32 _dstEid, bytes memory _composeMsg) external payable {
        bytes memory options = OptionsBuilder
            .newOptions()
            .addExecutorLzReceiveOption(100000, 0)      // Gas for lzReceive
            .addExecutorLzComposeOption(0, 500000, 0)   // Gas for lzCompose
            .toBytes();
            
        // ... send logic
    }
}
```

### Advanced OApp Patterns

**ABA Pattern (Ping-Pong)**: Message goes from A → B, then B automatically responds by sending message back to A.

```solidity
function _lzReceive(
    Origin calldata _origin,
    bytes32,
    bytes calldata _message,
    address,
    bytes calldata
) internal override {
    (string memory data, uint16 msgType, bytes memory returnOptions) = 
        abi.decode(_message, (string, uint16, bytes));
    
    lastMessage = data;
    
    if (msgType == SEND_ABA) {
        // Send automatic response to source chain
        bytes memory responsePayload = abi.encode("Response", SEND, "");
        _lzSend(
            _origin.srcEid,  // Return to source
            responsePayload,
            returnOptions,
            MessagingFee(msg.value, 0),
            payable(address(this))
        );
    }
}
```

**Batch Send**: Send to multiple chains in one transaction.

```solidity
function batchSend(
    uint32[] memory _dstEids,
    string memory _message
) external payable {
    bytes memory encoded = abi.encode(_message);
    
    for (uint i = 0; i < _dstEids.length; i++) {
        bytes memory options = OptionsBuilder
            .newOptions()
            .addExecutorLzReceiveOption(200000, 0);
            
        MessagingFee memory fee = _quote(_dstEids[i], encoded, options, false);
        _lzSend(_dstEids[i], encoded, options, fee, payable(msg.sender));
    }
}
```

---

## ONFT: Omnichain NFTs

**ONFT enables NFT collections that exist natively on multiple chains**. When you transfer an NFT from chain A to B, it's burned on A and minted with the same tokenId on B – complete ownership without wrapping.

### ONFT721 Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { ONFT721 } from "@layerzerolabs/onft-evm/contracts/onft721/ONFT721.sol";

contract MyONFT is ONFT721 {
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) ONFT721(_name, _symbol, _lzEndpoint, _delegate) {}
    
    function mint(address _to, uint256 _tokenId) external onlyOwner {
        _mint(_to, _tokenId);
    }
}
```

### ONFT Adapter for Existing NFTs

If you already have a deployed ERC721 contract, use ONFT721Adapter on the original chain.

```solidity
import { ONFT721Adapter } from "@layerzerolabs/onft-evm/contracts/onft721/ONFT721Adapter.sol";

contract MyONFTAdapter is ONFT721Adapter {
    constructor(
        address _token,        // Existing ERC721 address
        address _lzEndpoint,
        address _delegate
    ) ONFT721Adapter(_token, _lzEndpoint, _delegate) {}
}
```

**Mechanism**: On original chain locks the NFT, on other chains burn/mint. ⚠️ Use ONLY ONE adapter on the NFT's original chain.

---

## Development Setup: From Zero to Deployment in 10 Minutes

### Initial Setup with CLI

```bash
# Create new LayerZero project
npx create-lz-oapp@latest

# The CLI wizard will ask:
# - Project name
# - Template (OApp / OFT / ONFT)
# - Package manager (pnpm / npm / yarn)

# Or create a specific type directly
npx create-lz-oapp@latest --example oft     # For tokens
npx create-lz-oapp@latest --example oapp    # For messaging
npx create-lz-oapp@latest --example onft    # For NFTs
```

### Package Installation in Existing Project

```bash
# Core packages
npm install @layerzerolabs/oapp-evm
npm install @layerzerolabs/oft-evm
npm install @layerzerolabs/onft-evm
npm install @layerzerolabs/lz-evm-protocol-v2
npm install @layerzerolabs/toolbox-hardhat

# Foundry installation
forge install layerzero-labs/devtools
forge install layerzero-labs/LayerZero-v2
forge install OpenZeppelin/openzeppelin-contracts
```

### Network Configuration (hardhat.config.ts)

```typescript
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import { EndpointId } from '@layerzerolabs/lz-definitions';

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.22",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    // Ethereum Sepolia Testnet
    'sepolia': {
      eid: EndpointId.SEPOLIA_V2_TESTNET,  // 40161
      url: process.env.RPC_URL_SEPOLIA || 'https://rpc.ankr.com/eth_sepolia',
      accounts: [process.env.PRIVATE_KEY],
    },
    // Arbitrum Sepolia
    'arbitrum-sepolia': {
      eid: EndpointId.ARBITRUM_V2_TESTNET,  // 40231
      url: process.env.RPC_URL_ARB_SEPOLIA || 'https://sepolia-rollup.arbitrum.io/rpc',
      accounts: [process.env.PRIVATE_KEY],
    },
    // Optimism Sepolia
    'optimism-sepolia': {
      eid: EndpointId.OPTSEP_V2_TESTNET,  // 40232
      url: process.env.RPC_URL_OP_SEPOLIA || 'https://sepolia.optimism.io',
      accounts: [process.env.PRIVATE_KEY],
    },
    // Base Sepolia
    'base-sepolia': {
      eid: EndpointId.BASESEP_V2_TESTNET,  // 40245
      url: process.env.RPC_URL_BASE_SEPOLIA || 'https://sepolia.base.org',
      accounts: [process.env.PRIVATE_KEY],
    },
    // Polygon Amoy
    'amoy': {
      eid: EndpointId.AMOY_V2_TESTNET,  // 40267
      url: process.env.RPC_URL_AMOY || 'https://rpc-amoy.polygon.technology',
      accounts: [process.env.PRIVATE_KEY],
    },
    // Avalanche Fuji
    'avalanche-fuji': {
      eid: EndpointId.AVALANCHE_V2_TESTNET,  // 40106
      url: process.env.RPC_URL_FUJI || 'https://api.avax-test.network/ext/bc/C/rpc',
      accounts: [process.env.PRIVATE_KEY],
    },
    // BSC Testnet
    'bsc-testnet': {
      eid: EndpointId.BSC_V2_TESTNET,  // 40102
      url: process.env.RPC_URL_BSC || 'https://data-seed-prebsc-1-s1.binance.org:8545',
      accounts: [process.env.PRIVATE_KEY],
    },
  }
};

export default config;
```

### LayerZero Configuration (layerzero.config.ts)

```typescript
import { EndpointId } from '@layerzerolabs/lz-definitions';
import type { OAppOmniGraphHardhat, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat';

// Define contract deployment points
const sepoliaContract: OmniPointHardhat = {
  eid: EndpointId.SEPOLIA_V2_TESTNET,
  contractName: 'MyOApp',
};

const arbitrumContract: OmniPointHardhat = {
  eid: EndpointId.ARBITRUM_V2_TESTNET,
  contractName: 'MyOApp',
};

const optimismContract: OmniPointHardhat = {
  eid: EndpointId.OPTSEP_V2_TESTNET,
  contractName: 'MyOApp',
};

// Define complete configuration
const config: OAppOmniGraphHardhat = {
  contracts: [
    { contract: sepoliaContract },
    { contract: arbitrumContract },
    { contract: optimismContract },
  ],
  connections: [
    // Sepolia ↔ Arbitrum
    { from: sepoliaContract, to: arbitrumContract },
    { from: arbitrumContract, to: sepoliaContract },
    // Sepolia ↔ Optimism
    { from: sepoliaContract, to: optimismContract },
    { from: optimismContract, to: sepoliaContract },
    // Arbitrum ↔ Optimism
    { from: arbitrumContract, to: optimismContract },
    { from: optimismContract, to: arbitrumContract },
  ],
};

export default config;
```

### Environment Variables (.env)

```bash
# Private key (NEVER commit to git!)
PRIVATE_KEY=your_private_key_here

# RPC URLs (optional but recommended)
RPC_URL_SEPOLIA=https://eth-sepolia.g.alchemy.com/v2/your-api-key
RPC_URL_ARB_SEPOLIA=https://arb-sepolia.g.alchemy.com/v2/your-api-key
RPC_URL_OP_SEPOLIA=https://opt-sepolia.g.alchemy.com/v2/your-api-key
RPC_URL_BASE_SEPOLIA=https://base-sepolia.g.alchemy.com/v2/your-api-key
RPC_URL_AMOY=https://polygon-amoy.g.alchemy.com/v2/your-api-key
RPC_URL_FUJI=https://api.avax-test.network/ext/bc/C/rpc
RPC_URL_BSC=https://data-seed-prebsc-1-s1.binance.org:8545

# Etherscan API keys for verification
ETHERSCAN_API_KEY=your_etherscan_key
ARBISCAN_API_KEY=your_arbiscan_key
```

---

## Deployment Workflow: 4 Steps to Go Live

### Step 1: Deploy Contracts on Multiple Chains

```bash
# Deploy with CLI (interactive)
npx hardhat lz:deploy

# Select networks when prompted
# ✔ Which networks? › sepolia, arbitrum-sepolia, optimism-sepolia

# Output:
# Deployed contract: MyOApp
# Network: sepolia, Address: 0xC7c2c92b55342Df0c7F51D4dE3f02167466FacCC
# Network: arbitrum-sepolia, Address: 0x0538A4ED0844583d876c29f80fB97c0f747968ce
# Network: optimism-sepolia, Address: 0x1a2b3c4d5e6f7890abcdef1234567890abcdef12
```

### Step 2: Wire Contracts (Set Peers)

Wiring configures relationships between contracts on different chains. Each OApp must "know" the address of its peers on other chains.

```bash
# Wire automatically using config
npx hardhat lz:oapp:wire --oapp-config layerzero.config.ts

# This sets bidirectional peers for all defined connections
```

### Step 3: Verify Configuration

```bash
# Check peer configuration
npx hardhat lz:oapp:peers:get --oapp-config layerzero.config.ts

# Output shows peer table:
# ┌─────────────┬─────────┬──────────┬──────────┐
# │ from → to   │ sepolia │ arbitrum │ optimism │
# ├─────────────┼─────────┼──────────┼──────────┤
# │ sepolia     │ ∅       │ ✓        │ ✓        │
# │ arbitrum    │ ✓       │ ∅        │ ✓        │
# │ optimism    │ ✓       │ ✓        │ ∅        │
# └─────────────┴─────────┴──────────┴──────────┘

# Check DVN configuration
npx hardhat lz:oapp:config:get --oapp-config layerzero.config.ts
```

### Step 4: Send Test Message

Create a Hardhat task for testing (tasks/sendMessage.ts):

```typescript
import { task } from 'hardhat/config';
import { Options } from '@layerzerolabs/lz-v2-utilities';

task('send-message', 'Send cross-chain message')
  .addParam('dstNetwork', 'Destination network')
  .addParam('message', 'Message to send')
  .setAction(async (taskArgs, hre) => {
    const { message, dstNetwork } = taskArgs;
    const [signer] = await hre.ethers.getSigners();
    
    // Get destination EID
    const dstEid = hre.config.networks[dstNetwork].eid;
    
    // Get deployed contract
    const deployment = await hre.deployments.get('MyOApp');
    const myOApp = await hre.ethers.getContractAt('MyOApp', deployment.address, signer);
    
    // Build options
    const options = Options.newOptions()
      .addExecutorLzReceiveOption(200000, 0)
      .toBytes();
    
    // Quote fee
    const fee = await myOApp.quote(dstEid, message, options, false);
    console.log(`Fee: ${hre.ethers.utils.formatEther(fee.nativeFee)} ETH`);
    
    // Send message
    const tx = await myOApp.sendMessage(dstEid, message, options, { 
      value: fee.nativeFee 
    });
    const receipt = await tx.wait();
    
    console.log('✅ Message sent!');
    console.log('TX:', receipt.transactionHash);
    console.log('Track:', `https://testnet.layerzeroscan.com/tx/${receipt.transactionHash}`);
  });
```

Run the task:

```bash
npx hardhat send-message \
  --network sepolia \
  --dst-network arbitrum-sepolia \
  --message "Hello from Sepolia to Arbitrum!"
```

---

## Testing: Ensuring Cross-Chain Functionality

### Foundry Testing with TestHelper

LayerZero provides TestHelper that simulates mock endpoints for fast local testing.

```solidity
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Test } from "forge-std/Test.sol";
import { TestHelperOz5 } from "@layerzerolabs/test-devtools-evm-foundry/contracts/TestHelperOz5.sol";
import { OptionsBuilder } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import { MyOApp } from "../src/MyOApp.sol";

contract MyOAppTest is TestHelperOz5 {
    using OptionsBuilder for bytes;

    MyOApp public oappA;
    MyOApp public oappB;
    
    uint32 aEid = 1;  // Mock EID for chain A
    uint32 bEid = 2;  // Mock EID for chain B

    function setUp() public override {
        super.setUp();
        
        // Setup 2 mock endpoints
        setUpEndpoints(2, LibraryType.UltraLightNode);
        
        // Deploy OApps on both chains
        oappA = MyOApp(
            _deployOApp(
                type(MyOApp).creationCode, 
                abi.encode(address(endpoints[aEid]), address(this))
            )
        );
        
        oappB = MyOApp(
            _deployOApp(
                type(MyOApp).creationCode, 
                abi.encode(address(endpoints[bEid]), address(this))
            )
        );
        
        // Wire OApps (set peers)
        address[] memory oapps = new address[](2);
        oapps[0] = address(oappA);
        oapps[1] = address(oappB);
        this.wireOApps(oapps);
    }

    function test_SendMessage() public {
        string memory message = "Hello LayerZero";
        bytes memory options = OptionsBuilder
            .newOptions()
            .addExecutorLzReceiveOption(200000, 0);
        
        // Quote fee
        MessagingFee memory fee = oappA.quote(bEid, message, options, false);
        
        // Send message from A to B
        vm.deal(address(this), 1 ether);
        oappA.sendMessage{value: fee.nativeFee}(bEid, message, options);
        
        // Verify packet delivery
        verifyPackets(bEid, addressToBytes32(address(oappB)));
        
        // Check received data
        assertEq(oappB.lastMessage(), message);
    }
    
    function test_BidirectionalMessage() public {
        bytes memory options = OptionsBuilder
            .newOptions()
            .addExecutorLzReceiveOption(200000, 0);
        
        // A → B
        string memory msgAB = "A to B";
        MessagingFee memory feeAB = oappA.quote(bEid, msgAB, options, false);
        vm.deal(address(this), 1 ether);
        oappA.sendMessage{value: feeAB.nativeFee}(bEid, msgAB, options);
        verifyPackets(bEid, addressToBytes32(address(oappB)));
        assertEq(oappB.lastMessage(), msgAB);
        
        // B → A
        string memory msgBA = "B to A";
        MessagingFee memory feeBA = oappB.quote(aEid, msgBA, options, false);
        oappB.sendMessage{value: feeBA.nativeFee}(aEid, msgBA, options);
        verifyPackets(aEid, addressToBytes32(address(oappA)));
        assertEq(oappA.lastMessage(), msgBA);
    }
}
```

Run tests:

```bash
# Run Foundry tests
forge test -vvv

# With gas reporting
forge test --gas-report

# Specific test
forge test --match-test test_SendMessage -vvv
```

### Hardhat Testing

```typescript
import { expect } from 'chai';
import { ethers, deployments } from 'hardhat';
import { Options } from '@layerzerolabs/lz-v2-utilities';

describe('MyOApp Cross-Chain Tests', function () {
  let myOAppA, myOAppB;
  let mockEndpointA, mockEndpointB;
  const eidA = 1;
  const eidB = 2;

  beforeEach(async function () {
    const [owner] = await ethers.getSigners();
    
    // Deploy mock endpoints
    const EndpointV2Mock = await ethers.getContractFactory('EndpointV2Mock');
    mockEndpointA = await EndpointV2Mock.deploy(eidA);
    mockEndpointB = await EndpointV2Mock.deploy(eidB);
    
    // Deploy OApps
    const MyOApp = await ethers.getContractFactory('MyOApp');
    myOAppA = await MyOApp.deploy(mockEndpointA.address, owner.address);
    myOAppB = await MyOApp.deploy(mockEndpointB.address, owner.address);
    
    // Set peers
    await myOAppA.setPeer(eidB, ethers.utils.zeroPad(myOAppB.address, 32));
    await myOAppB.setPeer(eidA, ethers.utils.zeroPad(myOAppA.address, 32));
    
    // Configure mock endpoints
    await mockEndpointA.setDestLzEndpoint(myOAppB.address, mockEndpointB.address);
    await mockEndpointB.setDestLzEndpoint(myOAppA.address, mockEndpointA.address);
  });

  it('should send and receive messages correctly', async function () {
    const message = 'Test message';
    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toBytes();
    
    const fee = await myOAppA.quote(eidB, message, options, false);
    await myOAppA.sendMessage(eidB, message, options, { value: fee.nativeFee });
    
    expect(await myOAppB.lastMessage()).to.equal(message);
  });

  it('should handle multiple messages in sequence', async function () {
    const messages = ['First', 'Second', 'Third'];
    const options = Options.newOptions().addExecutorLzReceiveOption(200000, 0).toBytes();
    
    for (const msg of messages) {
      const fee = await myOAppA.quote(eidB, msg, options, false);
      await myOAppA.sendMessage(eidB, msg, options, { value: fee.nativeFee });
      expect(await myOAppB.lastMessage()).to.equal(msg);
    }
  });
});
```

---

## Gas Optimization: Reducing Cross-Chain Costs

### 1. Accurate Gas Estimation

Always quote before sending to avoid over/under payment:

```solidity
function sendOptimized(uint32 _dstEid, string memory _message) external payable {
    bytes memory options = OptionsBuilder.newOptions()
        .addExecutorLzReceiveOption(200000, 0);
    
    bytes memory payload = abi.encode(_message);
    
    // Get exact quote
    MessagingFee memory fee = _quote(_dstEid, payload, options, false);
    
    // Check user paid enough
    require(msg.value >= fee.nativeFee, "Insufficient fee");
    
    // Send with exact fee
    _lzSend(_dstEid, payload, options, fee, payable(msg.sender));
    
    // Refund excess
    uint256 excess = msg.value - fee.nativeFee;
    if (excess > 0) {
        payable(msg.sender).transfer(excess);
    }
}
```

### 2. Optimize Payload Size

Smaller payload = lower gas. Use efficient encoding:

```solidity
// ❌ BAD: Large payload
struct LargeData {
    string description;      // Variable size
    uint256[] values;        // Array
    address[] recipients;    // Array
}

// ✅ GOOD: Compact payload
struct CompactData {
    bytes32 descriptionHash; // Fixed 32 bytes
    uint96 value;            // Smaller uint if range permits
    address recipient;       // Single address
}

// Optimized encoding
bytes memory payload = abi.encodePacked(
    descriptionHash,  // 32 bytes
    value,            // 12 bytes
    recipient         // 20 bytes
);  // Total: 64 bytes instead of hundreds
```

### 3. Use Enforced Options

Set minimum options at contract level to ensure sufficient gas and prevent failed executions:

```solidity
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";

contract MyOApp is OApp, OAppOptionsType3 {
    constructor(address _endpoint, address _owner) 
        OApp(_endpoint, _owner) 
    {
        // Set enforced options in constructor or after deployment
    }
    
    function setMyEnforcedOptions(uint32 _dstEid) external onlyOwner {
        EnforcedOptionParam[] memory params = new EnforcedOptionParam[](1);
        params[0] = EnforcedOptionParam({
            eid: _dstEid,
            msgType: SEND,
            options: OptionsBuilder.newOptions()
                .addExecutorLzReceiveOption(200000, 0)
        });
        
        _setEnforcedOptions(params);
    }
}
```

### 4. Batch Operations

Instead of N separate cross-chain transactions, batch into one:

```solidity
// Instead of this (costly)
function sendMultiple(uint32 _dstEid, string[] memory _messages) external payable {
    for (uint i = 0; i < _messages.length; i++) {
        // N separate cross-chain calls = very expensive
        _lzSend(_dstEid, abi.encode(_messages[i]), ...);
    }
}

// Do this (efficient)
function sendBatch(uint32 _dstEid, string[] memory _messages) external payable {
    // Single cross-chain call with array
    bytes memory payload = abi.encode(_messages);
    _lzSend(_dstEid, payload, ...);
}

// On receiving side
function _lzReceive(..., bytes calldata _message, ...) internal override {
    string[] memory messages = abi.decode(_message, (string[]));
    // Process batch
    for (uint i = 0; i < messages.length; i++) {
        processMessage(messages[i]);
    }
}
```

### 5. Right-Size Gas Limits Per Chain

Different chains have different gas costs. Configure per chain:

```javascript
const GAS_LIMITS = {
  ETHEREUM: 200000,
  OPTIMISM: 150000,      // Cheaper
  ARBITRUM: 2000000,     // Needs higher due to gas model
  POLYGON: 300000,
  BSC: 180000,
};
```

---

## Innovative Use Cases for Hackathon

### Omnichain DeFi

**Unified Liquidity Pools**: A single liquidity pool accessible from any chain. Eliminates fragmentation – users on Ethereum, Arbitrum, Optimism access the SAME liquidity. Example: Stargate Finance with $4B+ transacted.

**Omnichain Lending**: Deposit collateral on chain A, borrow on chain B without ever moving principal. Example: Radiant Capital – deposit on Arbitrum, borrow on any of 8 chains. Maximum capital efficiency.

**Cross-Chain Yield Aggregator**: Scan yield opportunities across 50+ chains, automatically deploy capital where returns are highest. LayerZero enables seamless cross-chain rebalancing.

**Omnichain Stablecoins**: Native (not wrapped) stablecoins on all chains. Ethena's USDe uses OFT standard – burn on source, mint on destination, maintains 1:1 backing everywhere.

**Cross-Chain Governance**: DAO with voting power from tokens on multiple chains. Pendle synchronizes vePENDLE balance across chains – vote with all your tokens wherever they are.

### Gaming & NFT

**Omnichain Game Assets**: Item/character NFTs usable in games on different chains. Example: Shrapnel (Avalanche) + integration with games on other chains.

**Cross-Chain NFT Marketplace**: Marketplace showing and trading NFTs from all chains. Omni X supports trading across 8 chains – list on Ethereum, buy from Arbitrum.

**Play-to-Earn Cross-Chain**: Earn game rewards on cheap L2 (e.g., Base), spend on Ethereum mainnet. Seamless user experience.

**Interoperable Metaverse**: Avatar/land/items portable between metaverse platforms on different chains. The Sandbox + LayerZero integration.

### Identity & Social

**Omnichain Identity System**: Unique username/profile across ALL chains. LayerZero Name Service – register once, use everywhere. Alternative to ENS but natively omnichain.

**Reputation Protocol**: Reputation score accumulating actions on all chains. Trading history on Ethereum + gaming achievements on Polygon + governance on Arbitrum = unified reputation.

**Social Graph Cross-Chain**: Friend list, followers, social connections that work on any chain. Build once, works everywhere.

### Infrastructure

**Omnichain RPC**: Single RPC endpoint that automatically routes to correct chain. User doesn't even know which chain they're operating on.

**Cross-Chain Index**: Index data from multiple blockchains in real-time using LayerZero messaging for sync.

**Decentralized Oracle Network**: Oracle aggregating data from sources on multiple chains, verifies cross-chain, publishes consensus.

---

## Security Best Practices: Building Secure Applications

### Security Architecture Checklist

**✓ Configure DVNs Manually**

Don't rely on default configuration. Choose DVNs that cannot collude:

```typescript
// layerzero.config.ts
const pathwayConfig = {
  sendConfig: {
    ulnConfig: {
      confirmations: 15,  // Block confirmations
      requiredDVNs: [
        '0x...LayerZeroLabsDVN',     // Required: MUST verify
      ],
      optionalDVNs: [
        '0x...GoogleCloudDVN',        // Tech: centralized cloud
        '0x...PolyhedraDVN',          // Tech: ZK proofs
        '0x...AxelarDVN',             // Tech: decentralized validators
        '0x...ChainlinkCCIPAdapter',  // Tech: Chainlink DON
        '0x...WormholeDVN',           // Tech: Guardian network
      ],
      optionalDVNThreshold: 2  // Need 2 of 5 optional
    }
  }
};
```

Diversity is key: choose DVNs with different technology stacks, jurisdictions, incentive structures.

**✓ Set Appropriate Block Confirmations**

Different chains have different reorg risk:

```solidity
// Ethereum mainnet: 15 blocks (~3 min)
// Polygon: 128+ blocks (historical reorg of 120 blocks!)
// Arbitrum/Optimism: 20 blocks
// Avalanche: 5 blocks
// BSC: 15 blocks

// Configure per pathway
ulnConfig: {
  confirmations: 32,  // For Polygon pathway
  // ...
}
```

**✓ Implement Failed Message Handling**

Messages can fail on destination. ALWAYS implement recovery:

```solidity
contract SafeOApp is OApp {
    // Store failed messages
    mapping(bytes32 => bytes) public failedMessages;
    
    event MessageFailed(bytes32 indexed guid, bytes payload, string reason);
    event MessageRetried(bytes32 indexed guid, bool success);
    
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) internal override {
        try this.handleMessage(_origin, _guid, _message) {
            // Success
        } catch Error(string memory reason) {
            // Store for retry
            failedMessages[_guid] = _message;
            emit MessageFailed(_guid, _message, reason);
        }
    }
    
    // Public function callable to process message
    function handleMessage(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message
    ) public {
        require(msg.sender == address(this), "Internal only");
        // Your business logic here
        string memory data = abi.decode(_message, (string));
        lastMessage = data;
    }
    
    // Retry failed message
    function retryMessage(bytes32 _guid) external {
        bytes memory message = failedMessages[_guid];
        require(message.length > 0, "Message not found");
        
        delete failedMessages[_guid];
        
        // Retry processing
        (bool success,) = address(this).call(
            abi.encodeWithSelector(
                this.handleMessage.selector,
                Origin(0, bytes32(0), 0),  // Dummy origin
                _guid,
                message
            )
        );
        
        emit MessageRetried(_guid, success);
        
        if (!success) {
            failedMessages[_guid] = message;  // Store again if fails
        }
    }
}
```

**✓ Validate msg.value in lzReceive**

Executor can provide ANY msg.value. If your logic depends on value, validate:

```solidity
function _lzReceive(..., bytes calldata _message, ...) internal override {
    (uint256 expectedValue, address recipient, bytes memory data) = 
        abi.decode(_message, (uint256, address, bytes));
    
    // Validate msg.value
    require(msg.value >= expectedValue, "Insufficient value");
    
    // Use msg.value safely
    payable(recipient).transfer(msg.value);
}
```

**✓ Authorization Checks in Custom Functions**

For OFT, verify sender is authorized in _debitFrom:

```solidity
function _debit(
    address _from,
    uint256 _amountLD,
    uint256 _minAmountLD,
    uint32 _dstEid
) internal virtual override returns (uint256, uint256) {
    // Verify authorization
    require(
        _from == _msgSender() || 
        isApprovedForAll(_from, _msgSender()),
        "OFT: not authorized"
    );
    
    return super._debit(_from, _amountLD, _minAmountLD, _dstEid);
}
```

**✓ Safe Encoding Practices**

Always use `abi.encode` for dynamic types. NEVER `abi.encodePacked` for bytes/string:

```solidity
// ✅ SAFE
bytes memory message = abi.encode(recipient, amount, data);

// ❌ DANGEROUS for dynamic types
bytes memory message = abi.encodePacked(recipient, amount, data);  // Can cause collisions

// ✅ OK for fixed types
bytes memory message = abi.encodePacked(uint256(amount), address(recipient));
```

### Common Vulnerabilities to Avoid

**Multiple OFT Adapters** ⚠️ CRITICAL: Only ONE adapter per token globally. Multiple adapters → race conditions → permanent token loss.

**Insufficient Gas Limits**: Message arrives but reverts due to out-of-gas. Set enforced options with adequate gas:

```solidity
// Test gas consumption on destination chain
// Add 20-30% buffer for safety
bytes memory options = OptionsBuilder.newOptions()
    .addExecutorLzReceiveOption(250000, 0);  // 250k gas
```

**Zero Address Transfers**: ERC20 mint reverts on address(0). Handle explicitly:

```solidity
function _credit(address _to, uint256 _amountLD, uint32) 
    internal override returns (uint256) 
{
    require(_to != address(0), "OFT: invalid recipient");
    _mint(_to, _amountLD);
    return _amountLD;
}
```

**Reentrancy in lzCompose**: While lzReceive has built-in protection, lzCompose does NOT. Add checks:

```solidity
function lzCompose(
    address _oApp,
    bytes32 _guid,
    bytes calldata _message,
    address,
    bytes calldata
) external payable {
    // CRITICAL: Validate caller
    require(msg.sender == address(endpoint), "Only endpoint");
    require(_oApp == address(trustedOFT), "Only trusted OApp");
    
    // Process compose message
    // ...
}
```

**Default Configuration Risk**: Default DVNs can be changed by LayerZero team. For production, always set custom config.

---

## Debugging: Identifying and Resolving Issues

### LayerZero Scan: Essential Tool

**Testnet Scan**: https://testnet.layerzeroscan.com/  
**Mainnet Scan**: https://layerzeroscan.com/

After every send, track on Scan using transaction hash. Message states:

- **✅ Delivered**: Received successfully on destination
- **🔄 Inflight**: In transmission between chains
- **⚠️ Payload Stored**: Arrived but execution failed (needs retry)
- **❌ Failed**: Transaction error

### Retry Failed Messages

If message execution fails, you can retry without resending:

**Via LayerZero Scan UI**:
1. Navigate to failed message
2. Click "Retry" button
3. Confirm transaction

**Via Contract**:
```solidity
// Implement in OApp
function forceResumeReceive(
    uint32 _srcEid,
    bytes32 _sender,
    bytes calldata _payload
) external onlyOwner {
    // Manually trigger lzReceive again
    endpoint.lzReceive(
        Origin(_srcEid, _sender, 0),
        bytes32(0),
        _payload,
        msg.sender,
        ""
    );
}
```

### Common Errors and Solutions

**"NoPeer" Error**:
```bash
# Check peers
npx hardhat lz:oapp:peers:get --oapp-config layerzero.config.ts

# Re-wire if necessary
npx hardhat lz:oapp:wire --oapp-config layerzero.config.ts
```

**"Out of Gas" Error**: Increase gas in options:
```solidity
.addExecutorLzReceiveOption(500000, 0)  // Increase to 500k
```

**"InvalidPayload" Error**: Verify encoding/decoding match on both chains:
```solidity
// Source
bytes memory payload = abi.encode(recipient, amount);

// Destination - MUST match types
(address recipient, uint256 amount) = abi.decode(payload, (address, uint256));
```

**Transaction Failed Silently**: Check on LayerZero Scan to see exact error. Often it's a gas issue or validation failure in lzReceive.

### Local Testing Tips

```bash
# Run Foundry tests with verbosity
forge test -vvv  # Shows traces
forge test -vvvv # Shows detailed traces + storage changes

# Gas profiling
forge test --gas-report

# Specific test
forge test --match-test test_SendMessage -vvv

# Fork testing (uses state from testnet)
forge test --fork-url $RPC_URL_SEPOLIA -vvv
```

---

## Endpoint IDs Quick Reference

```javascript
// MAINNET EIDs (30xxx series)
const MAINNET = {
  ETHEREUM: 30101,
  BSC: 30102,
  AVALANCHE: 30106,
  POLYGON: 30109,
  ARBITRUM: 30110,
  OPTIMISM: 30111,
  FANTOM: 30112,
  BASE: 30184,
  LINEA: 30183,
  SOLANA: 30168,
};

// TESTNET EIDs (40xxx series)
const TESTNET = {
  SEPOLIA: 40161,           // Ethereum Sepolia
  BSC_TESTNET: 40102,       // BSC Testnet
  FUJI: 40106,              // Avalanche Fuji
  AMOY: 40267,              // Polygon Amoy
  ARBITRUM_SEPOLIA: 40231,  // Arbitrum Sepolia
  OPTIMISM_SEPOLIA: 40232,  // Optimism Sepolia
  BASE_SEPOLIA: 40245,      // Base Sepolia
  FANTOM_TESTNET: 40112,    // Fantom Testnet
};
```

Complete list: https://docs.layerzero.network/v2/deployments/deployed-contracts

---

## Real Projects Built with LayerZero

### Top DeFi Projects

**Stargate Finance** (first LayerZero dApp): Cross-chain liquidity transport with $4B+ transactions. Unified pools across 7 chains. $STG token is OFT.

**Radiant Capital**: Omnichain money market – deposit on one chain, borrow on 8 different chains. $2B+ TVL.

**Ethena**: Synthetic dollar protocol. USDe + sUSDe are OFT, fastest growing stablecoin.

**EtherFi**: Liquid restaking. weETH uses OFT for native L2 restaking on Blast/Mode.

**Tapioca DAO**: Omnichain lending with CDP stablecoin USDO (OFT). Operates own DVN.

**Pendle**: Yield tokenization. Omnichain veTokenomics – vePENDLE synchronization across chains.

**TraderJoe**: Multichain DEX. JOE token transformed into OFT for seamless transfers.

### NFT & Gaming

**Omni X**: Omnichain NFT marketplace – trading across 8 chains.

**Heroes of Mavia**: Strategy game. MAVIA token (OFT) between Base/Ethereum.

**Pudgy Penguins**: Major NFT collection with ONFT functionality.

**Holograph**: NFT bridge across Ethereum, Polygon, Avalanche.

### Infrastructure

**Clusters**: Cross-chain multi-wallet name service. Unified identity layer.

**LayerZero Name Service**: Omnichain domain names. $5/year for 5+ digits.

**Aptos Bridge**: Connects non-EVM Aptos to EVM chains.

---

## Official Resources Complete List

### Documentation
- **V2 Docs**: https://docs.layerzero.network/v2
- **Quickstart**: https://docs.layerzero.network/v2/get-started/create-lz-oapp/start
- **OFT Guide**: https://docs.layerzero.network/v2/developers/evm/oft/quickstart
- **OApp Guide**: https://docs.layerzero.network/v2/developers/evm/oapp/overview
- **ONFT Guide**: https://docs.layerzero.network/v2/developers/evm/onft/quickstart

### GitHub
- **LayerZero V2**: https://github.com/LayerZero-Labs/LayerZero-v2
- **Devtools** (examples): https://github.com/LayerZero-Labs/devtools
- **Organization**: https://github.com/LayerZero-Labs

### Tools
- **Testnet Scan**: https://testnet.layerzeroscan.com/
- **Mainnet Scan**: https://layerzeroscan.com/
- **Testnet Bridge**: https://testnetbridge.com/
- **Deployed Contracts**: https://docs.layerzero.network/v2/deployments/deployed-contracts

### Community
- **Discord**: https://layerzero.network/community → #dev-general channel
- **Twitter**: @LayerZero_Labs
- **Medium**: https://medium.com/layerzero-official

### NPM Packages
```bash
@layerzerolabs/oapp-evm           # Core OApp
@layerzerolabs/oft-evm            # OFT standard
@layerzerolabs/onft-evm           # ONFT standard
@layerzerolabs/toolbox-hardhat    # Hardhat tasks
@layerzerolabs/test-devtools-evm-foundry  # Testing utilities
```

---

## Hackathon Quick Start Checklist

**Setup (5 min)**
- [ ] `npx create-lz-oapp@latest` → choose template
- [ ] Configure .env with PRIVATE_KEY
- [ ] Add RPC URLs for testnet
- [ ] Get testnet funds from faucets

**Development (1-2 hours)**
- [ ] Implement business logic in _lzReceive()
- [ ] Add methods to send messages
- [ ] Implement quote() for fee estimation
- [ ] Write tests with Foundry/Hardhat

**Deployment (15 min)**
- [ ] `npx hardhat lz:deploy` → deploy on 2-3 testnets
- [ ] `npx hardhat lz:oapp:wire` → configure peers
- [ ] Verify with `lz:oapp:peers:get`
- [ ] Test message send

**Testing & Debug (30 min)**
- [ ] Send test messages
- [ ] Track on LayerZero Scan
- [ ] Verify delivery on destination
- [ ] Fix any issues

**Production Ready**
- [ ] Implement failed message handling
- [ ] Set enforced options
- [ ] Configure custom DVNs
- [ ] Security audit checklist
- [ ] Documentation

---

## Conclusion: Build the Omnichain Future

LayerZero V2 has transformed blockchain interoperability from fragile bridges to native omnichain protocol. With **modular security, immutable core contracts, and universal semantics across 150+ chains**, you can build applications that operate seamlessly on every blockchain.

**Key takeaways to win the hackathon**:
1. **Start simple**: Basic OApp messaging first, then add complexity
2. **Use official standards**: OApp/OFT/ONFT are production-ready
3. **Test extensively**: Cross-chain bugs are hard to fix
4. **Security first**: Configure DVNs, implement retry logic, validate everything
5. **Track on LayerZero Scan**: Essential for debugging

The future is omnichain. With LayerZero V2, you have all the tools to build it. **Build something innovative, test thoroughly, deploy confidently**. Happy hacking! 🚀
