# 🚀 OmniCredit

**The First Omnichain Lending Protocol with Continuous Credit Scoring**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-blue)](https://soliditylang.org/)
[![LayerZero V2](https://img.shields.io/badge/LayerZero-V2-purple)](https://layerzero.network/)
[![Pyth Network](https://img.shields.io/badge/Pyth-Oracle-green)](https://pyth.network/)

> Deposit collateral on any chain, borrow on another, and build an on-chain credit score (0-1000) that unlocks up to 33% more borrowing power.

---

## ✨ Key Features

🌐 **Omnichain Lending** - Deposit on Base, borrow on Optimism—powered by LayerZero V2  
📊 **Credit Scoring** - Build 0-1000 reputation that unlocks better LTV (60% → 80%)  
🛡️ **Anti-Gaming** - Fee-based limits prevent score exploitation  
⚡ **Real-Time Oracles** - Pyth Network for millisecond-grade price feeds  
💎 **Uniswap v4 Liquidations** - Dutch auction mechanism for fair collateral pricing  
🎨 **Beautiful UI** - React frontend with multi-chain balance tracking  

---

## 🎯 Problem & Solution

### The Problem
- **$50B+ DeFi liquidity fragmented** across 100+ chains
- **No credit history** - all users need 150%+ collateral regardless of reputation
- **Can't use assets where they are** - forced to bridge collateral expensively

### Our Solution
- **Single liquidity pool** on Arbitrum, accessible from any chain
- **Continuous credit scoring** rewards responsible borrowers with better terms
- **Cross-chain collateral deposits** - no bridging required

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│         ARBITRUM SEPOLIA (Hub Chain)            │
│                                                 │
│  ProtocolCore ◄─── CreditScore (0-1000)         │
│       │            PriceOracle (Pyth)           │
│       │            LiquidationManager (V4)      │
│       │                                         │
└───────┼─────────────────────────────────────────┘
        │
    LayerZero V2 (OApp + OFT)
        │
┌───────┴──────────┬──────────────────────┐
│                  │                      │
│  BASE SEPOLIA    │  OPTIMISM SEPOLIA    │
│  LenderVault     │  LenderVault         │
│  CollateralVault │  CollateralVault     │
│  MockUSDC ◄─► OFT│  MockUSDC ◄─► OFT    │
└──────────────────┴──────────────────────┘
```

**9 Smart Contracts | 3 Testnets | 10 Cross-Chain Connections**

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Testnet ETH on Arbitrum, Base, Optimism Sepolia
- Private key with testnet funds
- WalletConnect Project ID (for frontend)

### Installation
```bash
# Clone repository
git clone https://github.com/[your-username]/omnicredit.git
cd omnicredit

# Install dependencies
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Setup environment
cp .env.example .env
# Edit .env with your PRIVATE_KEY and RPC URLs

# Setup frontend environment
cp frontend/.env.local.example frontend/.env.local
# Edit with your WALLETCONNECT_PROJECT_ID
```

### Run Frontend (Recommended)
```bash
npm run frontend:dev
# Open http://localhost:5174
```

### Test Protocol (CLI)
```bash
# Full lending/borrowing flow
npx hardhat run scripts/examples/lender-deposit-base.ts --network baseSepolia
npx hardhat run scripts/examples/deposit-collateral-base.ts --network baseSepolia
npx hardhat run scripts/examples/borrow-crosschain-optimism.ts --network arbitrumSepolia
npx hardhat run scripts/examples/show-balances.ts --network optimismSepolia
npx hardhat run scripts/examples/repay-loan-arbitrum.ts --network arbitrumSepolia
```

---

## 📦 Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Cross-Chain** | LayerZero V2 | OApp messaging + OFT token bridging |
| **Oracles** | Pyth Network | Real-time price feeds with confidence checks |
| **Liquidations** | Uniswap v4 | PoolManager Dutch auctions |
| **Smart Contracts** | Solidity 0.8.28 | Hub + satellite architecture |
| **Deployment** | Hardhat 3.0 + Ignition | Deterministic, reproducible |
| **Frontend** | React + TypeScript | wagmi, viem, RainbowKit, Tailwind |

---

## 📋 Contract Addresses

### Arbitrum Sepolia (421614) - Hub Chain
- **ProtocolCore**: `0xD0A7e8F3E39Da4310ace992C2c331E4F5D0dA6eD`
- **CreditScore**: `0x513fD21094e3F6E6f9081F4A95c1d1212020349F`
- **FeeBasedLimits**: `0x858611DdC63aD6D285518Ee90AF0768377Fe17CE`
- **PriceOracle**: `0x5a50a56238880D020e9F36e197B3bf9c854c2dfF`
- **LiquidationManager**: `0x3d6547523EddAdCB4b85Dd074cdE6d2bB680533A`
- **MockUSDC**: `0x1bE5aa20A6Ea7668167dbB68D88242d0aaBe3f5D`
- **MockOFT**: `0xE101608B02b8f5235ad5c44B413D4E531eeCa5Eb`

### Base Sepolia (84532) - Satellite
- **LenderVault**: `0x2cb8f1E783da33E26Ebe293fa9D45ba06E1FFc8b`
- **CollateralVault**: `0xcC787E14ec9bc3e862fd63e12BBB21908285aD72`
- **MockUSDC**: `0x1B3B6ad9F9E65C01B85D96bB4ae425Fe6ec4D556`
- **MockOFT**: `0xf74F4460D752e7540de42bA80087EA50AE703437`

### Optimism Sepolia (11155420) - Satellite
- **LenderVault**: `0x35AdAc602fDA4e16F3899a1bC266602bc9659bfA`
- **CollateralVault**: `0x24488D1AEea4Ed98F2cbE7e576699959DDF30fd6`
- **MockUSDC**: `0x45Ca941D17aB800Ca02A83E3dA29871d8F878599`
- **MockOFT**: `0x53bE5f2e8d6D08354214a8F45ac52967aBC55D4F`

**Track cross-chain messages**: [LayerZero Scan](https://layerzeroscan.com/)

---

## 💡 How It Works

### Credit Scoring System
```
Credit Score = (Interest Paid / $10) × Streak Multiplier - Liquidation Penalties

LTV by Score Tier:
• 0-400: 60% LTV (standard)
• 400-700: 70% LTV (+16% borrowing power)
• 700-1000: 80% LTV (+33% borrowing power)

Streak Bonus: +5% per consecutive on-time loan (max 150%)
Liquidation Penalty: -200 points per event
```

### Fee-Based Limits (Anti-Gaming)
```
Max Borrow = min(
  Collateral Value × LTV,
  Collateral Value + (Total Interest Paid × 50%)
)
```
This prevents users from building high scores on small loans then immediately borrowing maximum and defaulting.

### Example User Journey
1. **Alice deposits 0.5 ETH** on Base CollateralVault
2. CollateralVault sends LayerZero message → ProtocolCore on Arbitrum
3. **Alice borrows 200 USDC** to Optimism (score 0 → 60% LTV)
4. ProtocolCore bridges USDC via OFT → Alice receives on Optimism
5. **Alice repays loan** on time → credit score increases to 120
6. **Next loan**: Alice can borrow at 62% LTV (score-based improvement)
7. **After 10 on-time payments**: Score 650 → 70% LTV unlocked

---

## 🎮 Demo Flows

### Lender Flow (Earn Yield)
1. Connect wallet to Base Sepolia
2. Mint MockUSDC (test token faucet)
3. Approve LenderVault
4. Deposit USDC → Receive shares on Arbitrum
5. Shares appreciate as borrowers pay interest
6. Withdraw to any chain via LayerZero OFT

### Borrower Flow (Cross-Chain Loan)
1. Connect wallet to Base Sepolia
2. Deposit ETH collateral to CollateralVault
3. Wait for LayerZero message to finalize (~2 mins)
4. Switch to Arbitrum Sepolia
5. Call borrowCrossChain() → Select Optimism as destination
6. USDC arrives on Optimism via OFT bridge
7. Use USDC for DeFi, trading, etc.
8. Repay on Arbitrum → Credit score increases
9. Future loans unlock better LTV ratios

---

## 📊 Project Metrics

- **Smart Contracts**: 9 contracts, ~2,500 lines of Solidity
- **Deployment Scripts**: Fully automated with Hardhat 3.0 Ignition
- **Frontend**: 8 React components, TypeScript, real-time multi-chain balances
- **Documentation**: 10+ markdown files, comprehensive guides
- **Testing**: 7 example workflows, manual testing checklist
- **Security**: ReentrancyGuard, peer authorization, oracle confidence checks

---

## 🗂️ Repository Structure

```
omnicredit/
├── contracts/               # Smart contracts
│   ├── base/               # Hub contracts (Arbitrum)
│   │   ├── ProtocolCore.sol
│   │   ├── ContinuousCreditScore.sol
│   │   ├── FeeBasedLimits.sol
│   │   ├── PriceOracle.sol
│   │   └── LiquidationManager.sol
│   ├── cross-chain/        # Satellite contracts
│   │   ├── LenderVault.sol
│   │   └── CollateralVault.sol
│   └── mocks/              # Test tokens
│       ├── MockUSDC.sol
│       └── MockOFT.sol
├── ignition/               # Hardhat Ignition deployments
│   ├── modules/           # Deployment modules
│   └── parameters/        # Network-specific params
├── scripts/               # Interaction scripts
│   └── examples/          # Demo workflows
├── frontend/              # React application
│   ├── src/
│   │   ├── components/   # UI components
│   │   └── wagmi.ts      # Web3 config
│   └── public/
├── monitor/               # Liquidation monitoring
├── docs/                  # Documentation
├── HACKATHON_SUBMISSION.md   # Complete hackathon docs
├── HACKATHON_QA.md           # Q&A for submission forms
├── PITCH_ONE_PAGER.md        # One-page pitch
├── QUICKSTART.md             # Quick start guide
└── README.md                 # This file
```

---

## 📚 Documentation

- **[HACKATHON_SUBMISSION.md](HACKATHON_SUBMISSION.md)** - Complete project overview for judges
- **[HACKATHON_QA.md](HACKATHON_QA.md)** - Ready-to-use answers for submission forms
- **[PITCH_ONE_PAGER.md](PITCH_ONE_PAGER.md)** - Concise one-page pitch
- **[QUICKSTART.md](QUICKSTART.md)** - Setup and deployment guide
- **[docs/omnicredit-overview.md](docs/omnicredit-overview.md)** - Technical deep dive
- **[scripts/examples/README.md](scripts/examples/README.md)** - Example workflows
- **[frontend/TESTING_CHECKLIST.md](frontend/TESTING_CHECKLIST.md)** - Frontend testing guide

---

## 🔧 Development

### Compile Contracts
```bash
npm run build
```

### Deploy to Testnets
```bash
# Deploy to Arbitrum Sepolia (hub)
npm run deploy:arbitrum

# Deploy to Base Sepolia (satellite)
npm run deploy:baseSepolia

# Deploy to Optimism Sepolia (satellite)
npm run deploy:optimism

# Configure LayerZero peers
npm run configure:peers:arbitrum
npm run configure:peers:baseSepolia
npm run configure:peers:optimism
```

### Run Liquidation Monitor
```bash
npm run monitor:liquidations
```

### Frontend Development
```bash
cd frontend
npm run dev     # Start dev server
npm run build   # Production build
npm run lint    # Check code quality
```

---

## 🛡️ Security

### Current Safeguards
- ✅ ReentrancyGuard on all state-changing functions
- ✅ Authorized peer validation for LayerZero messages
- ✅ Pyth oracle confidence checks (<2% max deviation)
- ✅ Price staleness validation (<60s)
- ✅ Fee-based limits prevent gaming attacks
- ✅ Liquidation health factor monitoring

### Audit Status
⚠️ **Not yet audited** - This is a hackathon project. Do not use in production without professional security audit.

**Planned audits:** Trail of Bits, OpenZeppelin (pre-mainnet)

---

## 🏆 Awards & Recognition

*[Add hackathon awards here]*

---

## 🚀 Roadmap

### Phase 1: Mainnet Launch (Q1 2025)
- [ ] Security audit
- [ ] Deploy to Arbitrum, Base, Optimism mainnet
- [ ] Real USDC integration
- [ ] Marketing campaign

### Phase 2: Feature Expansion (Q2 2025)
- [ ] Multi-collateral support (WBTC, stablecoins)
- [ ] Variable rates by credit score
- [ ] Credit score NFTs (soulbound)
- [ ] Governance token

### Phase 3: Scale (Q3-Q4 2025)
- [ ] 10+ chain expansion
- [ ] $100M+ TVL target
- [ ] Credit score API for other protocols
- [ ] Under-collateralized lending (beta)

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

**Development Guidelines:**
- Follow existing code style
- Add tests for new features
- Update documentation
- Ensure all tests pass

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **LayerZero** for omnichain infrastructure
- **Pyth Network** for decentralized oracle feeds
- **Uniswap** for v4 PoolManager
- **OpenZeppelin** for secure contract libraries
- **Hardhat** for development framework
- **Arbitrum, Base, Optimism** for testnet support

---

## 📞 Contact & Links

- **Website**: [Coming Soon]
- **Twitter**: [Your Twitter]
- **Discord**: [Your Discord]
- **Telegram**: [Your Telegram]
- **Email**: [Your Email]

**Demo Video**: [Your Video URL]  
**Presentation**: [Your Slides URL]  
**LayerZero Scan**: [Track Messages](https://layerzeroscan.com/)

---

## 💬 Support

Having issues? Check these resources:

1. **[QUICKSTART.md](QUICKSTART.md)** - Setup guide
2. **[docs/omnicredit-overview.md](docs/omnicredit-overview.md)** - Technical docs
3. **GitHub Issues** - Report bugs or request features
4. **Discord** - Join our community [link]

---

<div align="center">

**Built with ❤️ for the DeFi Community**

⭐ Star us on GitHub if you find this project interesting!

[Report Bug](https://github.com/[your-username]/omnicredit/issues) • [Request Feature](https://github.com/[your-username]/omnicredit/issues) • [Contribute](CONTRIBUTING.md)

</div>

---

## 🎯 Quick Links

| Resource | Description |
|----------|-------------|
| [Live Demo](http://localhost:5174) | Try the frontend |
| [Contracts](contracts/) | Browse smart contracts |
| [Deployments](deployments.json) | All contract addresses |
| [Examples](scripts/examples/) | Demo scripts |
| [Architecture](docs/omnicredit-overview.md) | Technical details |
| [Hackathon Docs](HACKATHON_SUBMISSION.md) | Full submission |

---

**OmniCredit** - Building Credit, Across Chains 🌐

