# Transaction Guide

## Common Issues and Solutions

### Fee Estimation Failures

The frontend now includes **manual gas limits** to prevent fee estimation failures:

- **Mint**: 200,000 gas
- **Approve**: 100,000 gas  
- **Deposit**: 300,000 gas
- **Deposit Collateral**: 500,000 gas + 0.01 ETH LayerZero fee
- **Borrow Cross-Chain**: 1,000,000 gas + 0.02 ETH LayerZero fee
- **Repay**: 300,000 gas

### LayerZero Cross-Chain Fees

Cross-chain transactions require extra ETH for LayerZero messaging:

| Action | Chain | Extra Fee Required |
|--------|-------|-------------------|
| Deposit Collateral | Base Sepolia | ~0.01 ETH |
| Borrow Cross-Chain | Arbitrum Sepolia | ~0.02 ETH |

**Important**: When depositing collateral, the frontend automatically adds the LayerZero fee to your transaction value.

### Chain Switching

The UI now shows warnings when you're on the wrong chain:

- **Lender Actions** → Requires **Arbitrum Sepolia**
- **Deposit Collateral** → Requires **Base Sepolia**
- **Borrow/Repay** → Requires **Arbitrum Sepolia**

Buttons are automatically disabled when you're on the wrong chain, with a yellow warning indicator.

## Transaction Workflow

### For Lenders (Arbitrum Sepolia)

1. **Switch to Arbitrum Sepolia** in your wallet
2. **Mint MockUSDC** (testnet only)
3. **Approve** ProtocolCore to spend USDC
4. **Deposit** USDC to start earning yield

### For Borrowers

#### Step 1: Deposit Collateral (Base Sepolia)

1. **Switch to Base Sepolia**
2. Enter ETH amount (e.g., 0.0001)
3. Click **Deposit** (automatically includes ~0.01 ETH LayerZero fee)
4. Wait 1-2 minutes for cross-chain message

#### Step 2: Borrow (Arbitrum Sepolia)

1. **Switch to Arbitrum Sepolia**
2. Enter USDC amount to borrow
3. Click **Borrow** (requires ~0.02 ETH for LayerZero fee)
4. USDC will arrive on Optimism Sepolia in 1-2 minutes

#### Step 3: Repay (Arbitrum Sepolia)

1. **Stay on Arbitrum Sepolia**
2. Ensure you have MockUSDC (mint if needed)
3. **Approve** ProtocolCore to spend USDC
4. Enter repayment amount
5. Click **Repay**

## Error Messages

### "Transaction failed. Make sure you have enough ETH for gas + LayerZero fees"

**Solution**: Ensure you have at least 0.02-0.03 ETH extra in your wallet for cross-chain transactions.

### "Transaction failed. Make sure you have approved USDC first"

**Solution**: Click the "Approve" button before attempting to deposit or repay.

### "Transaction failed. Make sure you have collateral deposited"

**Solution**: Deposit collateral on Base Sepolia before attempting to borrow.

## Tips

1. **Always check your chain** - The UI will warn you if you're on the wrong network
2. **Keep extra ETH** - Cross-chain transactions need 0.01-0.02 ETH for LayerZero fees
3. **Wait for confirmations** - Cross-chain messages take 1-2 minutes
4. **Check console** - Open browser DevTools for detailed error messages
5. **Small amounts first** - Test with 0.0001 ETH before larger transactions

## Testnet Faucets

Get free testnet ETH:

- **Arbitrum Sepolia**: https://faucet.quicknode.com/arbitrum/sepolia
- **Base Sepolia**: https://faucet.quicknode.com/base/sepolia
- **Optimism Sepolia**: https://faucet.quicknode.com/optimism/sepolia

## Technical Details

### Why Manual Gas Limits?

Wagmi's automatic gas estimation can fail for complex cross-chain transactions because:

1. LayerZero messages have variable costs
2. Cross-chain state changes are hard to estimate
3. OFT transfers involve multiple contracts

By setting manual gas limits, we ensure transactions can be submitted even when estimation fails.

### Why Higher LayerZero Fees?

The 0.01-0.02 ETH fees are conservative estimates that ensure:

1. Messages are delivered reliably
2. Transactions don't fail due to insufficient fees
3. Users don't need to calculate fees manually

Unused fees are typically refunded by LayerZero.

