# Whitepaper: The OmniCredit Protocol

**Version:** 4.0 (Audited & Remediated Technical Specification)
**Status:** Final

---

## Abstract

The OmniCredit Protocol represents a next-generation decentralized lending market designed to operate seamlessly across multiple blockchains. It addresses fundamental limitations in the DeFi space—namely, capital fragmentation, the absence of a meaningful credit system, and the economic risks of oracle latency and protocol gaming. By leveraging a novel continuous credit scoring system, a secure cross-chain architecture powered by LayerZero V2, real-time pricing from the Pyth Network, and deep integration with Uniswap v4, OmniCredit creates a unified, capital-efficient, and more secure lending experience. This document provides an exhaustive technical specification of the protocol's architecture, smart contract logic, security model, and core user workflows as of the audited and remediated version 4.0.

---

## 1. Introduction: The Problem with Fragmented Lending

The decentralized finance landscape, while innovative, is siloed. Liquidity and assets are predominantly locked within the ecosystems of individual blockchains. This fragmentation leads to several critical inefficiencies and risks for users:

1.  **Poor Capital Efficiency:** A user with collateral on Ethereum cannot use it to borrow assets on a Layer 2 network like Base without resorting to slow, expensive, and often insecure third-party bridges.
2.  **Lack of Credit History:** Traditional DeFi protocols are memoryless. A borrower who has reliably paid back dozens of loans is treated identically to a first-time user, resulting in universally conservative and inefficient Loan-to-Value (LTV) ratios.
3.  **Economic Vulnerabilities:** Existing protocols are susceptible to "farm-and-run" attacks, where users build a superficial history to qualify for undercollateralized loans and then default. Furthermore, reliance on slow-updating oracles creates a significant window for MEV exploitation and bad liquidations during market volatility.

OmniCredit is architected from the ground up to solve these problems.

---

## 2. Core Protocol Concepts

### 2.1. Continuous Credit Scoring: A Reputation-Based System

The protocol's most significant innovation is its Sybil-resistant credit scoring engine, managed by the `ContinuousCreditScore` contract. Unlike models that rely on loan size or frequency, OmniCredit's score is a direct function of a user's proven financial reliability: **cumulative interest paid**.

#### The Scoring Formula
A user's score, ranging from 0 to 1000, is calculated as follows:

`Score = (Base Score * Streak Multiplier) - Liquidation Penalties`

-   **Base Score:** For every $10 of lifetime interest a user pays into the protocol, they earn 1 point. This directly ties the score to the user's tangible financial commitment and risk paid into the system.
    
-   **Streak Multiplier:** To reward consistent, reliable behavior, the protocol applies a multiplier based on consecutive "on-time" loan repayments. An "on-time" repayment is one that occurs before the loan's `dueDate` (30 days from issuance). Each consecutive on-time payment adds a 5% bonus to the base score, up to a maximum multiplier of 150% (a 50% total bonus). A single late repayment resets the streak to zero, ensuring only consistently reliable borrowers benefit.
    
-   **Liquidation Penalty:** To penalize default and reckless borrowing, each liquidation event deducts a flat 200 points from the user's score. This is a severe penalty that immediately reduces a user's borrowing power and requires significant interest repayment to recover from.

This system is inherently resistant to gaming. A user cannot cheaply build a high score by taking out many small, short-term loans, as the interest generated (and thus points earned) would be negligible. The only way to build a meaningful score is through long-term, reliable participation in the protocol.

### 2.2. Progressive & Fee-Based LTV

A user's credit score directly and linearly translates to their borrowing power (LTV):

-   **Score 0:** 50% LTV
-   **Score 500:** 100% LTV
-   **Score 1000:** 150% LTV

While a 150% LTV introduces the risk of undercollateralized loans, the protocol mitigates this with a second, crucial security check managed by the `FeeBasedLimits` contract.

#### The Anti-Gaming Mechanism
A user's maximum loan amount is **not** just their LTV-based limit. It is the strict minimum of two values:

1.  **LTV-Based Limit:** `Collateral Value * LTV`
2.  **Interest-Buffered Limit:** `Collateral Value + (Total Interest Paid * 0.5)`

**This is the protocol's primary defense against "farm-and-run" attacks.** Consider a user who has paid a total of $1,000 in interest and has a 125% LTV. They wish to borrow against $10,000 in collateral.

-   Their LTV-based limit is `$10,000 * 1.25 = $12,500`.
-   Their interest-buffered limit is `$10,000 + ($1,000 * 0.5) = $10,500`.

The protocol will only allow them to borrow **$10,500**. The undercollateralized portion of the loan ($500) is less than the interest they have already paid into the system ($1,000), making it economically irrational for them to default.

---

## 3. System Architecture & Smart Contracts

The protocol operates on a hub-and-spoke model. A "Core Protocol Chain" (e.g., Base) runs the primary lending logic, while "Satellite Chains" (e.g., Ethereum, Arbitrum) are used for collateral deposits.

### 3.1. Core Logic Contracts (Base Chain)

#### `ProtocolCore.sol`
The heart of the protocol, managing liquidity and the entire loan lifecycle.

-   **Key State Variables:**
    -   `lendingToken`: The `IERC20` interface for the primary lending asset (USDC).
    -   `creditScore`, `feeBasedLimits`, `priceOracle`, `coordinator`: Interfaces to the other core contracts.
    -   `shares`, `totalShares`: Standard share-based accounting for the liquidity pool.
    -   `totalDeposits`, `totalBorrowed`: High-level pool statistics.
    -   `loans`: A `mapping(address => Loan)` storing the state of every active loan.
    -   `Loan` (struct): Contains `principal`, `interestRate`, `accruedInterest`, `collateralValueUSD`, `isActive`, and the critical `dueDate`.

-   **Key Functions:**
    -   `borrow(amount, collateralValueUSD)`:
        1.  Verifies the loan is active and meets the minimum size.
        2.  Checks for sufficient liquidity in the pool.
        3.  Fetches cross-chain collateral value: `totalCollateral += coordinator.getTotalCollateral(msg.sender)`.
        4.  Validates the loan against the two-part limit:
            -   First, a loose check against LTV: `require(amount <= (totalCollateral * creditScore.getLTV(msg.sender)) / 10000)`.
            -   Then, the strict check against the fee-based limit: `require(amount <= feeBasedLimits.calculateMaxBorrow(msg.sender, totalCollateral))`.
        5.  Calculates the interest rate.
        6.  Creates the `Loan` struct, critically setting `dueDate: block.timestamp + LOAN_DURATION`.
        7.  Updates pool statistics and calls `creditScore.recordLoanTaken(msg.sender)`.
        8.  Transfers the USDC to the borrower.
    -   `repay(amount)`:
        1.  Verifies the user has an active loan.
        2.  Accrues any pending interest.
        3.  **Determines loan status:** `bool onTime = block.timestamp <= loan.dueDate;`. This was a critical fix.
        4.  Calculates interest vs. principal paid.
        5.  If fully repaid, deactivates the loan.
        6.  **Updates credit score:** `creditScore.recordRepayment(msg.sender, interestPaid, onTime);`. This call is now correct and includes the `onTime` boolean.
        7.  Transfers funds from the user.

#### `LiquidationManager.sol`
Manages the process of liquidating undercollateralized loans via Uniswap v4.

-   **Key State Variables:**
    -   `priceOracle`, `creditScore`, `lendingPool`: Interfaces to other core contracts.
    -   `poolManager`: The `IPoolManager` interface for Uniswap v4.
    -   `liquidationPool`: The `PoolKey` for the specific ETH-USDC pool where liquidations occur.
    -   `auctions`: A `mapping(bytes32 => Auction)` to track active Dutch auctions.

-   **Key Functions:**
    -   `startAuction(borrower)`:
        1.  Verifies the loan is liquidatable by checking `lendingPool.getHealthFactor(borrower)`.
        2.  **Calculates collateral amount to seize:** `uint256 collateralAmount = (collateralValue * 1e18) / collateralPrice;`. This formula was **critically fixed** to be mathematically sound, preventing incorrect seizure of assets. `collateralValue` (6 decimals) is normalized against `collateralPrice` (18 decimals) to yield the correct 18-decimal ETH amount.
        3.  Creates and stores a new `Auction` struct.
    -   `executeLiquidation(auctionId)`:
        1.  Calculates the current liquidation bonus based on the Dutch auction's elapsed time.
        2.  Prepares and executes a swap on Uniswap v4 via `poolManager.swap()`, selling the seized collateral for USDC. It passes `hookData` to notify the `LiquidationHook`.
        3.  **Distributes proceeds:**
            -   The exact debt amount is repaid to the `lendingPool`.
            -   **Logic Fix:** The entire remaining amount of USDC received from the swap (the surplus) is transferred to the `lendingPool`'s reserves. The bonus is **not** paid to the liquidator, aligning with the spec's goal of benefiting the protocol.
        4.  Calls `creditScore.recordLiquidation(auction.borrower)` to penalize the borrower.

### 3.2. Cross-Chain Contracts & Security

The cross-chain functionality is handled with extreme care to prevent economic exploits.

#### `CollateralVault.sol` (Satellite Chains)
This contract's sole purpose is to securely hold collateral and report its value to the core protocol. Its logic was hardened against two critical vulnerabilities.

-   **Security Model:**
    -   **Oracle-Based Valuation:** The `depositToken` and `depositNative` functions **no longer accept a user-provided value**. When a user deposits assets, the contract itself calls an on-chain Pyth `PriceOracle` to get the asset's price and calculates the value internally. This calculated, trusted value is then sent in the LayerZero message. This prevents a user from lying about the value of their deposit.
        
        ```solidity
        // Inside depositNative()
        uint256 valueUSD18 = priceOracle.getAssetValueUSD(NATIVE_TOKEN, msg.value, decimals);
        uint256 valueUSD6 = valueUSD18 / 1e12; // Convert to 6 decimals for coordinator
        _sendCollateralUpdate(msg.sender, valueUSD6, true);
        ```
        
    -   **Secure Withdrawal Handshake:** A user cannot simply withdraw their collateral. The `withdraw` function is gated by a `withdrawalAllowance`. This allowance is only increased when the vault receives a secure LayerZero message from the `CrossChainCoordinator`. This creates an explicit approval flow, ensuring collateral is only released *after* a loan is confirmed as repaid on the core chain.
        
        ```solidity
        // Inside _lzReceive() from coordinator
        if (messageType == 2) { // withdrawal approval
            withdrawalAllowance[user][asset] += amount;
        }
        
        // Inside withdraw()
        require(amount <= withdrawalAllowance[msg.sender][asset], "Not approved");
        withdrawalAllowance[msg.sender][asset] -= amount;
        ```

#### `CrossChainCoordinator.sol` (Base Chain)
Acts as the secure aggregator for all cross-chain collateral data.

-   **Key Functions:**
    -   `_lzReceive(...)`: Securely listens for messages. It uses the `authorizedVaults` mapping to ensure it only processes messages from official, deployed `CollateralVault` contracts, preventing spoofed messages.
    -   `sendUnlockMessage(...)`: This new function was added to facilitate the secure withdrawal handshake. It can only be called by an authorized address (the `ProtocolCore` contract) and is used to initiate the message that grants withdrawal allowance on a satellite chain.

### 3.3. Uniswap v4 Hooks

#### `LiquidationHook.sol`
This hook attaches to the liquidation pool to apply dynamic fees, mitigating Loss Versus Rebalancing (LVR) for liquidity providers.

-   **Security Fix:** The price source for volatility calculation was **fixed**. Instead of using a manipulable swap parameter, the hook now reads the pool's true price directly from its `slot0` state via the `poolManager`.
    
    ```solidity
    // Inside _estimatePrice()
    (uint160 sqrtPriceX96,,,,,) = poolManager.getSlot0(key);
    price = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> 192;
    ```

---

## 4. Security Model

The protocol's security is built on a defense-in-depth model.

1.  **Economic Security:**
    -   The fee-based borrowing limit is the primary defense against protocol default, ensuring that undercollateralized loans are only available to users with a proven, financially significant history.
    -   The liquidation bonus structure, which directs surplus to the protocol reserves, strengthens the protocol's solvency over time.
2.  **Oracle Security:**
    -   All collateral valuation is performed via a trusted Pyth `PriceOracle` contract, eliminating user-provided price exploits.
    -   The oracle wrapper includes checks for price staleness and abnormally wide confidence intervals to halt operations during oracle downtime or market chaos.
    -   The use of a `getConservativePrice` (`price - confidence`) for liquidations protects borrowers from unfair liquidations during volatility.
3.  **Cross-Chain Security:**
    -   All cross-chain communication relies on LayerZero V2.
    -   The `CrossChainCoordinator` only accepts messages from whitelisted `CollateralVault` contracts, preventing message spoofing.
    -   The withdrawal process requires a secure handshake, preventing a user from withdrawing collateral for an active loan.
4.  **Smart Contract Security:**
    -   Standard protections like `ReentrancyGuard` and `Ownable` are used where appropriate.
    -   Access control is granular. For example, only the `ProtocolCore` can authorize an unlock message from the `CrossChainCoordinator`. Only the `LiquidationManager` can mark a loan as repaid from a liquidation.

---

## 5. Conclusion

The OmniCredit protocol, as specified in this version 4.0 document, is a robust and secure system for omnichain lending. The initial design, while innovative, contained several critical vulnerabilities that have been systematically identified, addressed, and remediated. The final architecture is a resilient framework that leverages a multi-layered security model to protect user funds while delivering on the promise of a more efficient, unified, and reputation-based DeFi lending market.
