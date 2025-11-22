# OmniCredit Protocol Deployment Guide

This guide provides comprehensive instructions for deploying and configuring the OmniCredit protocol across multiple chains.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Network Configuration](#network-configuration)
- [Deployment Process](#deployment-process)
- [Post-Deployment Configuration](#post-deployment-configuration)
- [Verification](#verification)
- [Cross-Chain Setup](#cross-chain-setup)
- [Troubleshooting](#troubleshooting)

## Overview

OmniCredit uses a hub-and-spoke architecture:
- **Hub (Base Chain)**: Runs the main protocol logic (ProtocolCore, LiquidationManager, CrossChainCoordinator)
- **Spokes (Satellite Chains)**: Run CollateralVault contracts that lock collateral and communicate with the hub

### Contract Architecture

```
Base Chain (Hub)
├── ContinuousCreditScore    # Credit scoring system
├── PriceOracle             # Pyth-based price feeds
├── FeeBasedLimits          # Anti-gaming borrow limits
├── ProtocolCore            # Main lending pool
├── LiquidationManager      # Dutch auction liquidations
├── CrossChainCoordinator   # LayerZero message hub
└── LiquidationHook         # Uniswap V4 integration (optional)

Satellite Chains (Spokes)
├── CollateralVault         # Locks collateral, sends to hub
├── USDCOFTAdapter         # USDC wrapper (Ethereum only)
└── USDCOmnitoken          # Synthetic USDC (non-USDC chains)
```

## Prerequisites

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file with your deployment credentials:

```env
# Deployment wallet (use either mnemonic or private key)
MNEMONIC="your twelve word mnemonic phrase here"
# or
PRIVATE_KEY="your_private_key_here"

# RPC URLs (optional - defaults to public RPCs)
SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY"
BASE_SEPOLIA_RPC_URL="https://base-sepolia.g.alchemy.com/v2/YOUR_KEY"
ARBITRUM_SEPOLIA_RPC_URL="https://arb-sepolia.g.alchemy.com/v2/YOUR_KEY"
OPTIMISM_SEPOLIA_RPC_URL="https://opt-sepolia.g.alchemy.com/v2/YOUR_KEY"
```

### 3. Fund Deployment Wallet

Ensure your deployment wallet has sufficient native tokens on each chain:
- Base Sepolia: ETH for gas
- Ethereum Sepolia: ETH for gas
- Arbitrum Sepolia: ETH for gas
- Optimism Sepolia: ETH for gas

## Network Configuration

All network-specific addresses and parameters are configured in `scripts/config/networks.ts`.

### Key Addresses to Configure

Before deploying, update the following addresses in the network configuration:

1. **Pyth Oracle Addresses** - Required on all chains
2. **USDC Token Addresses** - Required on all chains
3. **LayerZero V2 Endpoints** - Required on all chains
4. **LayerZero Endpoint IDs** - Required for cross-chain messaging
5. **Uniswap V4 PoolManager** - Required for liquidation hook (when available)
6. **Fee Collector Address** - Treasury address for protocol fees

### Testnet Addresses (Pre-configured)

The following testnet addresses are already configured:

| Network | Pyth Oracle | USDC | LayerZero Endpoint | Endpoint ID |
|---------|-------------|------|-------------------|-------------|
| Base Sepolia | 0x2880aB155794e7179c9eE2e38200202908C17B43 | 0x036CbD53842c5426634e7929541eC2318f3dCF7e | 0x6EDCE65403992e310A62460808c4b910D972f10f | 40245 |
| Ethereum Sepolia | 0x2880aB155794e7179c9eE2e38200202908C17B43 | 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 | 0x6EDCE65403992e310A62460808c4b910D972f10f | 40161 |
| Arbitrum Sepolia | 0x2880aB155794e7179c9eE2e38200202908C17B43 | 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d | 0x6EDCE65403992e310A62460808c4b910D972f10f | 40231 |
| Optimism Sepolia | 0x2880aB155794e7179c9eE2e38200202908C17B43 | 0x5fd84259d66Cd46123540766Be93DFE6D43130D7 | 0x6EDCE65403992e310A62460808c4b910D972f10f | 40232 |

## Deployment Process

### Step 1: Deploy Base Chain (Hub)

Deploy the main protocol contracts on Base:

```bash
# Deploy to Base Sepolia
npx hardhat run scripts/deploy-all.ts --network baseSepolia

# Or use Ignition directly
npx hardhat ignition deploy ignition/modules/BaseProtocol.ts \
  --network baseSepolia \
  --parameters '{"pythAddress":"0x2880aB155794e7179c9eE2e38200202908C17B43","usdcAddress":"0x036CbD53842c5426634e7929541eC2318f3dCF7e","lzEndpoint":"0x6EDCE65403992e310A62460808c4b910D972f10f"}'
```

This deploys:
- ContinuousCreditScore
- PriceOracle
- FeeBasedLimits
- ProtocolCore
- LiquidationManager
- CrossChainCoordinator
- LiquidationHook (if Uniswap V4 available)

### Step 2: Deploy Satellite Chains (Spokes)

Deploy CollateralVault contracts on each satellite chain:

```bash
# Deploy to Ethereum Sepolia
npx hardhat run scripts/deploy-all.ts --network sepolia

# Deploy to Arbitrum Sepolia
npx hardhat run scripts/deploy-all.ts --network arbitrumSepolia

# Deploy to Optimism Sepolia
npx hardhat run scripts/deploy-all.ts --network optimismSepolia
```

Each deployment creates the appropriate contracts based on chain type:
- **Ethereum**: USDCOFTAdapter (wraps native USDC)
- **Other Chains**: CollateralVault (locks collateral)
- **Non-USDC Chains**: USDCOmnitoken (synthetic USDC)

## Post-Deployment Configuration

### Automatic Configuration

The `deploy-all.ts` script automatically runs configuration after deployment. To manually configure:

```bash
# Configure Base chain
npx hardhat run scripts/configure.ts --network baseSepolia

# Configure satellite chains
npx hardhat run scripts/configure.ts --network sepolia
npx hardhat run scripts/configure.ts --network arbitrumSepolia
npx hardhat run scripts/configure.ts --network optimismSepolia
```

### Manual Configuration Steps

#### 1. Base Chain Configuration

```javascript
// Authorize updaters in CreditScore
await creditScore.setAuthorizedUpdater(protocolCoreAddress, true);
await creditScore.setAuthorizedUpdater(liquidationManagerAddress, true);

// Configure PriceOracle
await priceOracle.addPriceFeed(ethAddress, "0xff614..."); // ETH/USD feed
await priceOracle.addPriceFeed(btcAddress, "0xe62df..."); // BTC/USD feed
await priceOracle.setMaxPriceAge(300); // 5 minutes
await priceOracle.setMaxConfidenceRatio(500); // 5%

// Configure ProtocolCore
await protocolCore.setCoordinator(coordinatorAddress);
await protocolCore.setLiquidationManager(liquidationManagerAddress);
await protocolCore.setFeeCollector(feeCollectorAddress);

// Configure CrossChainCoordinator
await coordinator.setLendingPool(protocolCoreAddress);
await coordinator.setAuthorizedSender(protocolCoreAddress, true);
```

#### 2. Satellite Chain Configuration

```javascript
// Configure CollateralVault
await vault.setCoordinatorEid(40245); // Base Sepolia EID
await vault.setAssetDecimals(ethAddress, 18);
await vault.setAssetDecimals(btcAddress, 8);
await vault.setPriceOracle(oracleAddress);
```

#### 3. Cross-Chain Authorization

Authorize each CollateralVault on the CrossChainCoordinator:

```javascript
// On Base chain
await coordinator.authorizeVault(40161, sepoliaVaultAddress);      // Ethereum
await coordinator.authorizeVault(40231, arbitrumVaultAddress);     // Arbitrum
await coordinator.authorizeVault(40232, optimismVaultAddress);     // Optimism
```

## Verification

### Automated Verification

Run the verification script to check deployment status:

```bash
# Verify Base chain
npx hardhat run scripts/verify.ts --network baseSepolia

# Verify satellite chains
npx hardhat run scripts/verify.ts --network sepolia
```

The verification script checks:
- Contract deployment status
- Authorization settings
- Configuration parameters
- Cross-chain connectivity

### Manual Verification Checklist

#### Base Chain
- [ ] All 6 core contracts deployed
- [ ] CreditScore authorizations set
- [ ] PriceOracle feeds configured
- [ ] ProtocolCore coordinator/liquidator set
- [ ] CrossChainCoordinator lending pool set
- [ ] Fee collector configured

#### Satellite Chains
- [ ] CollateralVault deployed
- [ ] Coordinator EID configured
- [ ] Asset decimals set
- [ ] Vault authorized on hub

## Cross-Chain Setup

### Setting Trusted Remotes

Configure LayerZero trusted remotes for cross-chain messaging:

```javascript
// Use the cross-chain utility
import crossChain from "./scripts/utils/cross-chain";

// Authorize a vault
await crossChain.authorizeVault(coordinatorAddress, chainEid, vaultAddress);

// Set up trusted remotes
await crossChain.setupTrustedRemotes(
  localContractAddress,
  "CollateralVault",
  "baseSepolia",
  remoteContractAddress
);

// Batch setup for all chains
await crossChain.batchCrossChainSetup("./deployments.json");
```

### Testing Cross-Chain Messages

1. **Lock Collateral**: Call `lockCollateral()` on a CollateralVault
2. **Verify Message**: Check that CrossChainCoordinator received the message
3. **Update State**: Confirm collateral value updated in ProtocolCore

## Troubleshooting

### Common Issues

#### 1. "Pyth address not configured"
- Update `pythAddress` in `scripts/config/networks.ts`
- Pyth testnet addresses: https://docs.pyth.network/price-feeds/contract-addresses

#### 2. "LayerZero endpoint not configured"
- Update `lzEndpoint` in network config
- LayerZero addresses: https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts

#### 3. "Vault not authorized"
- Run authorization on Base chain: `coordinator.authorizeVault(chainEid, vaultAddress)`

#### 4. "Trusted remote not set"
- Configure LayerZero peers: `contract.setTrustedRemote(remoteEid, path)`

#### 5. Transaction failures
- Check wallet balance for gas
- Verify contract addresses
- Check network RPC connection

### Debug Commands

```bash
# Check deployment artifacts
ls -la ignition/deployments/

# View deployed addresses
cat ignition/deployments/chain-84532/deployed_addresses.json

# Test configuration
npx hardhat console --network baseSepolia
> const coord = await ethers.getContractAt("CrossChainCoordinator", "0x...")
> await coord.lendingPool()
```

## Production Deployment

### Pre-Production Checklist

1. **Audit Completion**: Ensure all contracts are audited
2. **Mainnet Addresses**: Update production addresses in config
3. **Multi-sig Setup**: Use multi-sig for owner/admin roles
4. **Rate Limits**: Configure appropriate rate limits
5. **Emergency Pause**: Test emergency pause functionality
6. **Monitoring**: Set up monitoring and alerts

### Mainnet Configuration

Update `scripts/config/networks.ts` with mainnet values:

```typescript
"base": {
  pythAddress: "0x...",     // Pyth mainnet
  usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC mainnet
  lzEndpoint: "0x...",      // LayerZero V2 mainnet
  // ... other mainnet addresses
}
```

### Deployment Order

1. Deploy to Base mainnet first (hub)
2. Deploy to Ethereum mainnet
3. Deploy to L2s (Arbitrum, Optimism)
4. Configure cross-chain messaging
5. Perform integration testing
6. Enable public access

## Support

For issues or questions:
- GitHub Issues: [OmniCredit Repository](https://github.com/omnicredit/protocol)
- Documentation: [docs/](./docs/)
- Contract Docs: [Technical Documentation](./TECHNICAL_DOCUMENTATION.md)