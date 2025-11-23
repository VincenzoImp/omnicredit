# OmniCredit Example Workflows

These scripts show end-to-end flows (lending, borrowing, cross-chain collateral) using the same deployer key defined in `.env`. Transactions always use tiny dev amounts (0.0001 ETH, 20–25 MockUSDC) to keep costs low.

> **Prerequisites**
>
> 1. `.env` contains `PRIVATE_KEY` plus RPC URLs for `arbitrumSepolia`, `baseSepolia`, `optimismSepolia`.
> 2. `deployments.json` is populated (use the existing Ignition scripts).
> 3. Run `npm install` once to ensure dependencies.

## 1. Inspect balances on any chain

```bash
# Arbitrum (campaign shares + loans)
npx hardhat run scripts/examples/show-balances.ts --network arbitrumSepolia

# Base (MockUSDC)
npx hardhat run scripts/examples/show-balances.ts --network baseSepolia

# Optimism (MockUSDC after cross-chain borrow)
npx hardhat run scripts/examples/show-balances.ts --network optimismSepolia
```

## 2. Lender deposit from Base → Arbitrum

```bash
npx hardhat run scripts/examples/lender-deposit-base.ts --network baseSepolia
```

Flow:
- Mints 100 MockUSDC if balance is low.
- Approves `LenderVault`.
- Quotes LayerZero fee and deposits 25 MockUSDC.
- Shares are minted on Arbitrum once the message finalizes (check via `show-balances` on Arbitrum).

## 3. Borrower collateral (Base ETH)

```bash
npx hardhat run scripts/examples/deposit-collateral-base.ts --network baseSepolia
```

Flow:
- Sends `0.0001` ETH to `CollateralVault`.
- LayerZero message updates `ProtocolCore` on Arbitrum automatically.
- Wait for the cross-chain receipt (few minutes) before borrowing.

## 4. Borrow MockUSDC to Optimism

```bash
npx hardhat run scripts/examples/borrow-crosschain-optimism.ts --network arbitrumSepolia
```

Flow:
- Quotes the LayerZero fee for sending MockUSDC to Optimism.
- Calls `borrowCrossChain` on `ProtocolCore`.
- After finalization, MockUSDC arrives on Optimism (verify with `show-balances` on that network).

### Suggested Demo Narrative

1. **Fund the lender pool** – run _lender deposit_ script on Base.
2. **Post collateral** – run _deposit collateral_ on Base (same private key).
3. **Borrow cross-chain** – run _borrow to Optimism_ on Arbitrum.
4. **Check balances** – run _show balances_ on Optimism to confirm the bridged MockUSDC.

Because every script uses the deployer key with unrestricted mint rights on the mock tokens, you can repeat the scenario multiple times without extra setup. Adjust the constants inside each script if you want different token amounts or destination chains. Use small values while demonstrating to keep fees negligible.

## 5. Repay part (or all) of the loan

```bash
npx hardhat run scripts/examples/repay-loan-arbitrum.ts --network arbitrumSepolia
```

Flow:
- Mints MockUSDC if the wallet is short.
- Approves `ProtocolCore`.
- Calls `repay` with 25 mUSDC.

## 6. Withdraw lender shares locally (Arbitrum)

```bash
npx hardhat run scripts/examples/withdraw-lender-arbitrum.ts --network arbitrumSepolia
```

Flow:
- Checks current shares.
- Burns 5 shares (or all if less) and receives MockUSDC locally.

## 7. Withdraw lender shares cross-chain (Optimism)

```bash
npx hardhat run scripts/examples/withdraw-crosschain-optimism.ts --network arbitrumSepolia
```

Flow:
- Burns 5 shares.
- Quotes the cross-chain fee and bridges the equivalent MockUSDC to Optimism Sepolia.

### Extended Narrative (full loop)

1. Lender deposit on Base.
2. Borrower posts collateral on Base.
3. Borrow cross-chain to Optimism.
4. Repay on Arbitrum.
5. Withdraw shares locally or distribute them to Optimism.
6. Check balances on all chains to prove state changes.

These scripts are intentionally verbose (logging `if/else` decisions) so you can narrate each branching path during demos.


