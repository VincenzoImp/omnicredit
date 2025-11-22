# OmniCredit Protocol: Project Roadmap

**Status:** Post-Audit & Initial Remediation
**Next Phase:** Validation and Production Readiness

---

## 1. Task Overview

Following a comprehensive audit and the remediation of several critical vulnerabilities, the OmniCredit protocol is now significantly more secure and architecturally sound. The next phase of work is focused on validating these changes, hardening the protocol for production, and building the necessary infrastructure for its operation.

This document outlines the key tasks required to move the project toward a mainnet launch. They are listed in order of priority.

---

## 2. Development Roadmap

### 🔲 **[Pending]** Task 2: Develop Robust Deployment & Configuration Scripts
*   **Objective:** To create a reliable, repeatable, and secure process for deploying and configuring the entire protocol stack on any target network.
*   **Key Sub-Tasks:**
    *   [ ] Write Hardhat Ignition modules or deployment scripts for all contracts.
    *   [ ] Script the post-deployment configuration steps, including:
        *   Authorizing contracts (e.g., `ProtocolCore` in `CrossChainCoordinator`).
        *   Setting oracle addresses and Pyth price feed IDs.
        *   Setting the Uniswap v4 pool key in `LiquidationManager`.
        *   Configuring LayerZero V2 endpoint addresses and peer settings.

---

### 🔲 **[Pending]** Task 3: Build Off-Chain Keeper Bot Infrastructure
*   **Objective:** To develop and deploy the necessary off-chain services required for the protocol's autonomous operation.
*   **Key Sub-Tasks:**
    *   [ ] **Liquidation Bot:**
        *   Develop a bot to monitor `LiquidationManager.isLiquidatable` for all active loans.
        *   The bot must be able to trigger `startAuction` and `executeLiquidation` when a position is ready.
    *   [ ] **Oracle Price Bot:**
        *   Develop a bot to fetch price updates from the Pyth Hermes API.
        *   The bot must periodically call `PriceOracle.updatePriceFeeds` with the required fee to ensure on-chain prices remain fresh.

---

### 🔲 **[Pending]** Task 4: Frontend Application Development
*   **Objective:** To build a user-friendly web interface for interacting with the OmniCredit protocol.
*   **Key Sub-Tasks:**
    *   [ ] Design UI/UX for all user workflows (deposit, borrow, repay, etc.).
    *   [ ] Develop components for displaying user credit scores, loan status, and collateral value.
    *   [ ] Integrate with browser wallets (e.g., MetaMask) for transaction signing.
    *   [ ] Use a modern web framework (e.g., Next.js, React) as suggested in the original specification.
