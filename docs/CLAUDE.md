# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OmniCredit is a decentralized omnichain lending protocol that enables cross-chain lending/borrowing with a continuous credit scoring system (0-1000 points). Users can deposit collateral on one blockchain and borrow on another, building on-chain credit that unlocks better borrowing terms (60% → 80% LTV).

## Architecture

### Hub-Satellite Model
- **Arbitrum Sepolia (Hub)**: Main protocol logic (ProtocolCore, CreditScore, PriceOracle, LiquidationManager)
- **Base & Optimism Sepolia (Satellites)**: Vault contracts for deposits/collateral
- **Cross-chain Communication**: LayerZero V2 OApp messaging + OFT token bridging
- **Price Feeds**: Pyth Network oracles with confidence validation
- **Liquidations**: Uniswap v4 PoolManager Dutch auctions

### Key Contract Interactions
1. **Lender deposits** USDC on satellite → bridges to hub → receives shares
2. **Borrower deposits** collateral on satellite → notifies hub → enables borrowing
3. **Credit scoring** updates on each repayment (formula: Interest Paid / $10 × Streak Multiplier - Liquidation Penalties)
4. **Fee-based limits** prevent gaming: Max Borrow = min(Collateral × LTV, Collateral + Interest × 50%)

## Common Development Commands

### Build & Test
```bash
npm run build                    # Compile contracts
npm run test                     # Run all tests
npm run test:coverage           # Code coverage
npx hardhat test test/specific.test.ts  # Single test file
```

### Deployment (Order Matters!)
```bash
# 1. Deploy hub chain first
npm run deploy:arbitrum

# 2. Deploy satellites
npm run deploy:baseSepolia
npm run deploy:optimism

# 3. Configure LayerZero peers (required for cross-chain)
npm run configure:peers:arbitrum
npm run configure:peers:baseSepolia
npm run configure:peers:optimism

# 4. Verify deployment
npm run test:protocol
```

### Frontend Development
```bash
npm run frontend:dev            # Start dev server (http://localhost:5174)
npm run frontend:build          # Production build
cd frontend && npm run lint     # Check code quality
```

### Testing Protocol Flows
```bash
# Show balances across all chains
npx hardhat run scripts/examples/show-balances.ts --network arbitrumSepolia

# Lender flow (deposit USDC on Base)
npx hardhat run scripts/examples/lender-deposit-base.ts --network baseSepolia

# Borrower flow (deposit collateral)
npx hardhat run scripts/examples/deposit-collateral-base.ts --network baseSepolia

# Cross-chain borrow (from Arbitrum to Optimism)
npx hardhat run scripts/examples/borrow-crosschain-optimism.ts --network arbitrumSepolia

# Repay loan and update credit score
npx hardhat run scripts/examples/repay-loan-arbitrum.ts --network arbitrumSepolia
```

### Monitor Liquidations
```bash
npm run monitor:liquidations    # Start liquidation monitor
```

## High-Level Architecture

### Contract Structure
```
contracts/
├── base/                       # Hub contracts (Arbitrum only)
│   ├── ProtocolCore.sol       # Main lending logic, share accounting
│   ├── ContinuousCreditScore.sol # 0-1000 scoring engine
│   ├── FeeBasedLimits.sol     # Anti-gaming mechanism
│   ├── PriceOracle.sol        # Pyth integration
│   └── LiquidationManager.sol # Uniswap v4 liquidations
├── cross-chain/               # Satellite contracts (Base/Optimism)
│   ├── LenderVault.sol        # USDC deposits → shares on hub
│   └── CollateralVault.sol    # ETH collateral → tracked on hub
└── mocks/
    ├── MockUSDC.sol           # Test USDC token
    └── MockOFT.sol            # LayerZero OFT for bridging
```

### Frontend Architecture
- **Framework**: React 18 + TypeScript + Vite
- **Web3**: Wagmi v2 + Viem (not ethers.js)
- **UI**: RainbowKit wallet connection + Tailwind CSS
- **State**: TanStack Query for data fetching
- **Key Files**:
  - `frontend/src/deployments.ts`: Contract addresses management
  - `frontend/src/wagmi.ts`: Chain configuration
  - `frontend/src/components/Improved*.tsx`: Main UI components

### Deployment System
- **Hardhat Ignition**: Deterministic deployments with modules
- **Modules**: `ignition/modules/` contains deployment scripts
- **Parameters**: `ignition/parameters/` has chain-specific configs
- **Addresses**: `deployments.json` tracks all deployed contracts

## Key Technical Details

### LayerZero Integration
- **Endpoint IDs**: Arbitrum (40231), Base (40245), Optimism (40232)
- **Message Types**: Deposit notifications, collateral updates, withdrawal requests
- **OFT Bridging**: MockOFT handles cross-chain USDC transfers
- **Peer Configuration**: Must set trusted remotes after deployment

### Credit Score Mechanics
- **Formula**: (Interest Paid / $10) × Streak Multiplier - Liquidation Penalties
- **LTV Tiers**: 0-400 (60%), 400-700 (70%), 700-1000 (80%)
- **Streak Bonus**: +5% multiplier per consecutive on-time loan (max 150%)
- **Penalties**: -200 points per liquidation event

### Oracle Configuration
- **Provider**: Pyth Network
- **Price Feed**: ETH/USD with confidence validation
- **Checks**: <2% deviation, <60s staleness
- **Update Pattern**: On-demand updates before critical operations

### Testing Considerations
- LayerZero messages take 2-3 minutes to finalize
- OFT bridging requires waiting for confirmation
- Use `show-balances.ts` to verify cross-chain state
- Credit score updates are immediate on repayment
- Liquidations trigger when health factor < 1.0

## Important Contract Addresses

### Arbitrum Sepolia (Hub)
- ProtocolCore: `0xD0A7e8F3E39Da4310ace992C2c331E4F5D0dA6eD`
- CreditScore: `0x513fD21094e3F6E6f9081F4A95c1d1212020349F`
- PriceOracle: `0x5a50a56238880D020e9F36e197B3bf9c854c2dfF`

### Base Sepolia
- LenderVault: `0x2cb8f1E783da33E26Ebe293fa9D45ba06E1FFc8b`
- CollateralVault: `0xcC787E14ec9bc3e862fd63e12BBB21908285aD72`

### Optimism Sepolia
- LenderVault: `0x35AdAc602fDA4e16F3899a1bC266602bc9659bfA`
- CollateralVault: `0x24488D1AEea4Ed98F2cbE7e576699959DDF30fd6`

## Environment Setup

Required `.env` variables:
```
PRIVATE_KEY=0x...                              # Deployer/tester private key
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
OPTIMISM_SEPOLIA_RPC_URL=https://sepolia.optimism.io
```

Frontend `.env.local`:
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...       # From cloud.walletconnect.com
```

## Common Troubleshooting

### LayerZero Messages Not Arriving
- Verify peer configuration: `npm run configure:peers`
- Check LayerZero Scan for message status
- Ensure sufficient gas on destination chain

### Frontend Not Showing Balances
- Check `frontend/src/deployments.json` has correct addresses
- Verify wallet is on correct network
- Clear browser cache/localStorage

### Credit Score Not Updating
- Ensure repayment transaction succeeded
- Check ProtocolCore has CreditScore contract authorized
- Verify FeeBasedLimits is properly configured

### Deployment Fails
- Check private key has testnet ETH on all chains
- Verify RPC URLs are accessible
- Run deployments in order: Arbitrum → Base → Optimism → Configure peers