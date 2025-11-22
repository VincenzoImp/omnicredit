# Pyth Network: Complete Technical Guide for Development

## Introduction to Pyth Network

**Pyth Network represents the next generation oracle** for on-chain financial data, with over 2000 price feeds updated every 400 milliseconds by 120+ first-party institutional providers. With $1.8 trillion in cumulative secured volume and 600+ integrated applications across 100+ blockchains, Pyth stands out for its innovative pull architecture that solves the limitations of traditional oracles. Average prices are **5-10x more accurate** than competitors, with sub-second latency making it ideal for DeFi, high-frequency trading, gaming, and prediction markets.

---

## 1. Architecture and Pull Oracle Mechanism

### How Pyth Network Works

Pyth Network uses a five-layer distributed architecture that guarantees verifiable, low-latency price data.

**Publishers (Data Providers):** 120+ global financial institutions (Binance, OKX, Jane Street, Coinbase, CBOE) publish proprietary prices directly to Pythnet. Each publisher provides their own price and confidence interval for each asset.

**Pythnet (Dedicated Appchain):** Application-specific blockchain based on Solana Virtual Machine with modified Proof of Authority consensus. Updates occur every 400ms (2.5 Hz) with FREE transactions for publishers. The Oracle Program aggregates prices using a modified weighted median algorithm that minimizes weighted deviation considering stake and confidence intervals.

**Wormhole Network:** Decentralized cross-chain messaging protocol. Pythnet validators build a Merkle tree with aggregated prices and transmit the root to Wormhole. Guardians create signed VAAs (Verified Action Approvals) containing cryptographically verifiable attestations on any supported blockchain.

**Hermes:** Open-source web service that continuously monitors Pythnet and Wormhole, caching updates in memory and exposing REST/WebSocket APIs. Public endpoint: https://hermes.pyth.network. Provides signed VAAs for on-chain verification with minimal latency.

**Pyth Receiver Contracts:** Contracts deployed on each target blockchain (100+) that verify VAA authenticity via Wormhole signatures and Merkle proofs, updating on-chain storage only if valid.

### Pull vs Push: The Pyth Revolution

**Push Oracle (Traditional Method):** The provider continuously updates prices on-chain at regular intervals (typically 10-60 minutes), paying gas fees for every update on every blockchain. This model scales poorly: prohibitive costs for thousands of feeds on dozens of chains, infrequent updates, and gas waste for unused updates.

**Pull Oracle (Pyth Innovation):** Prices are published FREE on Pythnet and streamed off-chain at high frequency. Users "pull" prices on-chain ONLY when needed, in a single transaction that updates and consumes the price. The end user pays only for what they use.

**Quantified Pull Advantages:**

- **Update frequency:** 400ms vs 10-60 minutes (150-900x more frequent)
- **Scalability:** 2000+ feeds vs 10s-100s typical for push oracles
- **Blockchain support:** 100+ chains without additional costs
- **Tracking error:** ETH/USD 0.4 bps (Pyth) vs 4.3 bps (Chainlink) at 50th percentile
- **During congestion:** Pyth always works; push oracles can fail

The pull model also enables advanced stateful computations like accurate EMAs, TWAPs, and volatility calculations thanks to high-frequency sampling.

### Pyth Entropy for Random Numbers

Pyth Entropy offers secure random number generation on-chain via optimized commit-reveal. The provider pre-commits a sequence of random numbers using hash chains, the user contributes their own random number, and blockhash is also incorporated. The final number is: `Hash(x_provider || x_user || blockhash)`, guaranteeing unpredictability as long as at least one party is honest. Compared to VRFs it's faster and less expensive, ideal for gaming, NFT mints, lotteries, and prediction markets.

---

## 2. Pull Price Feeds: Detailed Technical Guide

### The Complete Process: Fetch → Update → Consume

**Step 1: Fetch from Hermes (off-chain)**

Hermes provides the latest price updates via REST API or real-time streaming.

```javascript
import { HermesClient } from "@pythnetwork/hermes-client";

const connection = new HermesClient("https://hermes.pyth.network", {});

const priceIds = [
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // BTC/USD
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"  // ETH/USD
];

// Single fetch
const priceUpdates = await connection.getLatestPriceUpdates(priceIds);

// Real-time streaming (SSE)
const eventSource = connection.getPriceUpdatesStream(priceIds);
eventSource.onmessage = (event) => {
  const priceUpdate = JSON.parse(event.data);
  console.log("New price:", priceUpdate);
};
```

**Step 2: Update on-chain (Solidity)**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract MyDeFiApp {
    IPyth public pyth;
    
    // Price Feed IDs
    bytes32 constant BTC_USD = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    bytes32 constant ETH_USD = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    
    constructor(address pythContract) {
        pyth = IPyth(pythContract);
    }
    
    function executeTradeWithPriceUpdate(
        bytes[] calldata priceUpdateData,
        uint256 amount
    ) external payable {
        // 1. Calculate update fee
        uint updateFee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= updateFee, "Insufficient fee");
        
        // 2. Update prices on-chain
        pyth.updatePriceFeeds{value: updateFee}(priceUpdateData);
        
        // 3. Read fresh price (max 60 seconds old)
        PythStructs.Price memory btcPrice = pyth.getPriceNoOlderThan(BTC_USD, 60);
        
        // 4. Validate confidence interval
        uint256 confidenceRatio = uint256(btcPrice.conf) * 100 / uint256(uint64(btcPrice.price));
        require(confidenceRatio < 1, "Confidence too low");
        
        // 5. Execute trading logic
        _executeTrade(btcPrice, amount);
        
        // 6. Refund excess ETH
        if (msg.value > updateFee) {
            payable(msg.sender).transfer(msg.value - updateFee);
        }
    }
    
    function _executeTrade(PythStructs.Price memory price, uint256 amount) internal {
        // Calculate effective price: price * 10^expo
        // If price=123456789, expo=-8 → 1234.56789 USD
        
        uint256 priceUint;
        if (price.expo >= 0) {
            priceUint = uint256(uint64(price.price)) * (10 ** uint256(int256(price.expo)));
        } else {
            priceUint = uint256(uint64(price.price)) / (10 ** uint256(-int256(price.expo)));
        }
        
        // Trading logic here...
    }
}
```

**Step 3: Complete client-side integration**

```typescript
import { EvmPriceServiceConnection } from "@pythnetwork/pyth-evm-js";
import { ethers } from "ethers";

async function updateAndReadPrice() {
  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider("https://arb1.arbitrum.io/rpc");
  const wallet = new ethers.Wallet("YOUR_PRIVATE_KEY", provider);
  
  // Contract addresses
  const PYTH_ADDRESS = "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C"; // Arbitrum
  const MY_CONTRACT_ADDRESS = "YOUR_CONTRACT_ADDRESS";
  
  // Initialize Hermes
  const connection = new EvmPriceServiceConnection("https://hermes.pyth.network");
  
  const priceIds = ["0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"];
  
  // 1. Fetch price updates from Hermes
  const priceUpdateData = await connection.getPriceFeedsUpdateData(priceIds);
  
  // 2. Convert from base64 to hex for EVM
  const updateDataBytes = priceUpdateData.binary.data.map((data: string) => 
    ethers.hexlify(Buffer.from(data, 'base64'))
  );
  
  // 3. Calculate required fee
  const pythContract = new ethers.Contract(PYTH_ADDRESS, PYTH_ABI, wallet);
  const updateFee = await pythContract.getUpdateFee(updateDataBytes);
  console.log(`Fee: ${ethers.formatEther(updateFee)} ETH`);
  
  // 4. Execute transaction
  const myContract = new ethers.Contract(MY_CONTRACT_ADDRESS, MY_ABI, wallet);
  const tx = await myContract.executeTradeWithPriceUpdate(updateDataBytes, {
    value: updateFee,
    gasLimit: 500000
  });
  
  await tx.wait();
  console.log("Transaction completed!");
}
```

### Hermes Endpoints and API

**Main endpoints:**

```bash
# Latest price updates (V2 format)
GET https://hermes.pyth.network/v2/updates/price/latest?ids[]={PRICE_ID}

# Search price feeds
GET https://hermes.pyth.network/api/get_price_feeds?query=btc&asset_type=crypto

# WebSocket streaming
WS https://hermes.pyth.network/v2/updates/price/stream?ids[]={PRICE_ID}

# Interactive documentation
https://hermes.pyth.network/docs/
```

**Rate limits:** 30 requests/10 seconds per IP (standard endpoints). For production, obtain private endpoint from Hermes providers (Triton, P2P, Blockdaemon).

---

## 3. EVM Integration: Complete Practical Guide

### Setup and Installation

```bash
# Install dependencies
npm install @pythnetwork/pyth-sdk-solidity @pythnetwork/hermes-client ethers

# For Foundry, add to remappings.txt:
@pythnetwork/pyth-sdk-solidity/=node_modules/@pythnetwork/pyth-sdk-solidity
```

### Advanced Contract with Complete Management

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract LendingProtocol {
    IPyth public immutable pyth;
    
    // Price Feed IDs as constants for gas savings
    bytes32 constant ETH_USD = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 constant BTC_USD = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    
    uint constant COLLATERAL_RATIO = 150; // 150%
    uint constant MAX_PRICE_AGE = 60; // 60 seconds
    
    event CollateralValued(address indexed user, uint256 value);
    
    constructor(address pythContract) {
        pyth = IPyth(pythContract);
    }
    
    function calculateCollateralValue(
        bytes[] calldata priceUpdateData,
        uint ethAmount,
        uint btcAmount
    ) public payable returns (uint256 totalValue) {
        // Update prices
        uint fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "Insufficient fee");
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        
        // Get prices with staleness check
        PythStructs.Price memory ethPrice = pyth.getPriceNoOlderThan(ETH_USD, MAX_PRICE_AGE);
        PythStructs.Price memory btcPrice = pyth.getPriceNoOlderThan(BTC_USD, MAX_PRICE_AGE);
        
        // Calculate conservative value (use price - 3*conf for safety)
        uint256 ethValue = calculateConservativeValue(ethAmount, ethPrice, true);
        uint256 btcValue = calculateConservativeValue(btcAmount, btcPrice, true);
        
        totalValue = ethValue + btcValue;
        emit CollateralValued(msg.sender, totalValue);
    }
    
    function calculateConservativeValue(
        uint amount,
        PythStructs.Price memory price,
        bool isCollateral
    ) internal pure returns (uint256) {
        // For collateral use lower price (conservative)
        int64 conservativePrice = isCollateral 
            ? price.price - (int64(price.conf) * 3)
            : price.price + (int64(price.conf) * 3);
        
        require(conservativePrice > 0, "Invalid price");
        
        // Convert considering exponent
        uint256 priceValue = uint256(uint64(conservativePrice));
        int32 expo = price.expo;
        
        if (expo >= 0) {
            return amount * priceValue * (10 ** uint256(int256(expo)));
        } else {
            return (amount * priceValue) / (10 ** uint256(-int256(expo)));
        }
    }
    
    function isPositionHealthy(
        bytes[] calldata priceUpdateData,
        uint collateralEth,
        uint collateralBtc,
        uint debtUsd
    ) public payable returns (bool) {
        uint collateralValue = calculateCollateralValue(
            priceUpdateData,
            collateralEth,
            collateralBtc
        );
        
        // Verify collateral is >= 150% of debt
        return collateralValue * 100 >= debtUsd * COLLATERAL_RATIO;
    }
}
```

### Utility Class for Price Management

```typescript
class PythPriceManager {
  private hermesClient: HermesClient;
  
  constructor(hermesEndpoint: string = "https://hermes.pyth.network") {
    this.hermesClient = new HermesClient(hermesEndpoint, {});
  }
  
  async getFormattedPrice(priceId: string): Promise<{
    price: string;
    confidence: string;
    exponent: number;
    publishTime: number;
    formattedPrice: number;
  }> {
    const priceUpdates = await this.hermesClient.getLatestPriceUpdates([priceId]);
    const parsed = priceUpdates.parsed[0];
    const price = parsed.price;
    
    return {
      price: price.price,
      confidence: price.conf,
      exponent: price.expo,
      publishTime: price.publish_time,
      formattedPrice: Number(price.price) * Math.pow(10, price.expo)
    };
  }
  
  async getPriceUpdateData(priceIds: string[]): Promise<string[]> {
    const priceUpdates = await this.hermesClient.getLatestPriceUpdates(priceIds);
    return priceUpdates.binary.data.map((data: string) => 
      '0x' + Buffer.from(data, 'base64').toString('hex')
    );
  }
  
  isPriceRecent(publishTime: number, maxAgeSeconds: number = 60): boolean {
    const now = Math.floor(Date.now() / 1000);
    return (now - publishTime) <= maxAgeSeconds;
  }
}

// Usage
const priceManager = new PythPriceManager();
const btcPrice = await priceManager.getFormattedPrice(
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
);
console.log(`BTC/USD: $${btcPrice.formattedPrice.toFixed(2)}`);
```

---

## 4. Contract API: Complete Reference

### Price Data Structure

```solidity
struct Price {
    int64 price;        // Price in fixed-point notation
    uint64 conf;        // Confidence interval (±3σ ≈ 99.7%)
    int32 expo;         // Exponent: real_price = price * 10^expo
    uint publishTime;   // Unix timestamp of publication
}
```

**Interpretation example:**
- `price: 123456789, conf: 180726074, expo: -8, publishTime: 1721765108`
- Effective price: `123456789 × 10^-8 = 1.23456789 USD`
- Confidence: `180726074 × 10^-8 = ±1.81 USD`
- Range: `1.23 ± 1.81 USD` (at 99.7% confidence)

### Main Methods

**getPriceNoOlderThan (RECOMMENDED):**

```solidity
function getPriceNoOlderThan(bytes32 id, uint age) 
    external view returns (PythStructs.Price memory);
```

Returns the price only if not older than `age` seconds. Reverts with `StalePrice` if too old or `PriceFeedNotFound` if the feed doesn't exist.

**Usage example:**

```solidity
// Require price no older than 60 seconds
PythStructs.Price memory price = pyth.getPriceNoOlderThan(priceId, 60);
```

**getPriceUnsafe (use with caution):**

```solidity
function getPriceUnsafe(bytes32 id) 
    external view returns (PythStructs.Price memory);
```

Returns the price without recency checks. MUST be validated manually by checking `publishTime`. Useful only for implementing custom validation logic.

**Method comparison:**

| Method | Validation | Recommended Use | Risk |
|--------|------------|-----------------|------|
| `getPriceNoOlderThan` | ✅ Automatic | Standard applications | Low |
| `getPrice` | ✅ Fixed (deprecated) | None | Medium |
| `getPriceUnsafe` | ❌ None | Only with manual validation | High |

**updatePriceFeeds:**

```solidity
function updatePriceFeeds(bytes[] calldata updateData) 
    external payable;
```

Updates on-chain price feeds with VAA data from Hermes. Requires payment of fee calculable with `getUpdateFee()`.

**parsePriceFeedUpdates:**

```solidity
function parsePriceFeedUpdates(
    bytes[] calldata updateData,
    bytes32[] calldata priceIds,
    uint64 minPublishTime,
    uint64 maxPublishTime
) external payable returns (PythStructs.PriceFeed[] memory);
```

Parses and validates updates without necessarily saving them on-chain. Useful for validating historical data or verifying quality before commit.

### Complete Error Handling

```solidity
function safeGetPrice(bytes32 priceId, uint maxAge) 
    public view returns (bool success, PythStructs.Price memory price) {
    
    try pyth.getPriceNoOlderThan(priceId, maxAge) returns (PythStructs.Price memory p) {
        // Additional validations
        require(p.price > 0, "Price <= 0");
        require(p.publishTime <= block.timestamp, "Future price");
        
        // Validate confidence interval
        uint256 confRatio = (uint256(p.conf) * 10000) / uint256(uint64(p.price));
        require(confRatio < 100, "Confidence too low"); // <1%
        
        return (true, p);
        
    } catch Error(string memory reason) {
        if (keccak256(bytes(reason)) == keccak256("StalePrice")) {
            // Implement fallback or use secondary oracle
        }
        return (false, PythStructs.Price(0, 0, 0, 0));
    }
}
```

---

## 5. Price Feeds and Supported Blockchains

### Available Asset Categories

Pyth Network offers **2000+ price feeds** divided into:

**CRYPTO (500+):** BTC/USD, ETH/USD, SOL/USD, USDT/USD, USDC/USD, BNB/USD, XRP/USD, ADA/USD, DOGE/USD, MATIC/USD, DOT/USD, AVAX/USD, LINK/USD, UNI/USD, ARB/USD

**EQUITIES (570+):** AAPL/USD, MSFT/USD, GOOGL/USD, TSLA/USD, AMZN/USD, NVDA/USD, META/USD, NFLX/USD

**FX (Foreign Exchange):** EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CHF, USD/CAD

**COMMODITIES & METALS:** XAU/USD (gold), XAG/USD (silver), WTI/USD (oil), BRENT/USD

**Other categories:** ETF, Crypto NAV, Redemption Rates, Crypto Index, Rates (interest rates), ECO (macroeconomic indicators)

### Price Feed ID Format

**Type:** `bytes32` (66-character hexadecimal string)
**Format:** `0x` + 64 hex characters

**Examples:**
```
BTC/USD: 0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b
ETH/USD: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
SOL/USD: 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
```

**How to find IDs:** https://pyth.network/developers/price-feed-ids or via Hermes API:

```bash
curl "https://hermes.pyth.network/api/get_price_feeds?query=btc&asset_type=crypto"
```

### Supported EVM Blockchains (100+)

**Main Mainnet:**
- Ethereum Mainnet
- Arbitrum One: `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C`
- Optimism
- Base
- Polygon (Matic)
- BNB Smart Chain (BSC)
- Avalanche C-Chain
- zkSync Era
- Polygon zkEVM
- Scroll
- Fantom
- Cronos
- Berachain
- Sonic
- Unichain
- HyperEVM

**Main Testnets:**
- Ethereum Sepolia
- Arbitrum Sepolia
- Base Sepolia: `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729`
- Optimism Sepolia
- Polygon Amoy
- Avalanche Fuji

**Complete list:** https://docs.pyth.network/price-feeds/core/contract-addresses/evm

### Mainnet vs Testnet

**Mainnet:**
- Real-time data from 120+ institutional providers
- Updates every 400ms
- Variable update fees (often ~1 wei)
- Maximum security and aggregation

**Testnet:**
- Simulated or delayed data
- Free or symbolic fees
- For development and testing

**Sponsored Feeds:** On some chains (Arbitrum, Avalanche, Base, Ethereum, Optimism), Pyth provides automatic sponsored updates with 1-hour heartbeat and 1% price deviation.

---

## 6. Error Handling and Gas Optimization

### EVM Error Codes

**StalePrice:** Price hasn't been updated recently enough. Solution: call `updatePriceFeeds()` with recent data.

**PriceFeedNotFound:** Feed doesn't exist or has never received updates. Solution: verify ID and initialize with `updatePriceFeeds()`.

**InsufficientFee:** Paid fee is insufficient. Solution: calculate with `getUpdateFee()` and send correct amount.

**InvalidArgument:** Invalid arguments (e.g., mismatched array lengths).

**NoFreshUpdate:** No update needed in `updatePriceFeedsIfNecessary()` (not a critical error).

### Error Handling Patterns

```solidity
function robustPriceUpdate(bytes32 priceId, bytes[] calldata updateData) 
    external payable {
    
    // 1. Calculate fee with buffer
    uint baseFee = pyth.getUpdateFee(updateData);
    uint feeWithBuffer = baseFee * 110 / 100; // +10% buffer
    require(msg.value >= feeWithBuffer, "Insufficient fee with buffer");
    
    // 2. Update with try-catch
    try pyth.updatePriceFeeds{value: baseFee}(updateData) {
        // Success
    } catch Error(string memory reason) {
        // Log error and revert with clear message
        emit UpdateFailed(priceId, reason);
        revert(string(abi.encodePacked("Update failed: ", reason)));
    }
    
    // 3. Validate price with circuit breaker
    PythStructs.Price memory newPrice = pyth.getPriceNoOlderThan(priceId, 60);
    
    // Check for anomalous changes
    if (lastPrice[priceId] != 0) {
        uint256 changePercent = abs(newPrice.price - lastPrice[priceId]) * 100 
                                / uint256(uint64(lastPrice[priceId]));
        require(changePercent <= MAX_CHANGE_PERCENT, "Circuit breaker: excessive change");
    }
    
    lastPrice[priceId] = newPrice.price;
    
    // 4. Refund excess
    if (msg.value > baseFee) {
        payable(msg.sender).transfer(msg.value - baseFee);
    }
}
```

### Gas Optimization: Advanced Techniques

**1. Batch updates to save 30-50% gas:**

```solidity
// Update multiple feeds in one transaction
function updateMultiplePrices(bytes[] calldata updateData) external payable {
    uint fee = pyth.getUpdateFee(updateData);
    pyth.updatePriceFeeds{value: fee}(updateData);
    // Now you can read BTC, ETH, SOL without additional costs
}
```

**2. On-chain caching for frequent reads:**

```solidity
struct CachedPrice {
    int64 price;
    uint64 timestamp;
    uint64 conf;
    int32 expo;
}

mapping(bytes32 => CachedPrice) public priceCache;
uint256 constant CACHE_DURATION = 60 seconds;

function getCachedPrice(bytes32 priceId) public view returns (CachedPrice memory) {
    CachedPrice memory cached = priceCache[priceId];
    require(block.timestamp - cached.timestamp < CACHE_DURATION, "Cache expired");
    return cached;
}
```

**3. Conditional updates:**

```solidity
// Update only if necessary
pyth.updatePriceFeedsIfNecessary{value: fee}(
    priceUpdateData,
    priceIds,
    publishTimes
);
```

**4. Sponsored feeds:** On Arbitrum, Base, Ethereum and other chains, use sponsored feeds for zero update costs under normal conditions.

### Update Frequency and Strategy

**By use case:**

- **DEX/Trading:** On-demand updates per trade, staleness threshold 10-30s
- **Lending/Borrowing:** Updates on user operations, threshold 60-120s
- **Liquidations:** Update before health factor calculation, threshold 30-60s, keeper bot
- **Oracle Collateral:** Periodic updates every 5-15 min, threshold 300-900s

**Keeper bot implementation:**

```javascript
// Pseudo-code for automated keeper
const PRICE_DEVIATION_THRESHOLD = 1; // 1%
const HEARTBEAT = 3600; // 1 hour

async function keeperLoop() {
  while (true) {
    const offChainPrice = await getFromHermes(priceId);
    const onChainPrice = await getFromContract(priceId);
    
    const deviation = Math.abs(offChainPrice - onChainPrice) / onChainPrice * 100;
    const timeSinceUpdate = Date.now() - lastUpdate;
    
    if (deviation > PRICE_DEVIATION_THRESHOLD || timeSinceUpdate > HEARTBEAT) {
      await updatePriceOnChain();
    }
    
    await sleep(10000); // Check every 10 seconds
  }
}
```

**Available automation services:** Gelato Web3 Functions, Adrastia Oracle Automation, Chainlink Automation

### Security Best Practices

**1. Multi-layer validation:**

```solidity
function secureGetPrice(bytes32 priceId, uint maxAge) 
    public view returns (PythStructs.Price memory) {
    
    PythStructs.Price memory price = pyth.getPriceNoOlderThan(priceId, maxAge);
    
    // Critical validations
    require(price.price > 0, "Invalid price");
    require(price.publishTime <= block.timestamp, "Future timestamp");
    require(price.publishTime > block.timestamp - maxAge, "Price too old");
    
    // Validate confidence interval (max 1% of price)
    uint256 confRatio = uint256(price.conf) * 100 / uint256(uint64(price.price));
    require(confRatio < 1, "Confidence interval too wide");
    
    return price;
}
```

**2. Conservative use of confidence interval:**

```solidity
// For collateral: subtract 3*conf (99.7% confidence)
// For debt: add 3*conf
function getConservativePrice(bytes32 priceId, bool isCollateral) 
    public view returns (int64) {
    
    PythStructs.Price memory price = pyth.getPriceNoOlderThan(priceId, 60);
    int64 confInterval = int64(price.conf) * 3;
    
    return isCollateral 
        ? price.price - confInterval 
        : price.price + confInterval;
}
```

**3. Access control for updates:**

```solidity
mapping(address => bool) public authorizedUpdaters;

modifier onlyAuthorized() {
    require(authorizedUpdaters[msg.sender] || msg.sender == owner(), "Not authorized");
    _;
}

function updatePricesSecure(bytes[] calldata updateData) 
    external payable onlyAuthorized {
    // Only authorized updaters can call
}
```

---

## 7. Price Pusher: Update Automation

### What It Is and When to Use It

The **Price Pusher** is an automated service that monitors and regularly updates on-chain prices based on configurable conditions (time threshold, price deviation, confidence ratio). It's ideal for applications that prefer a purely on-chain integration without managing pull in every user transaction.

**Use Price Pusher when:**
- Application reads prices frequently without per-transaction updates
- You prefer architecture more similar to traditional push oracles
- You're migrating from Chainlink and want to minimize code changes
- Applications with low transaction frequency but need always-available prices

**Use Direct Pull when:**
- You need minimal latency (<400ms)
- High-frequency applications (DEX perpetuals, derivatives)
- You want to optimize costs by paying only when using prices
- You have control over update timing

### Price Pusher Configuration

**Installation:**

```bash
pnpm install
pnpm turbo build --filter @pythnetwork/price-pusher
cd apps/price_pusher

# Start for EVM
pnpm run start evm \
  --endpoint wss://arb1.arbitrum.io/rpc \
  --pyth-contract-address 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C \
  --price-service-endpoint https://hermes.pyth.network \
  --mnemonic-file ./mnemonic.txt \
  --price-config-file ./price-config.yaml
```

**YAML configuration file:**

```yaml
- alias: BTC/USD
  id: 0xf9c0172ba10dfa4d19088d94f5bf61d3b54d5bd7483a322a982e1373ee8ea31b
  time_difference: 60        # Update if > 60 seconds old
  price_deviation: 0.5       # Update if deviation > 0.5%
  confidence_ratio: 1.0      # Update if conf/price > 1%
  
  # Early update (more aggressive conditions)
  early_update:
    time_difference: 30
    price_deviation: 0.1
    confidence_ratio: 5

- alias: ETH/USD
  id: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
  time_difference: 60
  price_deviation: 0.5
  confidence_ratio: 1.0
```

**Monitoring with Prometheus/Grafana:**

```yaml
# docker-compose.metrics.yaml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
  
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    volumes:
      - ./grafana-dashboard.json:/etc/grafana/provisioning/dashboards/pyth.json
```

Available metrics: `pyth_price_last_published_time`, `pyth_price_update_attempts_total`, `pyth_wallet_balance`

---

## 8. Use Cases and Practical Applications

### DeFi Protocols

**Decentralized Exchanges (DEX):**
- **Drift Protocol:** $156M perpetuals volume 24h, uses Pyth for sub-second prices
- **Jupiter:** Leading Solana DEX aggregator with integrated perpetuals
- **Synthetix:** Transformed into competitive platform with Pyth pull oracles
- Advantage: Reduced slippage, efficient price discovery, real-time risk management

**Lending Protocols:**
- **Kamino:** Leading Solana lending, handles congestion thanks to pull model
- **Morpho Markets:** Modular vaults with accurate prices
- **Solend:** Automated liquidations with real-time prices
- Advantage: Precise LTV, timely liquidations, lender protection

**Derivatives & Perpetual Futures:**
- **SynFutures:** Leading perpetual DEX by Pyth-powered volume
- **Mango Markets:** Cross-margining and leveraged trading
- **Ribbon Finance:** Options vaults with precise expiry prices
- Impact: $100B+ derivatives transaction volume in July 2024, surpassing Coinbase

### On-chain Gaming

**Pyth Entropy for RNG:**
- Fair and verifiable on-chain lotteries
- NFT mints with random traits
- Prize pools with unlock on events
- Tournament gaming with reward distribution

**Gaming integration example:**

```solidity
contract OnChainGame is IEntropyConsumer {
    IEntropy private entropy = IEntropy(ENTROPY_ADDRESS);
    address private provider = PROVIDER_ADDRESS;
    
    function startGame(bytes32 userRandomNumber) external payable {
        uint256 fee = entropy.getFee(provider);
        uint64 sequenceNumber = entropy.requestWithCallback{value: fee}(
            provider,
            userRandomNumber
        );
        // Store sequenceNumber for tracking
    }
    
    function entropyCallback(
        uint64 sequenceNumber,
        address provider,
        bytes32 randomNumber
    ) internal override {
        // Use randomNumber to determine outcome
        uint256 result = uint256(randomNumber) % 100;
        if (result < 10) {
            // Rare win (10%)
        }
    }
}
```

### Prediction Markets

**Complete tutorial available** for building prediction market dApp:

```solidity
contract PredictionMarket {
    IPyth public pyth;
    bytes32 public priceId;
    uint256 public settlementTime;
    int64 public settlementPrice;
    
    function resolveMarket(bytes[] calldata updateData) external payable {
        require(block.timestamp >= settlementTime, "Too early");
        
        // Update and get exact price at settlement time
        uint fee = pyth.getUpdateFee(updateData);
        pyth.updatePriceFeeds{value: fee}(updateData);
        
        PythStructs.Price memory price = pyth.getPriceNoOlderThan(priceId, 300);
        settlementPrice = price.price;
        
        // Distribute rewards to winners
        distributeRewards();
    }
}
```

### Other Innovative Use Cases

**Stablecoins:** Peg maintenance, collateral pricing, reserve management

**Cross-Chain Bridges:** Consistent pricing across 100+ blockchains

**Structured Products:** Options vaults, yield optimization, auto-rebalancing

**Analytics & BI:** Real-time dashboards, price movement alerts, backtesting

---

## 9. Developer Resources

### Official Documentation

**Pyth Network Docs:** https://docs.pyth.network/price-feeds
- How Pyth Works: https://docs.pyth.network/price-feeds/core/how-pyth-works
- EVM Integration: https://docs.pyth.network/price-feeds/core/use-real-time-data/pull-integration/evm
- Contract Addresses: https://docs.pyth.network/price-feeds/core/contract-addresses/evm
- Error Codes: https://docs.pyth.network/price-feeds/core/error-codes/evm
- Best Practices: https://docs.pyth.network/price-feeds/best-practices

**API Reference:** https://api-reference.pyth.network/price-feeds/evm/getPriceNoOlderThan

**Hermes Documentation:** https://hermes.pyth.network/docs/

### Developer Forum and Community

**Pyth Dev Forum:** https://dev-forum.pyth.network/ - Technical support and discussions

**Discord:** Active community for real-time support

**GitHub:** https://github.com/pyth-network/pyth-crosschain
- Price Pusher: https://github.com/pyth-network/pyth-crosschain/tree/main/apps/price_pusher
- Complete examples and configurations

### Tools and Utilities

**Price Feed IDs:** https://pyth.network/developers/price-feed-ids - Complete list of 2000+ feeds

**Pyth Insights Hub:** https://insights.pyth.network/price-feeds - Interactive dashboard

**SDK NPM Packages:**
- `@pythnetwork/pyth-sdk-solidity` - Solidity contracts
- `@pythnetwork/hermes-client` - Hermes client JS/TS
- `@pythnetwork/pyth-evm-js` - Complete EVM SDK
- `@pythnetwork/price-pusher` - Price pusher automation

**Monitoring with Prometheus/Grafana:** Pre-configured dashboard included in repo

**Gelato Web3 Functions:** https://github.com/pyth-network/pyth-gelato-price-pusher - Serverless automation

---

## 10. Hackathon Checklist

### Pre-development
- [ ] Install dependencies: `@pythnetwork/pyth-sdk-solidity`, `@pythnetwork/hermes-client`
- [ ] Identify necessary price feeds at https://pyth.network/developers/price-feed-ids
- [ ] Get contract addresses for target chain from https://docs.pyth.network/price-feeds/core/contract-addresses/evm
- [ ] Configure Hermes endpoint: `https://hermes.pyth.network`

### Smart contract implementation
- [ ] Import `IPyth` and `PythStructs` from Solidity SDK
- [ ] Use `getPriceNoOlderThan()` with appropriate threshold (60s standard)
- [ ] Implement confidence interval validation
- [ ] Handle errors with try-catch
- [ ] Calculate fee with `getUpdateFee()` and handle excess refund
- [ ] Use constants for price feed IDs (gas savings)

### Frontend/backend integration
- [ ] Initialize `HermesClient` with public endpoint
- [ ] Fetch price updates with `getLatestPriceUpdates()`
- [ ] Convert data from base64 to hex for EVM
- [ ] Calculate fee and send transaction with correct value
- [ ] Implement error handling and retry logic

### Testing
- [ ] Test with `MockPyth` for unit tests
- [ ] Verify stale price handling
- [ ] Test with insufficient fees
- [ ] Validate correct interpretation of price/expo/conf
- [ ] Test on testnet before mainnet

### Optimization
- [ ] Implement batch updates for multiple feeds
- [ ] Configure appropriate caching
- [ ] Consider sponsored feeds if available
- [ ] Measure and optimize gas usage

### Security
- [ ] Always validate staleness threshold
- [ ] Implement circuit breaker for anomalous changes
- [ ] Use confidence interval conservatively
- [ ] Access control for update functions
- [ ] Complete logging for monitoring

### Deployment
- [ ] Verify contract addresses for target chain
- [ ] Configure keeper bot if necessary
- [ ] Setup monitoring (Prometheus/Grafana optional)
- [ ] Document configuration for maintenance
- [ ] Test on mainnet with small amounts before scaling

---

## Conclusion

Pyth Network represents the evolution of blockchain oracles, combining **speed (400ms updates)**, **precision (5-10x better tracking error)**, **scalability (2000+ feeds on 100+ chains)** and **reliability (120+ institutional providers)**. The pull architecture eliminates the limitations of traditional push models, enabling high-performance DeFi applications with optimized costs.

For your hackathon, you now have a complete guide covering all integration aspects: from architecture theory, to implementation details with production-ready code, to security best practices and optimization. Pyth's pull model offers the control and flexibility needed to build innovative DeFi protocols, engaging on-chain gaming, or accurate prediction markets.

**Next steps:** Start with the provided code examples, customize for your use case, test on testnet (Base Sepolia, Arbitrum Sepolia), and scale to mainnet. The Pyth community is active on Discord and GitHub for support. Good luck with your hackathon!
