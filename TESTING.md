# 🧪 OmniCredit Testing Guide

Complete testing workflow for the OmniCredit protocol.

## ✅ Verification Status

All contracts are deployed and verified on testnets:

- **Arbitrum Sepolia**: 7 contracts ✅
- **Base Sepolia**: 4 contracts ✅  
- **Optimism Sepolia**: 4 contracts ✅

Run verification anytime:
```bash
npm run test:protocol
```

## 📋 Test Checklist

### 1. Environment Setup ✅
- [x] `.env` configured with RPC URLs
- [x] `PRIVATE_KEY` set
- [x] `deployments.json` populated
- [x] Frontend `.env.local` with WalletConnect ID

### 2. Contract Deployment ✅
- [x] Arbitrum Sepolia (ProtocolCore + dependencies)
- [x] Base Sepolia (LenderVault + CollateralVault)
- [x] Optimism Sepolia (LenderVault + CollateralVault)
- [x] LayerZero peers configured

### 3. CLI Testing

#### Check Balances
```bash
# All chains
npx hardhat run scripts/examples/show-balances.ts --network arbitrumSepolia
npx hardhat run scripts/examples/show-balances.ts --network baseSepolia
npx hardhat run scripts/examples/show-balances.ts --network optimismSepolia
```

#### Full Lending Flow
```bash
# 1. Lender deposits 25 mUSDC from Base → Arbitrum
npx hardhat run scripts/examples/lender-deposit-base.ts --network baseSepolia

# 2. Wait ~2-3 minutes for LayerZero message to finalize
# 3. Check shares on Arbitrum
npx hardhat run scripts/examples/show-balances.ts --network arbitrumSepolia
```

#### Full Borrowing Flow
```bash
# 1. Deposit 0.0001 ETH collateral on Base
npx hardhat run scripts/examples/deposit-collateral-base.ts --network baseSepolia

# 2. Wait ~2-3 minutes for collateral update
# 3. Borrow 20 mUSDC to Optimism (run on Arbitrum)
npx hardhat run scripts/examples/borrow-crosschain-optimism.ts --network arbitrumSepolia

# 4. Wait ~2-3 minutes for OFT bridge
# 5. Check MockUSDC balance on Optimism
npx hardhat run scripts/examples/show-balances.ts --network optimismSepolia
```

#### Repayment Flow
```bash
# 1. Repay loan on Arbitrum
npx hardhat run scripts/examples/repay-loan-arbitrum.ts --network arbitrumSepolia

# 2. Verify loan closed
npx hardhat run scripts/examples/show-balances.ts --network arbitrumSepolia
```

#### Withdrawal Flow
```bash
# Option A: Local withdrawal
npx hardhat run scripts/examples/withdraw-lender-arbitrum.ts --network arbitrumSepolia

# Option B: Cross-chain withdrawal to Optimism
npx hardhat run scripts/examples/withdraw-crosschain-optimism.ts --network arbitrumSepolia
```

### 4. Frontend Testing

```bash
npm run frontend:dev
```

**Test Scenarios:**

1. **Connect Wallet**
   - Click "Connect Wallet"
   - Select MetaMask or WalletConnect
   - Verify address displayed

2. **Switch Chains**
   - Click chain buttons (Arbitrum/Base/Optimism)
   - Verify network switches in wallet
   - Check balance updates

3. **Lender Flow**
   - Switch to Base Sepolia
   - Click "Mint 100 mUSDC"
   - Enter deposit amount (e.g., 25)
   - Click "Deposit"
   - Approve transaction in wallet
   - Wait for LayerZero finalization
   - Switch to Arbitrum and verify shares

4. **Borrower Flow**
   - Switch to Base Sepolia
   - Enter collateral amount (e.g., 0.0001 ETH)
   - Click "Deposit Collateral"
   - Wait for cross-chain update
   - Switch to Arbitrum Sepolia
   - Enter borrow amount (e.g., 20 mUSDC)
   - Select destination (Optimism)
   - Click "Borrow"
   - Switch to Optimism and verify MockUSDC received

5. **Repay Flow**
   - Switch to Arbitrum Sepolia
   - Enter repay amount
   - Click "Repay"
   - Verify loan status updates

### 5. Liquidation Monitor

```bash
npm run monitor:liquidations
```

**What it does:**
- Fetches Pyth price updates from Hermes
- Pushes updates to PriceOracle
- Scans all borrowers
- Checks health factors
- Triggers liquidations when health < 100%

**Configuration:**
Edit `monitor/config.json`:
- Contract addresses (auto-loaded from deployments.json)
- Pyth feed IDs
- Health factor threshold
- Polling interval

## 🐛 Common Issues & Solutions

### Issue: "Network not configured"
**Solution:** Check `.env` has correct RPC URLs

### Issue: "Missing address in deployments.json"
**Solution:** Run deployment scripts first

### Issue: "Insufficient funds"
**Solution:** Get testnet ETH from faucets

### Issue: "LayerZero message not finalizing"
**Solution:** 
- Check LayerZeroScan for message status
- Verify peers are configured
- Ensure sufficient gas for executor

### Issue: Frontend not loading contracts
**Solution:**
- Check `deployments.json` exists
- Verify API route `/api/deployments` works
- Check browser console for errors

### Issue: "Price feed not found"
**Solution:**
- Configure ETH price feed in PriceOracle
- Update Pyth feed ID in monitor config

## 📊 Expected Results

### After Lender Deposit (Base → Arbitrum)
- MockUSDC balance decreases on Base
- Shares increase on Arbitrum
- Pool totalDeposits increases

### After Collateral Deposit (Base)
- ETH balance decreases
- Collateral tracked on Arbitrum ProtocolCore
- Can now borrow against it

### After Cross-Chain Borrow (Arbitrum → Optimism)
- Loan created on Arbitrum
- MockUSDC arrives on Optimism
- Borrower's credit score updated

### After Repayment
- Loan principal/interest decreases
- Credit score improves
- Pool receives interest

## 🔍 Debugging Tools

### LayerZero Messages
- [LayerZeroScan](https://layerzeroscan.com/) - Track cross-chain messages

### Contract Verification
- [Arbiscan](https://sepolia.arbiscan.io/) - Arbitrum contracts
- [Basescan](https://sepolia.basescan.org/) - Base contracts
- [Optimism Explorer](https://sepolia-optimism.etherscan.io/) - Optimism contracts

### Pyth Prices
- [Pyth Hermes](https://hermes.pyth.network/) - Fetch price updates
- [Pyth Docs](https://docs.pyth.network/) - Integration guide

## 📈 Performance Benchmarks

- **LayerZero Message**: ~2-3 minutes
- **OFT Bridge**: ~2-3 minutes
- **Pyth Price Update**: ~400ms (on-chain)
- **Liquidation Check**: ~5-10 seconds per borrower

## ✅ Success Criteria

A successful test run should demonstrate:

1. ✅ Cross-chain deposits work (Base → Arbitrum)
2. ✅ Cross-chain borrowing works (Arbitrum → Optimism)
3. ✅ Credit scoring updates correctly
4. ✅ Repayments reduce debt
5. ✅ Shares accrue value from interest
6. ✅ Frontend displays all states correctly
7. ✅ Monitor can detect unhealthy positions

## 🚀 Next Steps After Testing

1. **Production Deployment**
   - Deploy to mainnets
   - Configure real USDC (not MockUSDC)
   - Set up monitoring infrastructure

2. **Security Audit**
   - Professional smart contract audit
   - LayerZero integration review
   - Pyth oracle integration review

3. **Frontend Enhancements**
   - Add transaction history
   - Real-time price feeds
   - Advanced analytics dashboard

4. **Additional Features**
   - More collateral types
   - Flash loans
   - Governance token

