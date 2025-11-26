# 🚀 OmniCredit Quick Start Guide

Complete guide to deploy, test, and interact with the OmniCredit protocol.

## Prerequisites

1. **Node.js** 18+ and npm
2. **Private Key** with testnet ETH on all chains
3. **WalletConnect Project ID** (free from [cloud.walletconnect.com](https://cloud.walletconnect.com))

## 1. Installation

```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..
```

## 2. Environment Setup

Create `.env` in the root:

```env
PRIVATE_KEY=0xYOUR_PRIVATE_KEY
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
OPTIMISM_SEPOLIA_RPC_URL=https://sepolia.optimism.io
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

## 3. Deploy Contracts

### Step 1: Deploy Arbitrum Sepolia (Main Protocol)

```bash
npm run deploy:arbitrum
```

This deploys:
- ProtocolCore
- ContinuousCreditScore
- FeeBasedLimits
- PriceOracle
- LiquidationManager
- MockUSDC & MockOFT

### Step 2: Deploy Base Sepolia

```bash
npm run deploy:baseSepolia
```

This deploys:
- LenderVault
- CollateralVault
- MockUSDC & MockOFT

### Step 3: Deploy Optimism Sepolia

```bash
npm run deploy:optimism
```

Same as Base Sepolia.

### Step 4: Configure LayerZero Peers

```bash
npm run configure:peers:arbitrum
npm run configure:peers:baseSepolia
npm run configure:peers:optimism
```

## 4. Verify Deployment

```bash
npm run test:protocol
```

This checks all contracts are deployed and accessible.

## 5. Test Protocol (CLI Scripts)

### Check Balances

```bash
# Arbitrum
npx hardhat run scripts/examples/show-balances.ts --network arbitrumSepolia

# Base
npx hardhat run scripts/examples/show-balances.ts --network baseSepolia

# Optimism
npx hardhat run scripts/examples/show-balances.ts --network optimismSepolia
```

### Full Lending/Borrowing Flow

```bash
# 1. Lender deposits from Base
npx hardhat run scripts/examples/lender-deposit-base.ts --network baseSepolia

# 2. Borrower deposits collateral on Base
npx hardhat run scripts/examples/deposit-collateral-base.ts --network baseSepolia

# 3. Borrower borrows to Optimism (run on Arbitrum)
npx hardhat run scripts/examples/borrow-crosschain-optimism.ts --network arbitrumSepolia

# 4. Check balances on Optimism
npx hardhat run scripts/examples/show-balances.ts --network optimismSepolia

# 5. Repay loan
npx hardhat run scripts/examples/repay-loan-arbitrum.ts --network arbitrumSepolia

# 6. Withdraw shares
npx hardhat run scripts/examples/withdraw-lender-arbitrum.ts --network arbitrumSepolia
```

## 6. Start Frontend

```bash
npm run frontend:dev
```

Open [http://localhost:3000](http://localhost:3000)

### Frontend Features:
- 🔗 Connect wallet (MetaMask, WalletConnect)
- 🌐 Switch between chains
- 💰 View balances (native, MockUSDC, shares, loans)
- 📊 Lender panel: Mint & deposit MockUSDC
- 💳 Borrower panel: Deposit collateral, borrow cross-chain, repay

## 7. Run Liquidation Monitor

```bash
npm run monitor:liquidations
```

The monitor:
- Fetches Pyth price updates
- Checks borrower health factors
- Triggers liquidations when needed

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Arbitrum Sepolia (Hub)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ ProtocolCore │  │ CreditScore  │  │ PriceOracle  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
           ▲                    ▲                    ▲
           │                    │                    │
    LayerZero V2          LayerZero V2        LayerZero V2
           │                    │                    │
┌──────────┴──────────┐  ┌──────┴──────────┐         │
│   Base Sepolia      │  │ Optimism       │         │
│  ┌──────────────┐   │  │ Sepolia        │         │
│  │ LenderVault  │   │  │ ┌────────────┐ │         │
│  │ Collateral   │   │  │ │ LenderVault│ │         │
│  │ Vault        │   │  │ │ Collateral │ │         │
│  └──────────────┘   │  │ │ Vault      │ │         │
└─────────────────────┘  └─┴────────────┴─┘         │
                                                      │
                                              ┌──────┴──────┐
                                              │ Pyth Network│
                                              │ (Price Feeds)│
                                              └─────────────┘
```

## Key Features Demonstrated

1. **Cross-Chain Lending**: Deposit on Base/Optimism, receive shares on Arbitrum
2. **Cross-Chain Borrowing**: Collateral on Base, borrow to Optimism
3. **Credit Scoring**: Continuous 0-1000 score based on repayment history
4. **Fee-Based Limits**: Prevents "score and run" attacks
5. **Pyth Integration**: Real-time price feeds for collateral valuation
6. **LayerZero V2**: Seamless cross-chain messaging and token bridging

## Troubleshooting

### "Network not configured"
- Check `.env` has correct RPC URLs
- Verify network names match `hardhat.config.ts`

### "Missing address in deployments.json"
- Run deployment scripts first
- Check `deployments.json` exists in root

### "Insufficient funds"
- Get testnet ETH from faucets:
  - Arbitrum: https://faucet.quicknode.com/arbitrum/sepolia
  - Base: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
  - Optimism: https://faucet.quicknode.com/optimism/sepolia

### Frontend not loading contracts
- Ensure `deployments.json` exists
- Check browser console for errors
- Verify WalletConnect Project ID in `.env.local`

## Next Steps

- Read `project-docs/omnicredit-overview.md` for detailed architecture
- Check `scripts/examples/README.md` for example workflows
- Review `monitor/README.md` for liquidation monitoring

## Support

- Check contract documentation in `contracts/`
- Review deployment logs in `ignition/deployments/`
- Inspect LayerZero messages on [LayerZeroScan](https://layerzeroscan.com/)

