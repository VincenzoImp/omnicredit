# OmniCredit Technical Dossier

## Mission & Core Stack

- OmniCredit is a share-based omnichain lending pool deployed on Arbitrum Sepolia that relies on LayerZero V2 OApps/OFT for messaging and liquidity portability, Pyth Network for millisecond-grade oracle feeds, and Hardhat 3.0 + Ignition for reproducible deployments. Its hub contract, `ProtocolCore`, inherits LayerZero’s `OApp` to own all coordination logic and is paired with a credit-score engine, fee-based risk caps, oracle, and liquidation manager in the same network.

```15:34:contracts/base/ProtocolCore.sol
/**
 * @title ProtocolCore
 * @notice Omnichain lending protocol with full cross-chain support
 * ...
 */
contract ProtocolCore is OApp, ReentrancyGuard {
    using OptionsBuilder for bytes;
    using SafeERC20 for IERC20;
    IERC20 public immutable lendingToken;
    ContinuousCreditScore public immutable creditScore;
    FeeBasedLimits public immutable feeBasedLimits;
    PriceOracle public immutable priceOracle;
    OFT public usdcOFT;
    ...
```

## Core Contracts (Arbitrum hub)

- **ProtocolCore**
  - Share-based pool: deposits mint proportional shares, while withdrawals burn shares using total pool value (`totalDeposits + totalBorrowed`) ensuring accurate yield accounting for lenders across chains.

```218:243:contracts/base/ProtocolCore.sol
function deposit(uint256 amount) external nonReentrant returns (uint256 sharesIssued) {
    if (amount == 0) revert InvalidAmount();
    if (totalShares == 0) {
        sharesIssued = amount;
    } else {
        uint256 poolValue = totalDeposits + totalBorrowed;
        sharesIssued = (amount * totalShares) / poolValue;
    }
    shares[msg.sender] += sharesIssued;
    totalShares += sharesIssued;
    totalDeposits += amount;
    lendingToken.safeTransferFrom(msg.sender, address(this), amount);
    emit Deposited(msg.sender, amount, sharesIssued);
}
```

  - Cross-chain UX: lenders/borrowers can withdraw or borrow on any LayerZero endpoint ID by bridging MockUSDC via OFT, while shares and loans remain accounted for on Arbitrum.

```274:328:contracts/base/ProtocolCore.sol
function withdrawCrossChain(uint256 shareAmount, uint32 dstEid, uint256 minAmountLD)
    external payable nonReentrant {
    ...
    SendParam memory sendParam = SendParam({
        dstEid: dstEid,
        to: addressToBytes32(msg.sender),
        amountLD: amountWithdrawn,
        minAmountLD: minAmountLD,
        extraOptions: oftOptions,
        composeMsg: "",
        oftCmd: ""
    });
    lendingToken.safeApprove(address(usdcOFT), amountWithdrawn);
    MessagingFee memory oftFee = usdcOFT.quoteSend(sendParam, false);
    usdcOFT.send{value: oftFee.nativeFee}(sendParam, oftFee, payable(msg.sender));
    emit Withdrawn(msg.sender, amountWithdrawn, shareAmount);
}
```

  - Borrowing integrates a utilization-driven APR model, continuous credit scoring, and fee-based caps. Borrowers can request liquidity locally or on any destination chain; the loan is still recorded on Arbitrum while the OFT handles delivery.

```417:488:contracts/base/ProtocolCore.sol
function borrowCrossChain(uint256 amount, uint32 dstEid, uint256 minAmountLD)
    external payable nonReentrant {
    if (amount < minLoanSize) revert LoanTooSmall();
    ...
    (uint256 maxBorrow,,) = feeBasedLimits.calculateMaxBorrow(msg.sender, totalCollateral);
    if (amount > maxBorrow) revert ExceedsBorrowLimit();
    uint256 interestRate = _calculateInterestRate();
    loans[msg.sender] = Loan({ principal: amount, interestRate, ... });
    totalBorrowed += amount; totalDeposits -= amount;
    creditScore.recordLoanTaken(msg.sender);
    SendParam memory sendParam = SendParam({
        dstEid, to: addressToBytes32(msg.sender), amountLD: amount, ...
    });
    lendingToken.safeApprove(address(usdcOFT), amount);
    MessagingFee memory oftFee = usdcOFT.quoteSend(sendParam, false);
    usdcOFT.send{value: oftFee.nativeFee}(sendParam, oftFee, payable(msg.sender));
    emit CrossChainBorrowInitiated(msg.sender, dstEid, amount);
}
```

  - LayerZero message router: `_lzReceive` discriminates lender deposits vs collateral updates; unauthorized peers are rejected, ensuring only whitelisted vaults can mutate state.

```557:658:contracts/base/ProtocolCore.sol
function _lzReceive(Origin calldata _origin, bytes32, bytes calldata _message, address, bytes calldata)
    internal override {
    uint8 messageType = abi.decode(_message, (uint8));
    if (messageType == 1) {
        _handleLenderDeposit(_origin, _message);
    } else if (messageType == 3) {
        _handleCollateralUpdate(_origin, _message);
    } else {
        revert("Invalid message type");
    }
}
...
if (authorizedCollateralVaults[_origin.srcEid] != _origin.sender) revert UnauthorizedCollateralVault();
(borrowerCollateral[user][asset] += amount) ... emit CollateralReceivedCrossChain(user, asset, amount, _origin.srcEid);
```

- **ContinuousCreditScore**
  - Maintains a streak-aware 0–1000 score derived from interest paid, on-time history, and liquidation penalties; exposes derived LTV ceilings and liquidation buffers.

```7:205:contracts/base/ContinuousCreditScore.sol
// Base Score = Total Interest Paid / $10
// Streak Multiplier = 100% + (consecutive on-time loans × 5%) capped at 150%
// Liquidation Penalty = -200 points per liquidation
function calculateCreditScore(address user) public view returns (uint256 score) {
    UserCredit storage credit = userCredits[user];
    uint256 baseScore = credit.totalInterestPaidUSD / INTEREST_PER_POINT;
    uint256 streakMultiplierBPS = BASE_MULTIPLIER_BPS + (credit.consecutiveOnTimeCount * STREAK_BONUS_BPS);
    if (streakMultiplierBPS > MAX_STREAK_MULTIPLIER_BPS) streakMultiplierBPS = MAX_STREAK_MULTIPLIER_BPS;
    uint256 multipliedScore = (baseScore * streakMultiplierBPS) / BASE_MULTIPLIER_BPS;
    ...
    if (score > MAX_SCORE) score = MAX_SCORE;
}
```

- **FeeBasedLimits**
  - Guards against “score-and-run” by capping borrow size to the min of collateral × LTV and collateral + 50% of lifetime interest; also exposes analytics for clients to display limiting factors.

```13:143:contracts/base/FeeBasedLimits.sol
function calculateMaxBorrow(address user, uint256 collateralValueUSD)
    public view returns (uint256 maxBorrowUSD, uint256 ltvLimit, uint256 bufferedLimit) {
    ltvLimit = calculateLTVLimit(user, collateralValueUSD);
    bufferedLimit = calculateBufferedLimit(user, collateralValueUSD);
    maxBorrowUSD = ltvLimit < bufferedLimit ? ltvLimit : bufferedLimit;
}
function calculateBufferedLimit(address user, uint256 collateralValueUSD)
    public view returns (uint256) {
    (ContinuousCreditScore.UserCredit memory credit,,) = creditScore.getUserCreditProfile(user);
    uint256 interestBuffer = (credit.totalInterestPaidUSD * INTEREST_BUFFER_FACTOR) / BPS_DENOMINATOR;
    return collateralValueUSD + interestBuffer;
}
```

- **PriceOracle**
  - Wraps Pyth Network’s push/pull model: update feeds via Hermes payloads, reject stale/confidence-breached prices, and normalize to 18 decimals for unified accounting.

```4:177:contracts/base/PriceOracle.sol
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
...
function getPrice(address asset) public view returns (uint256 price) {
    bytes32 priceFeedId = assetToPriceFeed[asset];
    if (priceFeedId == bytes32(0)) revert PriceFeedNotFound(asset);
    PythStructs.Price memory pythPrice = pyth.getPriceNoOlderThan(priceFeedId, maxPriceAge);
    if (pythPrice.price < 0) revert NegativePrice(asset);
    uint256 confidenceRatioBPS = (uint64(pythPrice.conf) * BPS_DENOMINATOR) / uint64(pythPrice.price);
    if (confidenceRatioBPS > maxConfidenceRatioBPS) revert PriceConfidenceTooWide(asset, confidenceRatioBPS);
    price = _normalizePrice(uint64(pythPrice.price), pythPrice.expo);
}
function updatePriceFeeds(bytes[] calldata updateData) external payable {
    uint256 fee = pyth.getUpdateFee(updateData);
    pyth.updatePriceFeeds{value: fee}(updateData);
}
```

- **LiquidationManager**
  - Runs Dutch auctions that convert collateral via Uniswap v4’s `PoolManager`. After a swap, it repays the borrower on `ProtocolCore`, routes surplus to reserves, and penalizes the credit profile.

```17:257:contracts/base/LiquidationManager.sol
function executeLiquidation(bytes32 auctionId) external nonReentrant {
    Auction storage auction = auctions[auctionId];
    if (!auction.isActive) revert AuctionNotActive();
    if (address(poolManager) == address(0)) revert NoPoolManager();
    auction.isActive = false;
    SwapParams memory swapParams = SwapParams({ zeroForOne: true, amountSpecified: -int256(auction.collateralAmount), sqrtPriceLimitX96: 0 });
    BalanceDelta delta = poolManager.swap(liquidationPool, swapParams, "");
    int128 amount1 = delta.amount1();
    uint256 usdcReceived = amount1 < 0 ? uint256(uint128(-amount1)) : 0;
    require(usdcReceived >= auction.debtAmount, "Insufficient USDC");
    usdc.safeApprove(address(lendingPool), auction.debtAmount);
    lendingPool.repayFromLiquidation(auction.borrower, auction.debtAmount);
    uint256 surplus = usdcReceived - auction.debtAmount;
    if (surplus > 0) {
        usdc.safeApprove(address(lendingPool), surplus);
        lendingPool.addToReserves(surplus);
    }
    creditScore.recordLiquidation(auction.borrower);
    emit LiquidationExecuted(auctionId, msg.sender, auction.collateralAmount, auction.debtAmount, surplus);
}
```

## Satellite Contracts (per chain instances)

- **CollateralVault**
  - Locks native/ERC-20 collateral on satellite chains, values deposits through the hub oracle, and emits LayerZero messages (type 3) towards `ProtocolCore`. Withdrawals require an allowance set via inbound approvals.

```18:214:contracts/cross-chain/CollateralVault.sol
function depositNative() external payable nonReentrant {
    if (msg.value == 0) revert InvalidAmount();
    uint8 decimals = assetDecimals[NATIVE_TOKEN];
    if (decimals == 0) revert DecimalsNotSet(NATIVE_TOKEN);
    uint256 valueUSD18 = priceOracle.getAssetValueUSD(NATIVE_TOKEN, msg.value, decimals);
    uint256 valueUSD6 = valueUSD18 / 1e12;
    userCollateral[msg.sender][NATIVE_TOKEN] += msg.value;
    totalCollateralLocked[NATIVE_TOKEN] += msg.value;
    emit CollateralDeposited(msg.sender, NATIVE_TOKEN, msg.value, valueUSD6);
    _sendCollateralUpdate(msg.sender, NATIVE_TOKEN, msg.value, valueUSD6, true);
}
function _sendCollateralUpdate(...) internal {
    if (protocolCorePeer == bytes32(0) || protocolCoreEid == 0) revert InvalidProtocolCore();
    bytes memory payload = abi.encode(uint8(3), user, asset, amount, valueUSD, isDeposit);
    bytes memory options = OptionsBuilder.newOptions();
    options.addExecutorLzReceiveOption(200000, 0);
    MessagingFee memory fee = _quote(protocolCoreEid, payload, options, false);
    _lzSend(protocolCoreEid, payload, options, fee, payable(address(this)));
}
```

- **LenderVault**
  - Accepts local MockUSDC, bridges it via OFT to Arbitrum, and forwards a type-1 OApp message to mint shares. Pending deposits are tracked via GUIDs with timeout-based refunds.

```118:220:contracts/cross-chain/LenderVault.sol
function deposit(uint256 amount, uint256 minAmountLD)
    external payable nonReentrant returns (bytes32 guid) {
    if (amount == 0) revert InvalidAmount();
    if (protocolCorePeer == bytes32(0)) revert ProtocolCoreNotSet();
    if (address(usdcOFT) == address(0)) revert USDCOTFNotSet();
    if (block.timestamp < lastDepositTime[msg.sender] + MIN_DEPOSIT_INTERVAL) revert RateLimited();
    localUSDC.safeTransferFrom(msg.sender, address(this), amount);
    localUSDC.safeApprove(address(usdcOFT), amount);
    bytes memory oftOptions = OptionsBuilder.newOptions();
    oftOptions.addExecutorLzReceiveOption(oftExecutorGasLimit, 0);
    SendParam memory sendParam = SendParam({ dstEid: arbitrumEid, to: protocolCorePeer, amountLD: amount, ... });
    MessagingFee memory oftFee = usdcOFT.quoteSend(sendParam, false);
    usdcOFT.send{value: oftFee.nativeFee}(sendParam, oftFee, payable(msg.sender));
    guid = keccak256(abi.encodePacked(msg.sender, amount, block.timestamp, block.number));
    pendingDeposits[guid] = PendingDeposit({ lender: msg.sender, amount, timestamp: block.timestamp, processed: false });
    bytes memory payload = abi.encode(uint8(1), msg.sender, amount, guid);
    bytes memory oappOptions = OptionsBuilder.newOptions();
    oappOptions.addExecutorLzReceiveOption(lzReceiveGasLimit, 0);
    MessagingFee memory oappFee = _quote(arbitrumEid, payload, oappOptions, false);
    oappFee.nativeFee = (oappFee.nativeFee * 12000) / 10000;
    _lzSend(arbitrumEid, payload, oappOptions, oappFee, payable(msg.sender));
    emit DepositInitiated(msg.sender, amount, guid, arbitrumEid);
}
```

- **Mocks**
  - `MockUSDC` and `MockOFT` provide faucet-like tokens with 6 decimals so that the OFT module can mimic real USDC bridging in dev/test environments.

```7:107:contracts/mocks/MockUSDC.sol
contract MockUSDC is ERC20, Ownable {
    uint8 public constant DECIMALS = 6;
    function decimals() public pure override returns (uint8) { return DECIMALS; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function mintUSD(address to, uint256 usdAmount) external { _mint(to, usdAmount * 10**DECIMALS); }
}
```

```7:102:contracts/mocks/MockOFT.sol
contract MockOFT is OFT {
    uint8 public constant DECIMALS = 6;
    constructor(string memory _name, string memory _symbol, address _lzEndpoint, address _delegate)
        OFT(_name, _symbol, _lzEndpoint, _delegate) {}
    function decimals() public pure override returns (uint8) { return DECIMALS; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
```

## LayerZero Alignment & Message Catalog

- `layerzero.config.ts` formalizes endpoint IDs (Arbitrum 40231, Base 40245, Optimism 40232), contract roles per chain, OFT peer graph, and OApp message types. It documents the requirement that every LenderVault and CollateralVault is paired with the hub and enumerates message types 1–4 for consistent decoding.

```17:205:layerzero.config.ts
const ARBITRUM_SEPOLIA_EID = EndpointId.ARBSEP_V2_TESTNET; // 40231
...
export const MessageTypes = {
  LENDER_DEPOSIT: 1,
  LENDER_DEPOSIT_CONFIRMATION: 2,
  COLLATERAL_UPDATE: 3,
  COLLATERAL_WITHDRAWAL_APPROVAL: 4,
} as const;
export const chainConfig = {
  arbitrumSepolia: { eid: ARBITRUM_SEPOLIA_EID, chainId: 421614, role: "Main Protocol" },
  baseSepolia: { eid: BASE_SEPOLIA_EID, chainId: 84532, role: "Satellite Chain (Lenders & Borrowers)" },
  optimismSepolia: { eid: OPTIMISM_SEPOLIA_EID, chainId: 11155420, role: "Satellite Chain (Lenders & Borrowers)" },
};
```

## Deployment & Tooling

- **Hardhat 3.0 configuration** defines optimizer settings, Shanghai EVM target, and custom RPC endpoints for all supported testnets.

```11:45:hardhat.config.ts
export default defineConfig({
  solidity: { version: "0.8.28", settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "shanghai" } },
  networks: {
    hardhat: { type: "edr-simulated", chainId: 31337 },
    arbitrumSepolia: { type: "http", url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "...", accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [], chainId: 421614 },
    baseSepolia: { ... chainId: 84532 },
    optimismSepolia: { ... chainId: 11155420 },
  },
  paths: { sources: "./contracts", tests: "./test", cache: "./cache", artifacts: "./artifacts" },
});
```

- **Package scripts** orchestrate builds, tests, deployments (monolithic and per-chain), and peer configuration commands. `hardhat` 3.0.15 and `@nomicfoundation/hardhat-ignition` 3.0.5 are declared dependencies, aligning with Hardhat’s latest plugin ecosystem, while LayerZero and Pyth libraries power the contracts.

```7:53:package.json
"scripts": {
  "build": "hardhat build",
  "test": "hardhat test",
  "deploy": "hardhat run scripts/deploy.ts --network arbitrumSepolia",
  "deploy:arbitrum": "hardhat ignition deploy ignition/modules/ArbitrumSepolia.ts --network arbitrumSepolia --parameters ignition/parameters/arbitrumSepolia.json",
  "deploy:baseSepolia": "tsx scripts/deploy-satellite.ts --chain baseSepolia",
  "deploy:optimism": "tsx scripts/deploy-satellite.ts --chain optimismSepolia",
  "configure:peers": "hardhat run scripts/configure-peers.ts",
  ...
},
"devDependencies": {
  "@nomicfoundation/hardhat-ethers": "^4.0.3",
  "ethers": "^6.15.0",
  "hardhat": "^3.0.15",
  "tsx": "^4.20.6"
},
"dependencies": {
  "@layerzerolabs/lz-evm-oapp-v2": "^2.3.37",
  "@pythnetwork/pyth-sdk-solidity": "^3.1.0",
  "@openzeppelin/contracts": "^4.9.6",
  ...
}
```

- **Ignition modules** codify deterministic deployments.
  - `CoreContracts` deploys hub contracts, wires dependencies, and seeds the ETH price feed target.

```15:63:ignition/modules/CoreContracts.ts
export default buildModule("CoreContracts", (m) => {
    const pythAddress = m.getParameter("pythAddress");
    const lzEndpoint = m.getParameter("lzEndpoint");
    const delegate = m.getParameter("delegate", m.getAccount(0));
    const creditScore = m.contract("ContinuousCreditScore");
    const feeBasedLimits = m.contract("FeeBasedLimits", [creditScore]);
    const priceOracle = m.contract("PriceOracle", [pythAddress]);
    const mockUSDC = m.contract("MockUSDC", ["Mock USDC", "mUSDC"]);
    const protocolCore = m.contract("ProtocolCore", [mockUSDC, creditScore, feeBasedLimits, priceOracle, lzEndpoint, delegate]);
    const liquidationManager = m.contract("LiquidationManager", [priceOracle, creditScore, protocolCore, mockUSDC]);
    m.call(protocolCore, "setLiquidationManager", [liquidationManager]);
    const ethPriceFeedId = m.getParameter("ethPriceFeedId");
    if (ethPriceFeedId) {
        m.call(priceOracle, "addPriceFeed", ["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", ethPriceFeedId]);
    }
    return { creditScore, feeBasedLimits, priceOracle, mockUSDC, protocolCore, liquidationManager };
});
```

  - `SatelliteChain` generalizes per-network deployments, ensuring vaults know the hub’s bytes32 address and endpoints. It also reuses the `MockOFT` module.

```15:58:ignition/modules/SatelliteChain.ts
export default buildModule("SatelliteChain", (m) => {
    const lzEndpoint = m.getParameter("lzEndpoint");
    const delegate = m.getParameter("delegate", m.getAccount(0));
    const protocolCoreEid = m.getParameter("protocolCoreEid");
    const protocolCoreAddress = m.getParameter("protocolCoreAddress");
    const mockUSDC = m.contract("MockUSDC", ["Mock USDC", "mUSDC"]);
    const oft = m.useModule(MockOFT);
    const lenderVault = m.contract("LenderVault", [mockUSDC, lzEndpoint, delegate]);
    const collateralVault = m.contract("CollateralVault", [lzEndpoint, delegate]);
    m.call(lenderVault, "setProtocolCore", [protocolCoreAddress, protocolCoreEid]);
    m.call(lenderVault, "setUSDCOTF", [oft.mockOFT]);
    m.call(collateralVault, "setProtocolCore", [protocolCoreAddress, protocolCoreEid]);
    m.call(collateralVault, "setAssetDecimals", ["0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", 18]);
    return { mockUSDC, mockOFT: oft.mockOFT, lenderVault, collateralVault };
});
```

  - `ArbitrumSepolia` reuses `CoreContracts` and `MockOFT`, then wires the OFT into the hub.

```15:27:ignition/modules/ArbitrumSepolia.ts
export default buildModule("ArbitrumSepolia", (m) => {
    const core = m.useModule(CoreContracts);
    const oft = m.useModule(MockOFT);
    m.call(core.protocolCore, "setUSDCOTF", [oft.mockOFT]);
    return { ...core, ...oft };
});
```

  - Parameter JSON files capture LayerZero endpoints, delegate wallet, and hub bytes32 address so that deployments remain reproducible.

```1:12:ignition/parameters/arbitrumSepolia.json
{
    "CoreContracts": {
        "pythAddress": "0x549Ebba8036Ab746611B4fFA1423eb0A4Df61440",
        "lzEndpoint": "0x6EDCE65403992e310A62460808c4b910D972f10f",
        "ethPriceFeedId": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
        "delegate": "0xa05d4Ba3578F4e37Dd8c157A60D10131BF7A22c7"
    },
    "MockOFT": {
        "lzEndpoint": "0x6EDCE65403992e310A62460808c4b910D972f10f",
        "delegate": "0xa05d4Ba3578F4e37Dd8c157A60D10131BF7A22c7"
    }
}
```

## Automation Scripts & Operational Runbooks

- **`scripts/deploy.ts`** orchestrates a full rollout (Arbitrum hub, parameter patching, Base + Optimism satellite deployments) and writes a consolidated `deployments.json`. It shells out to Ignition, reads `deployed_addresses.json`, updates satellite parameter files with the hub address, and prints manual instructions for LayerZero peer configuration.

```471:746:scripts/deploy.ts
async function main() {
    console.log("🚀 OmniCredit Protocol Deployment");
    const networkName = process.env.HARDHAT_NETWORK || (... ? ... : "hardhat");
    ...
    console.log("STEP 1: Deploying on Arbitrum Sepolia");
    await deployWithIgnition("ignition/modules/ArbitrumSepolia.ts", networkName, "ignition/parameters/arbitrumSepolia.json");
    deployments.arbitrumSepolia.protocolCore = getIgnitionAddress(421614, "CoreContracts", "ProtocolCore");
    ...
    console.log("STEP 2: Updating Satellite Chain Parameters");
    updateSatelliteParameters("baseSepolia", deployments.arbitrumSepolia.protocolCore!);
    ...
    console.log("STEP 3: Deploying on Base Sepolia");
    await deployWithIgnition("ignition/modules/BaseSepolia.ts", "baseSepolia", "ignition/parameters/baseSepolia.json");
    ...
    console.log("STEP 4: Deploying on Optimism Sepolia");
    ...
    console.log("STEP 5: Configuring LayerZero Peers");
    console.log("⚠️  Peer configuration requires manual execution on each network.");
    ...
    console.log("✅ DEPLOYMENT COMPLETE");
}
```

- **`scripts/deploy-satellite.ts`** focuses on a single satellite: it resolves the hub address (either from Ignition artifacts or `deployments.json`), patches the JSON parameter file by converting the address to bytes32, and runs the appropriate Ignition module with `--reset`.

```23:205:scripts/deploy-satellite.ts
const CHAIN_CONFIG = { baseSepolia: { module: ".../BaseSepolia.ts", ... }, optimismSepolia: {...} };
function updateParametersFile(parametersRelativePath: string, protocolCore: string): void {
    const params = JSON.parse(readFileSync(paramsPath, "utf-8"));
    const protocolCoreBytes32 = addressToBytes32(protocolCore);
    params.protocolCoreAddress = protocolCoreBytes32;
    if (params.SatelliteChain) {
        params.SatelliteChain.protocolCoreAddress = protocolCoreBytes32;
    }
    writeFileSync(paramsPath, JSON.stringify(params, null, 2));
}
async function main() {
    const chain = parseChainArg();
    const protocolCoreAddress = loadProtocolCoreAddress();
    updateParametersFile(config.parameters, protocolCoreAddress);
    await runIgnitionDeploy(config.module, config.network, config.parameters);
    console.log(`✅ ${chain} deployment completed`);
}
```

- **Operational README** (scripts) documents prerequisites, warns about Hardhat 3.0 issues (notably `hre.ethers` resolution), lists both monolithic and modular workflows, and enumerates manual peer configuration commands. It also references a `scripts/configure-peers.ts` helper that is mentioned but currently absent from the repository—teams should supply or regenerate it to complete the automation story.

```20:149:scripts/README.md
A causa di un problema noto con Hardhat 3 e `@nomicfoundation/hardhat-ethers`, lo script `deploy.ts` potrebbe non funzionare correttamente...
Opzione 2: Deployment Modulare (consigliato)
npm run deploy:arbitrum
npm run deploy:baseSepolia
npm run deploy:optimism
...
Dopo il deployment, configura i peer LayerZero:
npm run configure:peers:arbitrum
...
Oppure usa lo script diretto:
npx hardhat run scripts/configure-peers.ts --network arbitrumSepolia
...
```

- **Ignition README** mirrors the same workflow, providing a checklist and referencing manual peer configuration. It reinforces the need to run Arbitrum first, then satellites, then configure peers.

## Risk, Operations & Observations

- The lending hub uses Pyth-sourced USD valuations, but `CollateralVault` currently assumes ETH-only collateral; additional assets require `setAssetDecimals` plus `PriceOracle.addPriceFeed`.
- Liquidation logic references Uniswap v4 `IPoolManager`, so deployment environments must provide deployed PoolManager hooks and pool keys; no config script is included to set `liquidationPool`.
- Scripts reference a non-existent `scripts/configure-peers.ts`. Without it, peer setup must happen manually via Hardhat console or ad-hoc scripts; documenting or adding this file would complete the automation story.
- Security relies heavily on correct LayerZero peer whitelisting. Always authorize vault addresses in `ProtocolCore` before allowing deposits, or funds could be locked cross-chain.
- Ignition parameter files (Base/Optimism) include a placeholder `protocolCoreAddress`; ensure `deploy-satellite.ts` is run after Arbitrum so the bytes32 address is replaced automatically.

---

This document captures every contract, Ignition module, script, and root configuration file, along with their relationships to LayerZero, Hardhat 3.0, and the Pyth Network. Use it as the authoritative project brief for contributors, reviewers, and deployers.


