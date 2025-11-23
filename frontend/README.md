# OmniCredit Frontend

A modern, Web3-optimized frontend for the OmniCredit omnichain lending protocol.

## 🚀 Tech Stack

- **Vite** - Lightning-fast build tool optimized for modern web development
- **React 18** - UI library with hooks
- **TypeScript** - Type-safe development
- **Wagmi v2** - Modern React hooks for Ethereum
- **Viem** - TypeScript Ethereum library (ethers.js alternative)
- **RainbowKit** - Beautiful wallet connection UI
- **TanStack Query** - Powerful data fetching and caching
- **Tailwind CSS** - Utility-first CSS framework

## ✨ Features

### Multi-Chain Balance Display
- View balances across **Arbitrum Sepolia**, **Base Sepolia**, and **Optimism Sepolia**
- Real-time balance updates
- Native ETH and MockUSDC balances

### Lender Actions
- Mint MockUSDC (testnet only)
- Approve spending
- Deposit USDC to earn yield

### Borrower Actions
- Deposit ETH collateral on Base Sepolia
- Borrow USDC cross-chain to Optimism Sepolia
- Repay loans on Arbitrum Sepolia

## 🛠️ Setup

### Prerequisites
- Node.js 18+
- A Web3 wallet (MetaMask, Rainbow, etc.)
- Testnet ETH on Arbitrum, Base, and Optimism Sepolia

### Installation

```bash
cd frontend
npm install
```

### Configuration

1. Get a WalletConnect Project ID from https://cloud.walletconnect.com
2. Update `src/wagmi.ts` with your project ID:

```typescript
export const config = getDefaultConfig({
  appName: 'OmniCredit Protocol',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // <-- Add here
  chains: [arbitrumSepolia, baseSepolia, optimismSepolia],
  ssr: false,
});
```

### Run Development Server

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## 📦 Build for Production

```bash
npm run build
npm run preview
```

## 🎨 UI Components

### `Dashboard.tsx`
Main dashboard layout with header and action panels.

### `MultiChainBalances.tsx`
Displays balances across all three chains using Wagmi's `useBalance` and `useReadContract` hooks.

### `BalanceCard.tsx`
Reusable card component for displaying chain-specific balances.

### `LenderPanel.tsx`
UI for lender actions (mint, approve, deposit).

### `BorrowerPanel.tsx`
UI for borrower actions (collateral, borrow, repay).

## 🔗 Contract Interactions

The frontend uses Wagmi's modern hooks:

- `useAccount()` - Get connected wallet address
- `useBalance()` - Fetch native token balances
- `useReadContract()` - Read contract state
- `useWriteContract()` - Execute transactions
- `useWaitForTransactionReceipt()` - Wait for confirmations

## 🌐 Supported Networks

- **Arbitrum Sepolia** (Chain ID: 421614) - Core protocol
- **Base Sepolia** (Chain ID: 84532) - Collateral deposits
- **Optimism Sepolia** (Chain ID: 11155420) - Cross-chain borrowing

## 📝 Notes

- This is a testnet-only application
- All transactions require testnet ETH for gas
- MockUSDC can be minted freely for testing
- LayerZero cross-chain messages may take 1-2 minutes to complete

## 🐛 Troubleshooting

### "Failed to load deployments"
Ensure `deployments.json` is in the `public/` directory.

### "Network not supported"
Make sure your wallet is connected to one of the supported testnets.

### "Transaction failed"
Check that you have enough testnet ETH for gas fees.

## 📚 Learn More

- [Wagmi Documentation](https://wagmi.sh)
- [Viem Documentation](https://viem.sh)
- [RainbowKit Documentation](https://rainbowkit.com)
- [Vite Documentation](https://vitejs.dev)
