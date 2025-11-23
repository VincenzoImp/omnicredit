# 🚀 Testnet Deployment Guide

Guida completa per deployare e testare OmniCredit Protocol su testnet.

---

## 📋 Prerequisiti

### 1. Environment Setup

Crea un file `.env` nella root del progetto:

```bash
# Wallet
PRIVATE_KEY=your_private_key_here

# RPC URLs
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc

# LayerZero V2 Endpoints (Base Sepolia)
LZ_ENDPOINT=0x6EDCE65403992e310A62460808c4b910D972f10f

# Pyth Network (Base Sepolia)
PYTH_CONTRACT=0x... # TODO: Add actual Base Sepolia Pyth address
ETH_PRICE_FEED_ID=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Get Testnet ETH

- **Base Sepolia**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **Arbitrum Sepolia**: https://faucet.quicknode.com/arbitrum/sepolia
- **Sepolia**: https://sepoliafaucet.com/

---

## 🏗️ Deployment Steps

### Step 1: Deploy Complete Protocol

Deploy tutti i contratti su Base Sepolia:

```bash
npx hardhat run scripts/deploy-complete-protocol.ts --network baseSepolia
```

Questo script:
- ✅ Deploy MockUSDC
- ✅ Deploy ContinuousCreditScore
- ✅ Deploy FeeBasedLimits
- ✅ Deploy PriceOracle
- ✅ Deploy ProtocolCore
- ✅ Deploy MockOFT
- ✅ Deploy LiquidationManager
- ✅ Configura tutti i contratti
- ✅ Salva deployment info in `deployment-info.json`

**Output Example:**
```
🚀 Deploying OmniCredit Protocol
==================================
Deployer: 0x...
Balance: 0.5 ETH

📝 Step 1: Deploying MockUSDC...
✅ MockUSDC deployed to: 0x...

📝 Step 2: Deploying ContinuousCreditScore...
✅ ContinuousCreditScore deployed to: 0x...

...

📊 DEPLOYMENT SUMMARY
==================================================
Network: baseSepolia
Chain ID: 84532

📋 Contract Addresses:
  MockUSDC: 0x...
  ContinuousCreditScore: 0x...
  FeeBasedLimits: 0x...
  PriceOracle: 0x...
  ProtocolCore: 0x...
  MockOFT: 0x...
  LiquidationManager: 0x...
```

### Step 2: Run Demo Flow

Testa il flusso completo del protocollo:

```bash
npx hardhat run scripts/demo-protocol-flow.ts --network baseSepolia
```

Questo script dimostra:
1. ✅ Lender deposita USDC
2. ✅ Borrower deposita ETH collateral
3. ✅ Borrower prende prestito
4. ✅ Borrower ripaga loan
5. ✅ Borrower ritira collateral

**Output Example:**
```
🎬 OmniCredit Protocol Demo
==========================

📝 Step 1: Lender deposits USDC
----------------------------------------
✅ Deposit successful!
  Lender shares: 10000.0
  Total assets in pool: 10000.0 USDC

📝 Step 2: Borrower deposits ETH collateral
----------------------------------------
✅ Collateral deposited!
  ETH collateral: 1.0
  Collateral value (USD): 2000.0 USDC

...
```

---

## 🧪 Testing Individual Components

### Test MockUSDC

```bash
npx hardhat run scripts/deploy-mock-usdc.ts --network baseSepolia
```

### Test Price Oracle

```typescript
// Get ETH price
const price = await priceOracle.getPrice(ethers.ZeroAddress);
console.log("ETH Price:", ethers.formatUnits(price, 18), "USD");

// Get collateral value
const value = await priceOracle.getAssetValueUSD(
  ethers.ZeroAddress,
  ethers.parseEther("1.0"),
  18
);
console.log("1 ETH =", ethers.formatUnits(value, 6), "USDC");
```

---

## 🔗 Cross-Chain Testing

### Setup Multi-Chain

1. **Deploy su Base Sepolia** (come sopra)

2. **Deploy LenderDepositWrapper su Arbitrum Sepolia**:

```bash
# TODO: Create deploy-cross-chain-wrapper.ts
npx hardhat run scripts/deploy-cross-chain-wrapper.ts --network arbitrumSepolia
```

3. **Configura LayerZero Peers**:

```typescript
// On Base Sepolia: Set ProtocolCore peer
await protocolCore.setPeer(arbitrumEid, wrapperAddress);

// On Arbitrum Sepolia: Set wrapper peer
await wrapper.setPeer(baseEid, protocolCoreAddress);
```

4. **Test Cross-Chain Deposit**:

```typescript
// On Arbitrum: Lender deposits cross-chain
await mockOFT.approve(wrapperAddress, amount);
await wrapper.depositCrossChain(amount, minAmount);
```

---

## 📊 Verification

### Verify Contracts on Explorer

```bash
# Base Sepolia Explorer: https://sepolia.basescan.org/

# Verify ProtocolCore
npx hardhat verify --network baseSepolia \
  <PROTOCOL_CORE_ADDRESS> \
  <MOCK_USDC_ADDRESS> \
  <CREDIT_SCORE_ADDRESS> \
  <FEE_LIMITS_ADDRESS> \
  <PRICE_ORACLE_ADDRESS> \
  <LZ_ENDPOINT> \
  <DELEGATE_ADDRESS>
```

### Check Contract State

```typescript
// Check total assets
const totalAssets = await protocolCore.totalAssets();
console.log("Total assets:", ethers.formatUnits(totalAssets, 6), "USDC");

// Check borrower positions
const collateral = await protocolCore.borrowerCollateral(borrowerAddress);
const loan = await protocolCore.borrowerLoans(borrowerAddress);
console.log("Collateral:", ethers.formatEther(collateral), "ETH");
console.log("Loan:", ethers.formatUnits(loan.principal, 6), "USDC");
```

---

## 🐛 Troubleshooting

### Error: Insufficient funds

**Solution**: Get more testnet ETH from faucets

### Error: Contract not found

**Solution**: Check `deployment-info.json` exists and has correct addresses

### Error: Price feed not configured

**Solution**: Run price oracle configuration:
```typescript
await priceOracle.addPriceFeed(ethers.ZeroAddress, ethPriceFeedId);
```

### Error: LayerZero message failed

**Solution**: 
- Check LayerZero endpoint is correct
- Verify peers are configured
- Ensure sufficient gas for cross-chain operations

---

## 📝 Next Steps

1. **Test all functions**: Deposit, borrow, repay, withdraw
2. **Test edge cases**: Max borrow, liquidation threshold
3. **Test cross-chain**: Deploy wrapper on other chains
4. **Monitor events**: Check contract events on explorer
5. **Load testing**: Test with multiple users

---

## 🔗 Useful Links

- **Base Sepolia Explorer**: https://sepolia.basescan.org/
- **LayerZero Docs**: https://docs.layerzero.network/
- **Pyth Network**: https://pyth.network/
- **Base Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet

---

## ✅ Checklist

- [ ] Environment variables configured
- [ ] Testnet ETH obtained
- [ ] All contracts deployed
- [ ] Demo flow executed successfully
- [ ] Contracts verified on explorer
- [ ] Cross-chain setup (if testing)
- [ ] All functions tested

---

**Happy Testing! 🎉**

