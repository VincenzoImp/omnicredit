# OmniCredit Protocol: A Technical Deep Dive

**Version:** 4.0 (Audited & Remediated)
**Status:** Final

---

## 1. Executive Summary

OmniCredit is a decentralized, omnichain lending protocol designed to transcend the limitations of traditional DeFi lending. It establishes a global credit system and unified liquidity market, allowing users to deposit collateral on one blockchain and borrow assets on another seamlessly.

Powered by LayerZero V2 for cross-chain messaging, Pyth Network for real-time price feeds, and integrated with Uniswap v4 for liquidations, OmniCredit introduces several core innovations:

- **True Omnichain Lending:** Deposit collateral on Ethereum, borrow assets on Base, and vice-versa, without the need for traditional asset bridging.
- **Continuous Credit Scoring:** A novel, Sybil-resistant credit score (0-1000) based on a user's cumulative interest payment history, rewarding long-term, reliable borrowers.
- **Progressive & Fee-Based LTV:** Loan-to-Value (LTV) ratios that progress from a conservative 50% to as high as 150% for top-tier borrowers. This is secured by an anti-gaming mechanism that limits borrowing based on a user's proven financial track record (total interest paid).
- **Secure, Oracle-Validated Collateral:** All collateral deposited on any chain is valued using a trusted Pyth price oracle at the time of deposit, eliminating attack vectors related to user-provided price data.
- **Robust Liquidation Mechanism:** A Dutch auction-based liquidation system executed through Uniswap v4, featuring dynamic fees to mitigate LVR and a bonus structure that benefits the protocol's reserves rather than just the liquidator.

This document provides a comprehensive technical breakdown of the audited and corrected OmniCredit protocol.

---

## 2. Core Protocol Concepts

### 2.1. Continuous Credit Scoring

The protocol's cornerstone is the `ContinuousCreditScore` contract, which assigns a credit score based on a user's demonstrated reliability.

- **Formula:** 
  `Score = (Base Score * Streak Multiplier) - Liquidation Penalties`
  - **Base Score:** Calculated directly from total lifetime interest paid. Every $10 of interest paid equates to 1 point.
  - **Streak Multiplier:** Good behavior is rewarded. Each consecutive on-time loan repayment adds a 5% bonus to the base score, capped at a 150% total multiplier. A late repayment resets this streak.
  - **Liquidation Penalty:** Each liquidation event deducts a flat 200 points from the user's score, severely penalizing defaults.

- **On-Time Repayments:** A loan is considered "on-time" if it is fully repaid before its `dueDate`, which is set to 30 days from the moment the loan is issued.

### 2.2. Progressive LTV

A user's credit score directly determines their borrowing power through a linear LTV progression:
- **Score 0:** 50% LTV
- **Score 500:** 100% LTV
- **Score 1000:** 150% LTV

This allows new users to start with safe, overcollateralized loans while rewarding proven users with significantly higher capital efficiency.

### 2.3. Fee-Based Loan Limits (Anti-Gaming)

To prevent users from abusing a high LTV to take out a large, risky loan and abscond, a second check is enforced by the `FeeBasedLimits` contract. A user's maximum borrowing amount is the **minimum** of two distinct calculations:

1.  **LTV-Based Limit:** `Collateral Value * LTV`
2.  **Interest-Buffered Limit:** `Collateral Value + (Total Interest Paid * 0.5)`

This "interest buffer" ensures that the undercollateralized portion of any loan is always backed by a significant history of interest payments, making "farm and run" attacks economically unviable.

---

## 3. System Architecture

The protocol is composed of several key smart contracts that work in concert across multiple blockchains. The core protocol logic resides on a central chain (e.g., Base), while collateral can be deposited on any supported satellite chain (e.g., Ethereum, Arbitrum).

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

---

## 4. Smart Contract Breakdown

### 4.1. Core Logic Contracts (Base Chain)

#### `ProtocolCore.sol`
This is the central nervous system of the protocol, managing all lending and borrowing operations.
- **State:** Holds all lender deposits, tracks total borrowed funds, and maintains a `Loan` struct for each borrower. The `Loan` struct was updated to include a `dueDate` to enable correct on-time repayment tracking.
- **`deposit(amount)`:** Lenders deposit USDC and receive shares representing their portion of the pool.
- **`withdraw(shareAmount)`:** Lenders burn shares to withdraw their portion of the pool's underlying USDC.
- **`borrow(amount, collateralValueUSD)`:** A borrower can take a loan. This function performs the critical security checks:
    1. It fetches cross-chain collateral value from the `CrossChainCoordinator`.
    2. It queries `FeeBasedLimits` to get the user's absolute maximum borrow amount.
    3. It ensures the requested loan does not exceed this limit.
- **`repay(amount)`:** Handles full or partial loan repayments. This function was **critically fixed** to determine if a repayment is on-time (`block.timestamp <= loan.dueDate`) and passes this boolean to `creditScore.recordRepayment`, ensuring the credit score streak mechanism works as intended and preventing a fatal bug that would have frozen all repayments.

#### `ContinuousCreditScore.sol`
Manages user credit scores.
- **`recordRepayment(user, interestPaid, onTime)`:** This function's signature was **fixed**. It now accepts the `onTime` boolean from a trusted caller (`ProtocolCore`), preventing a logic vulnerability where the on-time status could be gamed.
- **`calculateCreditScore(user)`:** A view function that computes a user's score based on their history.
- **`getLTV(user)`:** Returns the user's current LTV in basis points based on their score.
- **Architectural Fix:** A redundant `getMaxLoanAmount` function was removed from this contract to establish `FeeBasedLimits` as the single source of truth, improving modularity and maintainability.

#### `FeeBasedLimits.sol`
Enforces the anti-gaming borrowing limit.
- **`calculateMaxBorrow(user, collateralValue)`:** The primary function. It returns the `min(LTV-Based Limit, Interest-Buffered Limit)`. It is the sole authority for this calculation.
- **`validateBorrowRequest(...)`:** A helper used by `ProtocolCore` to verify a borrow request before execution.

#### `LiquidationManager.sol`
Handles the logic for liquidating under-collateralized loans.
- **`startAuction(borrower)`:** Kicks off a Dutch auction for a liquidatable position. The formula to calculate the amount of collateral to be seized was **critically fixed** to be mathematically correct, preventing the seizure of an incorrect amount of assets.
- **`executeLiquidation(auctionId)`:** Called by a liquidator to perform the liquidation.
    - It integrates with Uniswap v4 by calling `poolManager.swap()`, passing `hookData` to trigger the `LiquidationHook`.
    - **Logic Fix:** The liquidation bonus is no longer paid to the liquidator. The implementation was **corrected** to send the entire surplus generated from the swap (debt repaid vs. collateral sold) to the `ProtocolCore`'s reserves, directly benefiting the protocol's lenders as the specification intended.

#### `PriceOracle.sol`
A secure wrapper around the Pyth Network SDK.
- **`getPrice(asset)`:** Returns the current price of an asset, validated for staleness and confidence.
- **`getConservativePrice(asset)`:** This function was **added** to align with the specification. It returns `price - confidence`, providing a more borrower-friendly price during liquidations.
- **`getAssetValueUSD(...)`:** A crucial helper function that calculates the USD value of a given amount of an asset. This is used by the `CollateralVault` to securely value deposits.

### 4.2. Cross-Chain Contracts

#### `CollateralVault.sol` (Satellite Chains)
Secures user collateral on satellite chains.
- **Vulnerability Fixed:** The `depositNative` and `depositToken` functions were **critically patched**. They no longer accept a user-provided `valueUSD`. Instead, they now use the on-chain `PriceOracle` to securely calculate the value of the deposited assets *before* sending the LayerZero message. This closes a major economic exploit.
- **Vulnerability Fixed:** The `withdraw` function was **critically patched**. It now checks against a `withdrawalAllowance` mapping. A user can only withdraw collateral after `_lzReceive` has received an approval message from the `CrossChainCoordinator`, which populates this allowance. This prevents users from withdrawing collateral before repaying their loans.

#### `CrossChainCoordinator.sol` (Base Chain)
Receives and aggregates collateral updates from all `CollateralVaults`.
- **`_lzReceive(...)`:** Listens for messages from authorized vaults and updates a user's total `userCollateralUSD`.
- **`sendUnlockMessage(...)`:** This **new function was added** to complete the secure withdrawal loop. After a loan is repaid in `ProtocolCore`, it calls this function, which sends a LayerZero message to the appropriate `CollateralVault` to approve the withdrawal of the specified collateral.

### 4.3. Uniswap v4 Hooks

#### `LiquidationHook.sol`
A hook attached to the liquidation pool (e.g., ETH/USDC) to apply dynamic fees.
- **Vulnerability Fixed:** The price source used for calculating volatility was **patched**. It no longer uses a user-controllable swap parameter (`sqrtPriceLimitX96`). Instead, it now correctly reads the pool's actual `sqrtPriceX96` from `slot0`, making the dynamic fee calculation secure and accurate.



---

## 5. Workflows (Corrected & Secured)

### Depositing Collateral (Satellite Chain)
1. User calls `depositToken` or `depositNative` on `CollateralVault`.
2. `CollateralVault` accepts the tokens/ETH.
3. `CollateralVault` calls the on-chain `PriceOracle` to get the trusted USD value of the deposit.
4. `CollateralVault` sends a LayerZero message to `CrossChainCoordinator` on Base, containing the user's address and the oracle-derived value.
5. `CrossChainCoordinator` receives the message, validates it's from an authorized vault, and adds the value to the user's total collateral credit (`userCollateralUSD`).

### Repaying a Loan and Withdrawing Collateral
1. Borrower calls `repay` on `ProtocolCore` on Base.
2. `ProtocolCore` determines if the repayment was `onTime` and updates the user's credit score via `ContinuousCreditScore`.
3. If the loan is fully repaid, the user (or an application) calls a function on `ProtocolCore` which in turn calls `CrossChainCoordinator.sendUnlockMessage`, specifying the user, collateral chain, asset, and amount.
4. `CrossChainCoordinator` sends a LayerZero message to the `CollateralVault` on the satellite chain.
5. `CollateralVault._lzReceive` gets the message and increases the user's `withdrawalAllowance`.
6. The user can now call `withdraw` on the `CollateralVault` to securely retrieve their collateral.

---

## 6. Conclusion

This intensive audit and remediation process has transformed the OmniCredit protocol from a promising but vulnerable concept into a significantly more secure, robust, and production-ready system. By closing critical economic exploits, fixing fatal logic bugs, and aligning the implementation with the specification's core principles, the protocol is now built on a much stronger foundation.
