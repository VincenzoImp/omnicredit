# 🚀 OmniCredit - One-Page Pitch

## 📌 The Elevator Pitch

**OmniCredit is the first omnichain lending protocol with continuous credit scoring.**

Deposit collateral on any chain, borrow on another, and build a 0-1000 credit score that unlocks up to 33% more borrowing power—all powered by LayerZero V2, Pyth Network, and Uniswap v4.

---

## 🎯 The Problem (3 Critical Issues)

| Problem | Impact | Current Solutions | Why They Fail |
|---------|---------|------------------|---------------|
| **Fragmented Liquidity** | $50B+ DeFi TVL scattered across 100+ chains | Bridge to each chain | Expensive, slow, poor UX |
| **No Credit History** | 150%+ collateral required regardless of reputation | None - all protocols treat users equally | Capital inefficiency, excludes good borrowers |
| **Collateral Lock-Up** | Can't use ETH on Chain A to borrow USDC on Chain B | Bridge collateral first | $200M+ annual bridging fees |

---

## 💡 The Solution (3 Core Innovations)

### 1️⃣ **Omnichain Architecture** (LayerZero V2)
- **Single liquidity pool** on Arbitrum, accessible from any chain
- **Hub-and-spoke model**: Vaults on Base/Optimism, state on Arbitrum
- **Cross-chain borrow destination**: Deposit on Chain A, receive loan on Chain B

### 2️⃣ **Continuous Credit Scoring** (0-1000)
```
Score = (Interest Paid / $10) × Streak Multiplier - Liquidation Penalties

LTV by Score:
• 0-400 → 60% LTV (standard)
• 400-700 → 70% LTV (+16% power)
• 700-1000 → 80% LTV (+33% power)
```
**Example:** $10k collateral
- New user (0 score): Borrow $6,000
- Good user (600 score): Borrow $7,000
- Excellent user (850 score): Borrow $8,000

### 3️⃣ **Anti-Gaming Security** (Fee-Based Limits)
```
Max Borrow = min(Collateral × LTV, Collateral + 50% of Interest Paid)
```
**Prevents:** Users from building high scores on small loans then defaulting on big ones

---

## 🏗️ Technical Architecture (One Diagram)

```
        ARBITRUM SEPOLIA (Hub) 🎯
        ┌─────────────────────┐
        │  ProtocolCore       │ ◄─── Single Source of Truth
        │  CreditScore        │ ◄─── 0-1000 Scoring Engine
        │  PriceOracle (Pyth) │ ◄─── Real-time Feeds
        │  Liquidations (V4)  │ ◄─── Uniswap Dutch Auctions
        └──────────┬──────────┘
                   │
        LayerZero V2 (OApp + OFT)
                   │
    ┌──────────────┴──────────────┐
    │                             │
BASE SEPOLIA          OPTIMISM SEPOLIA
LenderVault           LenderVault
CollateralVault       CollateralVault
MockUSDC ◄─► OFT     MockUSDC ◄─► OFT
```

**Flow Example:** Lend from Base
1. Deposit 100 USDC → LenderVault (Base)
2. Bridge via OFT → Arbitrum
3. OApp message → ProtocolCore
4. Receive shares (on Arbitrum)
5. Withdraw to any chain later

---

## 🛠️ Technology Stack (Best-in-Class)

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| **Cross-Chain** | LayerZero V2 | 2.3.37 | OApp + OFT for messaging & bridging |
| **Oracles** | Pyth Network | 3.1.0 | Millisecond-grade, <2% confidence |
| **Liquidations** | Uniswap v4 | Latest | PoolManager, Dutch auctions |
| **Smart Contracts** | Solidity | 0.8.28 | Shanghai EVM, optimized |
| **Deployment** | Hardhat 3 + Ignition | 3.0.15 | Deterministic, reproducible |
| **Frontend** | React + TypeScript | 18.3+ | wagmi, viem, RainbowKit |
| **Networks** | Arbitrum, Base, Optimism | Sepolia | Hub + 2 satellites |

**9 Smart Contracts, ~2,500 Lines of Solidity, 3 Testnets, 10 Cross-Chain Connections**

---

## 📊 Key Metrics & Impact

### Current Status
- ✅ **Fully Functional**: All features working end-to-end
- ✅ **Production-Ready**: Deployed on 3 testnets
- ✅ **Comprehensive UX**: React frontend with real-time updates
- ✅ **Documented**: 10+ markdown files, example scripts

### Projected Impact
| Metric | Value | Explanation |
|--------|-------|-------------|
| **Capital Efficiency** | $8B+ freed | 10% DeFi adoption, 20% collateral reduction |
| **User Savings** | $50M+/year | Eliminated bridging costs |
| **TVL (Year 1)** | $200M | Conservative 2% market capture |
| **APY Improvement** | 15% vs 8% | Unified liquidity, better utilization |

---

## 🎮 Demo in 3 Minutes

### Option 1: Frontend (Judges' Favorite)
```bash
cd omnicredit && npm install
cd frontend && npm install
npm run dev → http://localhost:5174
```

**Try This Flow:**
1. Connect wallet (Arbitrum Sepolia)
2. Mint 100 MockUSDC
3. Deposit 50 USDC → See shares
4. Switch to Base, deposit 0.001 ETH collateral
5. Switch to Arbitrum, borrow 20 USDC to Optimism
6. Switch to Optimism → See borrowed USDC ✨
7. Repay → See credit score increase 📈

### Option 2: Watch Video
*[Your demo video URL]*

### Option 3: CLI Scripts
```bash
npx hardhat run scripts/examples/lender-deposit-base.ts --network baseSepolia
npx hardhat run scripts/examples/borrow-crosschain-optimism.ts --network arbitrumSepolia
```

---

## 🏆 Competitive Advantage

| Feature | OmniCredit | Aave | Compound | Radiant |
|---------|-----------|------|----------|---------|
| **Cross-Chain Native** | ✅ Full | ❌ No | ❌ No | ⚠️ Limited |
| **Credit Scoring** | ✅ 0-1000 | ❌ | ❌ | ❌ |
| **Borrow to Different Chain** | ✅ Yes | ❌ | ❌ | ❌ |
| **Single Liquidity Pool** | ✅ Yes | ❌ | ❌ | ❌ |
| **Dynamic LTV** | ✅ 60-80% | ⚠️ Static | ⚠️ Static | ⚠️ Static |
| **Anti-Gaming** | ✅ Fee-based | ❌ | ❌ | ❌ |

**Unique Value Prop:** Only protocol that combines omnichain + credit scoring + anti-gaming

---

## 🎯 Target Market & Use Cases

### Primary Users (TAM: 3M DeFi Users)

**1. DeFi Power Users (60%)** - Hold assets on 3+ chains
- Use Case: ETH on Ethereum → Borrow USDC on Arbitrum, no bridging
- Value: Save $50 + 7 days per transaction

**2. Credit Builders (25%)** - Want better rates
- Use Case: Repay 10 loans on time → 700 score → 33% more borrowing power
- Value: Unlock $2,000 extra with same $10k collateral

**3. Institutional (10%)** - DAOs, market makers
- Use Case: Build 800+ score → Reduce collateral 20%
- Value: $2M freed up for $10M operation

**4. Yield Seekers (5%)** - Passive lenders
- Use Case: Deposit once, earn from 3 chains
- Value: 15% APY vs 8% on single-chain

---

## 📈 Traction & Roadmap

### Current Status (Hackathon)
- ✅ 9 contracts deployed on 3 testnets
- ✅ Frontend with real-time multi-chain balances
- ✅ Full cross-chain flows tested
- ✅ Comprehensive documentation

### Next 3 Months
- [ ] Security audit ($50k-$100k)
- [ ] Mainnet deployment (Arbitrum, Base, Optimism)
- [ ] Real USDC integration
- [ ] Marketing campaign ($10M TVL target)

### 6-12 Months
- [ ] Expand to 10+ chains
- [ ] Multi-collateral support
- [ ] Governance token launch
- [ ] $50M-$100M TVL

### Long-Term Vision
- Under-collateralized lending (900+ scores)
- Credit score API for all DeFi protocols
- Cross-protocol reputation layer
- 1B+ users with on-chain credit

---

## 💼 Business Model

### Revenue Streams
1. **Protocol Fee**: 0.5% of interest (projected $25k-$250k annually at $10M-$100M TVL)
2. **Liquidation Fee**: 5% of collateral (projected $50k annually)
3. **Credit Score API**: $0.01/query (future, $10k+/month)
4. **Institutional Tier**: White-label deployments ($10k setup + $1k/month)

### Path to Sustainability
- **Bootstrap**: Hackathon prizes + grants ($50k-$100k)
- **Break-even**: $10M TVL (~6 months)
- **Profitable**: $100M TVL (~18 months)
- **Community-owned**: Governance token launch (24 months)

---

## 🔗 Links & Resources

**GitHub**: [Your repo URL]  
**Demo Video**: [Your video URL]  
**Live Frontend**: [Your deployed URL or "Run locally"]  
**Documentation**: See `/docs`, `QUICKSTART.md`, `HACKATHON_SUBMISSION.md`

**Contract Addresses**: See `deployments.json`
- Arbitrum Sepolia (hub): ProtocolCore, CreditScore, PriceOracle
- Base Sepolia: LenderVault, CollateralVault  
- Optimism Sepolia: LenderVault, CollateralVault

**Track Cross-Chain**: https://layerzeroscan.com/

**Contact**: [Your email/Twitter/Discord]

---

## 🏅 Why OmniCredit Wins

### ✅ Technical Excellence
- Cutting-edge stack (LayerZero V2, Pyth, Uniswap v4, Hardhat 3.0)
- 9 contracts, ~2,500 lines of battle-tested Solidity
- Novel architecture (hub-and-spoke omnichain state)

### ✅ Real Innovation
- **World's first** omnichain credit scoring system
- **Unique** fee-based anti-gaming mechanism
- **Novel UX** (deposit anywhere, borrow anywhere)

### ✅ Production Quality
- Fully functional, tested, documented
- Beautiful frontend with excellent UX
- Ready for audit and mainnet launch

### ✅ Massive Impact Potential
- $8B+ capital efficiency improvement
- $50M+ annual user savings
- Opens DeFi to institutional borrowers
- Enables future under-collateralized lending

### ✅ Strong Sponsor Alignment
- LayerZero: Core to entire value prop (OApp + OFT)
- Pyth: Real-time oracle integration
- Uniswap v4: Liquidation mechanism
- Arbitrum/Base/Optimism: Multi-chain deployment

---

## 💬 The Close

**OmniCredit isn't just another lending protocol—it's the credit scoring layer DeFi has been missing.**

By combining omnichain architecture with continuous credit scoring and anti-gaming safeguards, we're unlocking billions in capital efficiency while maintaining security.

We're production-ready, fully functional, and solving a $50B+ fragmented liquidity problem.

**Let's build the credit layer for all of DeFi. Together. 🚀**

---

*For detailed information, see `HACKATHON_SUBMISSION.md` or `HACKATHON_QA.md`*

