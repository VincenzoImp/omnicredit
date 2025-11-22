# OmniCredit Protocol

**The Decentralized, Omnichain Lending Market with a Reputation-Based Credit System.**

---

## 1. Overview

OmniCredit is a next-generation decentralized lending protocol designed to operate seamlessly across multiple blockchains. It addresses fundamental limitations in DeFi by creating a unified liquidity market and a novel credit system based on user reputation.

By leveraging LayerZero V2, Pyth Network, and Uniswap v4, OmniCredit allows users to deposit collateral on one chain (e.g., Ethereum) and borrow assets on another (e.g., Base) without the need for traditional asset bridging. It introduces a sophisticated credit scoring model that rewards reliable borrowers with increased capital efficiency, moving beyond the over-collateralized-only paradigm of traditional DeFi.

## 2. Core Features

-   **🌐 True Omnichain Lending:** Deposit collateral where you have it, borrow where you need it. Our architecture, powered by LayerZero V2, unifies liquidity across all supported chains.
-   **📈 Continuous Credit Scoring:** A novel, Sybil-resistant credit score (0-1000) based on a user's cumulative interest payment history. Good borrowers are rewarded with better terms.
-   **🛡️ Progressive & Fee-Based LTV:** Start with a safe 50% LTV and progress to as high as 150% as your credit score improves. An anti-gaming mechanism prevents abuse by ensuring the undercollateralized portion of any loan is backed by the borrower's proven history of interest payments.
-   **⚡ Real-Time, Secure Pricing:** Powered by the Pyth Network, the protocol uses high-frequency, oracle-validated price feeds to secure all collateral and protect against bad liquidations during market volatility.
-   **🦄 Uniswap v4 Liquidations:** Liquidations are executed through Uniswap v4 pools, featuring a dynamic fee hook to mitigate LVR for liquidity providers and a bonus structure that benefits the protocol's reserves.

## 3. System Architecture

The protocol operates on a hub-and-spoke model, with a core set of contracts on a central chain (e.g., Base) and collateral vaults on satellite chains.

```
┌──────────────────────────────────────────┐
│        Satellite Chains (e.g., ETH, ARB)         │
├──────────────────────────────────────────┤
│ ┌────────────────┐   ┌─────────────────┐ │
│ │ CollateralVault├─┬─► Pyth Price Oracle │ │
│ └────────────────┘ │ └─────────────────┘ │
│         ▲          │       (On-Chain)      │
│         │          │                       │
└─────────┼──────────────────────────────────┘
          │ (LayerZero Message: Deposit/Withdrawal Approval)
          ▼
┌──────────────────────────────────────────┐
│           Core Protocol Chain (e.g., Base)           │
├──────────────────────────────────────────┤
│ ┌────────────────────────┐                 │
│ │ CrossChainCoordinator  ├──────────┐      │
│ └────────────────────────┘          │      │
│               ▲                     ▼      │
│ ┌─────────────┴─────────────┐ ┌─────┴──────┐│
│ │      ProtocolCore         │ │LiquidationMngr ├─► Uniswap v4
│ │ (Lending, Repayments)     │ └─────┬──────┘│   (Liquidation Swaps)
│ └─────────────┬─────────────┘       │      │
│      ▲        │        ▲            │      │
│┌─────┴────┐ ┌─┴────────┴─┐ ┌────────┴─────┐│
││FeeBasedLimits││ContinuousCreditScore││Pyth Price Oracle ││
│└──────────┘ └──────────┘ └──────────────┘│
│                                          │
└──────────────────────────────────────────┘
```

For a complete technical breakdown, please see our [**Protocol Whitepaper**](./docs/OmniCredit_Protocol_Whitepaper.md).

## 4. Getting Started (Developer Setup)

Follow these steps to set up the project for local development and testing.

### Prerequisites
-   [Node.js](https://nodejs.org/en/) (v18 or later)
-   [pnpm](https://pnpm.io/), `npm`, or `yarn`

### Installation
1.  **Clone the repository:**
    ```sh
    git clone https://github.com/vincenzo-iacobazzi/omnichain.git
    cd omnichain
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    # or
    pnpm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file by copying the example file:
    ```sh
    cp .env.example .env
    ```
    Then, fill in the required variables in the `.env` file. You will need:
    -   `RPC_URL_ETHEREUM`, `RPC_URL_BASE`, etc. for connecting to different networks.
    -   `PRIVATE_KEY` for deploying contracts and running tests.

### Core Commands
-   **Compile Contracts:**
    ```sh
    npx hardhat compile
    ```
    This will compile the Solidity contracts and generate TypeChain artifacts.

-   **Run Tests:**
    ```sh
    npx hardhat test
    ```
    This will run the full suite of tests for the protocol.

-   **Deploy Contracts:**
    Deployment scripts are located in the `scripts/` directory. You can run them using:
    ```sh
    npx hardhat run scripts/deploy.ts --network <your_network>
    ```

## 5. Repository Structure

```
.
├── contracts/        # All Solidity smart contracts
│   ├── base/         # Core protocol logic (deployed on Base)
│   ├── cross-chain/  # Contracts for omnichain functionality
│   └── hooks/        # Uniswap v4 Hooks
├── docs/             # Detailed documentation and whitepapers
├── ignition/         # Hardhat Ignition deployment modules
├── knowledge/        # Original specification documents
├── scripts/          # Deployment and interaction scripts
└── test/             # Protocol tests
```

## 6. Key Contracts

This is a high-level overview. For a detailed explanation, see the [Whitepaper](./docs/OmniCredit_Protocol_Whitepaper.md).

-   `ProtocolCore.sol`: The main lending pool contract for deposits, withdrawals, borrowing, and repayments.
-   `ContinuousCreditScore.sol`: Manages the reputation-based credit scoring system.
-   `FeeBasedLimits.sol`: Enforces the anti-gaming borrowing limits.
-   `CollateralVault.sol`: Secures collateral on satellite chains and reports its value to the core protocol.
-   `CrossChainCoordinator.sol`: Aggregates collateral value from all chains and manages the secure withdrawal handshake.
-   `LiquidationManager.sol`: Manages the Dutch auction and Uniswap v4 liquidation process.
-   `PriceOracle.sol`: A secure wrapper for the Pyth Network price feeds.

## 7. Contributing

Contributions are welcome! If you'd like to contribute, please follow these steps:

1.  Fork the repository.
2.  Create a new feature branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes and commit them (`git commit -m 'Add some feature'`).
4.  Push to the branch (`git push origin feature/your-feature-name`).
5.  Open a Pull Request.

Please make sure to add tests for any new features or bug fixes.

## 8. License

This project is licensed under the MIT License.
