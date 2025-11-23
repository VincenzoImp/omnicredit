// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PriceOracle
 * @notice Pyth Network integration for real-time price feeds with 400ms updates
 * @dev Pull-based oracle requiring off-chain price update submission
 *
 * Key Features:
 * - 400ms update frequency via Pyth Network
 * - Confidence interval validation
 * - Stale price protection
 * - Support for multiple price feeds (ETH, BTC, USDC, etc.)
 *
 * Pyth Network Integration:
 * 1. Off-chain: Fetch latest price from Pyth Hermes API
 * 2. On-chain: Submit price update with updatePriceFeeds()
 * 3. Use: Get price with getPrice() or getPriceUnsafe()
 */
contract PriceOracle is Ownable {
    // Pyth contract interface
    IPyth public immutable pyth;

    // Price feed IDs (bytes32) for supported assets
    // These are Pyth's unique identifiers for each price feed
    mapping(address => bytes32) public assetToPriceFeed;

    // Reverse mapping for convenience
    mapping(bytes32 => address) public priceFeedToAsset;

    // Maximum age for prices (in seconds) before considered stale
    uint256 public maxPriceAge = 60; // 60 seconds default

    // Maximum acceptable confidence ratio (in basis points)
    // If confidence / price > this ratio, price is considered unreliable
    // Default: 100 BPS = 1% (confidence must be < 1% of price)
    uint256 public maxConfidenceRatioBPS = 100;

    uint256 public constant BPS_DENOMINATOR = 10000;

    // Events
    event PriceFeedAdded(address indexed asset, bytes32 indexed priceFeedId);
    event PriceFeedRemoved(address indexed asset, bytes32 indexed priceFeedId);
    event MaxPriceAgeUpdated(uint256 oldAge, uint256 newAge);
    event MaxConfidenceRatioUpdated(uint256 oldRatio, uint256 newRatio);
    event PriceRetrieved(
        address indexed asset,
        int64 price,
        uint64 conf,
        int32 expo,
        uint256 publishTime
    );

    // Errors
    error InvalidPythAddress();
    error InvalidAssetAddress();
    error PriceFeedNotFound(address asset);
    error StalePrice(address asset, uint256 priceAge, uint256 maxAge);
    error NegativePrice(address asset);
    error PriceConfidenceTooWide(address asset, uint256 confidenceRatioBPS);
    error InvalidMaxAge();
    error InvalidConfidenceRatio();

    /**
     * @notice Constructor
     * @param _pyth Address of the Pyth contract on this chain
     * 
     */
    constructor(address _pyth) {
        if (_pyth == address(0)) revert InvalidPythAddress();
        pyth = IPyth(_pyth);
        _transferOwnership(msg.sender);
    }

    /**
     * @notice Add a price feed for an asset
     * @param asset Address of the asset (e.g., WETH contract address)
     * @param priceFeedId Pyth price feed ID (bytes32)
     *
     * Pyth Price Feed IDs (Testnet & Mainnet):
     * - ETH/USD:  0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
     * - BTC/USD:  0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
     * - USDC/USD: 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a
     */
    function addPriceFeed(address asset, bytes32 priceFeedId) external onlyOwner {
        if (asset == address(0)) revert InvalidAssetAddress();

        assetToPriceFeed[asset] = priceFeedId;
        priceFeedToAsset[priceFeedId] = asset;

        emit PriceFeedAdded(asset, priceFeedId);
    }

    /**
     * @notice Remove a price feed for an asset
     * @param asset Address of the asset
     */
    function removePriceFeed(address asset) external onlyOwner {
        bytes32 priceFeedId = assetToPriceFeed[asset];
        if (priceFeedId == bytes32(0)) revert PriceFeedNotFound(asset);

        delete priceFeedToAsset[priceFeedId];
        delete assetToPriceFeed[asset];

        emit PriceFeedRemoved(asset, priceFeedId);
    }

    /**
     * @notice Update maximum price age
     * @param newMaxAge New maximum age in seconds
     */
    function setMaxPriceAge(uint256 newMaxAge) external onlyOwner {
        if (newMaxAge == 0) revert InvalidMaxAge();
        uint256 oldAge = maxPriceAge;
        maxPriceAge = newMaxAge;
        emit MaxPriceAgeUpdated(oldAge, newMaxAge);
    }

    /**
     * @notice Update maximum confidence ratio
     * @param newRatioBPS New ratio in basis points (e.g., 100 = 1%)
     */
    function setMaxConfidenceRatio(uint256 newRatioBPS) external onlyOwner {
        if (newRatioBPS == 0 || newRatioBPS > 1000) revert InvalidConfidenceRatio();
        uint256 oldRatio = maxConfidenceRatioBPS;
        maxConfidenceRatioBPS = newRatioBPS;
        emit MaxConfidenceRatioUpdated(oldRatio, newRatioBPS);
    }

    /**
     * @notice Get price for an asset with validation
     * @param asset Address of the asset
     * @return price Price in USD with 18 decimals (normalized from Pyth's expo)
     * @dev Reverts if price is stale, negative, or has wide confidence interval
     */
    function getPrice(address asset) public view returns (uint256 price) {
        bytes32 priceFeedId = assetToPriceFeed[asset];
        if (priceFeedId == bytes32(0)) revert PriceFeedNotFound(asset);

        // Get price from Pyth
        PythStructs.Price memory pythPrice = pyth.getPriceNoOlderThan(priceFeedId, maxPriceAge);

        // Validate price is not negative
        if (pythPrice.price < 0) revert NegativePrice(asset);

        // Validate confidence interval
        // Confidence ratio = (conf / price) × 10000 BPS
        uint256 confidenceRatioBPS = (uint64(pythPrice.conf) * BPS_DENOMINATOR) / uint64(pythPrice.price);
        if (confidenceRatioBPS > maxConfidenceRatioBPS) {
            revert PriceConfidenceTooWide(asset, confidenceRatioBPS);
        }

        // Normalize to 18 decimals
        price = _normalizePrice(uint64(pythPrice.price), pythPrice.expo);
    }

    /**
     * @notice Get conservative price for an asset (price - confidence)
     * @param asset Address of the asset
     * @return price Price in USD with 18 decimals, adjusted for confidence
     * @dev Per spec, this is used for liquidations to protect borrowers
     */
    function getConservativePrice(address asset) public view returns (uint256 price) {
        bytes32 priceFeedId = assetToPriceFeed[asset];
        if (priceFeedId == bytes32(0)) revert PriceFeedNotFound(asset);

        PythStructs.Price memory pythPrice = pyth.getPriceNoOlderThan(priceFeedId, maxPriceAge);

        int64 conservativePriceRaw = pythPrice.price - int64(pythPrice.conf);
        if (conservativePriceRaw < 0) revert NegativePrice(asset);

        price = _normalizePrice(uint64(conservativePriceRaw), pythPrice.expo);
    }

    /**
     * @notice Get price without strict validation (useful for liquidation scenarios)
     * @param asset Address of the asset
     * @return price Price in USD with 18 decimals
     * @return publishTime Timestamp of the price
     * @dev Does not revert on wide confidence or slightly stale prices
     */
    function getPriceUnsafe(address asset)
        external
        view
        returns (uint256 price, uint256 publishTime)
    {
        bytes32 priceFeedId = assetToPriceFeed[asset];
        if (priceFeedId == bytes32(0)) revert PriceFeedNotFound(asset);

        PythStructs.Price memory pythPrice = pyth.getPriceUnsafe(priceFeedId);

        // Still validate price is not negative
        if (pythPrice.price < 0) revert NegativePrice(asset);

        price = _normalizePrice(uint64(pythPrice.price), pythPrice.expo);
        publishTime = pythPrice.publishTime;
    }

    /**
     * @notice Get price with full details including confidence
     * @param asset Address of the asset
     * @return price Price in USD with 18 decimals
     * @return confidence Confidence interval in USD with 18 decimals
     * @return publishTime Timestamp of the price
     */
    function getPriceWithConfidence(address asset)
        external
        view
        returns (
            uint256 price,
            uint256 confidence,
            uint256 publishTime
        )
    {
        bytes32 priceFeedId = assetToPriceFeed[asset];
        if (priceFeedId == bytes32(0)) revert PriceFeedNotFound(asset);

        PythStructs.Price memory pythPrice = pyth.getPriceNoOlderThan(priceFeedId, maxPriceAge);

        if (pythPrice.price < 0) revert NegativePrice(asset);

        price = _normalizePrice(uint64(pythPrice.price), pythPrice.expo);
        confidence = _normalizePrice(pythPrice.conf, pythPrice.expo);
        publishTime = pythPrice.publishTime;
    }

    /**
     * @notice Update price feeds with fresh data from Pyth
     * @param updateData Encoded price update data from Pyth Hermes API
     * @dev Must send fee with transaction (check getUpdateFee() first)
     *
     * Usage:
     * 1. Fetch updateData from Pyth Hermes: https://hermes.pyth.network/
     * 2. Get required fee: oracle.getUpdateFee(updateData)
     * 3. Call: oracle.updatePriceFeeds{value: fee}(updateData)
     */
    function updatePriceFeeds(bytes[] calldata updateData) external payable {
        uint256 fee = pyth.getUpdateFee(updateData);
        pyth.updatePriceFeeds{value: fee}(updateData);
    }

    /**
     * @notice Get the fee required to update price feeds
     * @param updateData Encoded price update data
     * @return fee Required fee in native token (wei)
     */
    function getUpdateFee(bytes[] calldata updateData) external view returns (uint256 fee) {
        fee = pyth.getUpdateFee(updateData);
    }

    /**
     * @notice Calculate USD value of an asset amount
     * @param asset Address of the asset
     * @param amount Amount of the asset (in asset's native decimals)
     * @param assetDecimals Decimals of the asset (e.g., 18 for WETH, 6 for USDC)
     * @return valueUSD USD value with 18 decimals
     */
    function getAssetValueUSD(
        address asset,
        uint256 amount,
        uint256 assetDecimals
    ) external view returns (uint256 valueUSD) {
        uint256 priceUSD = getPrice(asset);

        // Normalize amount to 18 decimals, then multiply by price
        if (assetDecimals < 18) {
            amount = amount * 10**(18 - assetDecimals);
        } else if (assetDecimals > 18) {
            amount = amount / 10**(assetDecimals - 18);
        }

        valueUSD = (amount * priceUSD) / 1e18;
    }

    /**
     * @notice Calculate asset amount needed for a target USD value
     * @param asset Address of the asset
     * @param valueUSD Target USD value with 18 decimals
     * @param assetDecimals Decimals of the asset
     * @return amount Amount of asset needed (in asset's native decimals)
     */
    function getAssetAmountForValue(
        address asset,
        uint256 valueUSD,
        uint256 assetDecimals
    ) external view returns (uint256 amount) {
        uint256 priceUSD = getPrice(asset);

        // Calculate amount in 18 decimals
        amount = (valueUSD * 1e18) / priceUSD;

        // Convert to asset's native decimals
        if (assetDecimals < 18) {
            amount = amount / 10**(18 - assetDecimals);
        } else if (assetDecimals > 18) {
            amount = amount * 10**(assetDecimals - 18);
        }
    }

    /**
     * @notice Normalize Pyth price to 18 decimals
     * @param price Raw price from Pyth
     * @param expo Exponent from Pyth (typically negative, e.g., -8)
     * @return normalizedPrice Price with 18 decimals
     *
     * Example:
     * - Pyth ETH/USD: price = 200000000000, expo = -8
     * - Actual price: 2000.00000000 USD
     * - Normalized (18 decimals): 2000000000000000000000
     */
    function _normalizePrice(uint64 price, int32 expo) internal pure returns (uint256 normalizedPrice) {
        // Pyth prices have variable exponents (usually negative)
        // We need to normalize to 18 decimals
        // Formula: normalizedPrice = price × 10^(18 + expo)

        int256 adjustment = 18 + int256(expo);

        if (adjustment >= 0) {
            normalizedPrice = uint256(price) * 10**uint256(adjustment);
        } else {
            normalizedPrice = uint256(price) / 10**uint256(-adjustment);
        }
    }

    /**
     * @notice Check if a price feed exists for an asset
     * @param asset Address of the asset
     * @return exists True if price feed is configured
     */
    function hasPriceFeed(address asset) external view returns (bool exists) {
        exists = assetToPriceFeed[asset] != bytes32(0);
    }

    /**
     * @notice Get the price feed ID for an asset
     * @param asset Address of the asset
     * @return priceFeedId Pyth price feed ID (bytes32)
     */
    function getPriceFeedId(address asset) external view returns (bytes32 priceFeedId) {
        priceFeedId = assetToPriceFeed[asset];
        if (priceFeedId == bytes32(0)) revert PriceFeedNotFound(asset);
    }
}
