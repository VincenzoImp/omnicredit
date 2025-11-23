# Liquidation Monitor

Off-chain daemon that keeps the OmniCredit protocol in sync with Pyth, recomputes borrower health, and triggers liquidations via `LiquidationManager`.

## Features

- Pulls the latest Pyth price updates from Hermes and submits them on-chain through `PriceOracle.updatePriceFeeds`.
- Scans recent `Borrowed` events to maintain a candidate list of active borrowers.
- Evaluates each borrower’s health factor with fresh pricing data.
- Starts (and optionally executes) liquidations whenever health falls below the configured threshold.

## Configuration

Copy `monitor/config.example.json` to `monitor/config.json` and fill in the fields:

| Key | Description |
| --- | --- |
| `rpcUrl` | JSON-RPC endpoint for the chain hosting ProtocolCore (e.g., Arbitrum Sepolia) |
| `privateKey` | Liquidation bot key with permissions to call oracle/liquidation functions |
| `priceOracleAddress` | Deployed `PriceOracle` instance |
| `protocolCoreAddress` | Deployed `ProtocolCore` instance |
| `liquidationManagerAddress` | Deployed `LiquidationManager` instance |
| `hermesUrl` | Hermes endpoint (defaults to `https://hermes.pyth.network/v2/updates/price/latest`) |
| `priceFeedIds` | Array of Pyth price feed IDs (ETH/USD, etc.) tracked by the protocol |
| `borrowerScanLookbackBlocks` | How many recent blocks to scan for `Borrowed` events |
| `healthFactorThresholdBps` | Health factor (in basis points) that should trigger liquidation (default 10000 = 100%) |
| `pollIntervalMs` | Delay between monitor iterations |
| `autoExecuteLiquidation` | Set `true` to call `executeLiquidation` immediately after starting the auction |

Example file: `monitor/config.example.json`.

## Running

```bash
cp monitor/config.example.json monitor/config.json
# edit monitor/config.json with the real addresses and keys

npm run monitor:liquidations
```

The script logs every step (price updates, borrower evaluations, liquidations) so you can feed it into observability tooling.

## Extending

- Add new price feeds in `priceFeedIds` whenever the protocol starts accepting new collateral.
- Replace the simple borrower discovery (event scanning) with a persistent database if you need to scale.
- Wire alerts into the “unhealthy borrower” branch to notify operators even when you decide not to auto-liquidate.


