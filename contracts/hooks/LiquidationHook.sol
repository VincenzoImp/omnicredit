// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-periphery/lib/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-periphery/lib/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-periphery/lib/v4-core/src/types/PoolKey.sol";
import {PoolIdLibrary} from "v4-periphery/lib/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "v4-periphery/lib/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-periphery/lib/v4-core/src/types/BeforeSwapDelta.sol";
import {SwapParams} from "v4-periphery/lib/v4-core/src/types/PoolOperation.sol";
import {StateLibrary} from "v4-periphery/lib/v4-core/src/libraries/StateLibrary.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LiquidationHook
 * @notice Uniswap v4 hook for liquidations with dynamic fees and LVR mitigation
 * @dev Properly inherits from BaseHook and implements Uniswap v4 standards
 *
 * Features:
 * - Dynamic fees: 0.3% base → 1.0% during high volatility
 * - LVR (Loss Versus Rebalancing) mitigation for LPs
 * - 10% liquidation bonus stays in pool reserves
 * - Price tracking for volatility calculation
 *
 * This hook is attached to ETH-USDC pool used for liquidations
 */
contract LiquidationHook is BaseHook, Ownable {
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager; // Added this line

    // ============ CONSTANTS ============

    uint24 public constant BASE_FEE = 3000;      // 0.3% base fee
    uint24 public constant MAX_FEE = 10000;      // 1.0% max fee during high volatility
    uint256 public constant POOL_BONUS_BPS = 1000; // 10% stays in pool
    uint256 public constant BPS_DENOMINATOR = 10000;

    // ============ STATE VARIABLES ============

    /// @notice Price tracking for volatility calculation
    struct PoolState {
        uint256 lastPrice;          // Last recorded price (from sqrtPriceX96)
        uint256 lastUpdateTime;     // Timestamp of last update
        uint256 totalLiquidations;  // Total liquidations through this pool
    }

    mapping(bytes32 => PoolState) public poolStates;

    /// @notice Reference to lending protocol
    address public lendingPool;

    // ============ EVENTS ============

    event LiquidationSwapExecuted(
        address indexed borrower,
        uint256 amountIn,
        uint256 amountOut,
        uint24 feeApplied
    );
    event VolatilityFeeApplied(
        bytes32 indexed poolId,
        uint24 fee,
        uint256 priceChangeBPS
    );

    // ============ CONSTRUCTOR ============

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {
        _transferOwnership(msg.sender);
    }

    // ============ HOOK PERMISSIONS ============

    /**
     * @notice Define which hook callbacks are enabled
     * @return permissions Bitmap of enabled hooks
     */
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,        // ✅ Apply dynamic fee
            afterSwap: true,         // ✅ Track price
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ============ HOOK CALLBACKS ============

    /**
     * @notice Called before swap - applies dynamic fee based on volatility
     * @param key Pool key
     * @param hookData Additional data (contains isLiquidation flag)
     * @return selector Function selector + delta (no delta changes here)
     */
    function _beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        bytes calldata hookData
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        bytes32 poolId = keccak256(abi.encode(key));

        // Check if this is a liquidation swap
        bool isLiquidation = hookData.length > 0 && abi.decode(hookData, (bool));

        if (isLiquidation) {
            // Get current price from pool
            uint256 currentPrice = _estimatePrice(key);

            // Calculate price change since last update
            uint256 priceChangeBPS = _calculatePriceChange(poolId, currentPrice);

            // Calculate volatility-based fee
            uint24 volatilityFee = _calculateVolatilityFee(priceChangeBPS);

            emit VolatilityFeeApplied(poolId, volatilityFee, priceChangeBPS);

            // Return selector + no delta + dynamic fee
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, volatilityFee);
        }

        // Not a liquidation - use default behavior
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    /**
     * @notice Called after swap - updates price tracking
     * @param key Pool key
     * @param hookData Additional data
     * @return selector Function selector + delta (no delta changes)
     */
    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata,
        BalanceDelta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        bytes32 poolId = keccak256(abi.encode(key));

        // Update price tracking
        uint256 currentPrice = _estimatePrice(key);
        poolStates[poolId].lastPrice = currentPrice;
        poolStates[poolId].lastUpdateTime = block.timestamp;

        // If this was a liquidation, increment counter
        bool isLiquidation = hookData.length > 0 && abi.decode(hookData, (bool));
        if (isLiquidation) {
            poolStates[poolId].totalLiquidations++;
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    // ============ INTERNAL FUNCTIONS ============

    /**
     * @notice Calculate volatility-adjusted fee for LVR mitigation
     * @param priceChangeBPS Price change in basis points
     * @return fee Fee in basis points
     *
     * Strategy:
     * - >10% price change → 1.0% fee (max)
     * - >5% price change → 0.7% fee
     * - >2% price change → 0.5% fee
     * - Otherwise → 0.3% fee (base)
     */
    function _calculateVolatilityFee(uint256 priceChangeBPS) internal pure returns (uint24 fee) {
        if (priceChangeBPS > 1000) {        // >10% change
            return MAX_FEE;                 // 1.0% fee
        } else if (priceChangeBPS > 500) {  // >5% change
            return 7000;                    // 0.7% fee
        } else if (priceChangeBPS > 200) {  // >2% change
            return 5000;                    // 0.5% fee
        } else {
            return BASE_FEE;                // 0.3% base fee
        }
    }

    /**
     * @notice Calculate price change percentage since last update
     * @param poolId Pool identifier
     * @param currentPrice Current estimated price
     * @return changeBPS Price change in basis points (10000 = 100%)
     */
    function _calculatePriceChange(
        bytes32 poolId,
        uint256 currentPrice
    ) internal view returns (uint256 changeBPS) {
        uint256 lastPrice = poolStates[poolId].lastPrice;
        if (lastPrice == 0) return 0;

        uint256 change = currentPrice > lastPrice
            ? currentPrice - lastPrice
            : lastPrice - currentPrice;

        changeBPS = (change * BPS_DENOMINATOR) / lastPrice;
    }

    /**
     * @notice Estimate current price from the pool's slot0
     * @param key The key of the pool
     * @return price Estimated price
     * @dev Correctly uses the pool's slot0 sqrtPriceX96
     */
    function _estimatePrice(PoolKey calldata key)
        internal
        view
        returns (uint256 price)
    {
        // Get the pool's current state from the manager
        (uint160 sqrtPriceX96, , , ) = StateLibrary.getSlot0(poolManager, key.toId());

        // price = (sqrtPriceX96 / 2^96)^2
        // Correctly use the actual pool price, not the swap limit
        price = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> 192;
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Set lending pool reference
     * @param _lendingPool Address of the lending pool contract
     */
    function setLendingPool(address _lendingPool) external onlyOwner {
        lendingPool = _lendingPool;
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get pool state for analytics
     * @param poolId Pool identifier
     * @return lastPrice Last recorded price
     * @return lastUpdateTime Timestamp of last update
     * @return totalLiquidations Total liquidations through pool
     */
    function getPoolState(bytes32 poolId) external view returns (
        uint256 lastPrice,
        uint256 lastUpdateTime,
        uint256 totalLiquidations
    ) {
        PoolState storage state = poolStates[poolId];
        return (state.lastPrice, state.lastUpdateTime, state.totalLiquidations);
    }
}