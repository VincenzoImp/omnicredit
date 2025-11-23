// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {PriceOracle} from "./PriceOracle.sol";
import {ContinuousCreditScore} from "./ContinuousCreditScore.sol";
import {ProtocolCore} from "./ProtocolCore.sol";

/**
 * @title LiquidationManager
 * @notice Clean rewrite of liquidation system with Uniswap v4 integration
 * @dev Executes liquidations through Uniswap v4 pools
 *
 * Key Features:
 * - Dutch auction liquidations (0% → 10% discount over 1 hour)
 * - Liquidations execute through Uniswap v4 pools
 * - Credit score penalties for liquidated borrowers
 * - MEV-resistant pricing
 *
 * Integration Flow:
 * 1. Anyone can start liquidation auction for underwater position
 * 2. Liquidator calls executeLiquidation()
 * 3. LiquidationManager calls poolManager.swap()
 * 4. Swap executes collateral → USDC
 * 5. Debt is repaid to protocol
 * 6. Surplus goes to protocol reserves
 * 7. Borrower's credit score is penalized
 * 8. Liquidation completes
 */
contract LiquidationManager is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ STATE VARIABLES ============

    /// @notice Core protocol contracts
    PriceOracle public immutable priceOracle;
    ContinuousCreditScore public immutable creditScore;
    ProtocolCore public lendingPool;
    IERC20 public immutable usdc;  // USDC token for debt repayment

    /// @notice Uniswap v4 integration
    IPoolManager public poolManager;
    PoolKey public liquidationPool;  // ETH-USDC pool for liquidations

    /// @notice Dutch auction parameters
    uint256 public auctionDuration = 1 hours;      // Time for bonus to decrease
    uint256 public startBonusBPS = 1500;           // 15% bonus at start
    uint256 public endBonusBPS = 500;              // 5% bonus at end
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Liquidation auction structure
    struct Auction {
        address borrower;
        uint256 collateralAmount;    // Amount of collateral to liquidate
        uint256 debtAmount;          // Amount of debt to repay (USDC, 6 decimals)
        uint256 startTime;
        uint256 startPrice;          // Collateral price at auction start (18 decimals)
        bool isActive;
    }

    mapping(bytes32 => Auction) public auctions;
    uint256 public auctionCount;

    // ============ EVENTS ============

    event AuctionStarted(
        bytes32 indexed auctionId,
        address indexed borrower,
        uint256 collateralAmount,
        uint256 debtAmount
    );
    event LiquidationExecuted(
        bytes32 indexed auctionId,
        address indexed liquidator,
        uint256 collateralAmount,
        uint256 debtRepaid,
        uint256 bonusApplied
    );
    event PoolManagerSet(address indexed poolManager, bytes32 poolId);

    // ============ ERRORS ============

    error LoanNotLiquidatable();
    error AuctionAlreadyActive();
    error AuctionNotActive();
    error NoPoolManager();

    // ============ CONSTRUCTOR ============

    constructor(
        address _priceOracle,
        address _creditScore,
        address _lendingPool,
        address _usdc
    ) {
        priceOracle = PriceOracle(_priceOracle);
        creditScore = ContinuousCreditScore(_creditScore);
        lendingPool = ProtocolCore(payable(_lendingPool));
        usdc = IERC20(_usdc);
        _transferOwnership(msg.sender);
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Set Uniswap v4 pool manager and liquidation pool
     * @param _poolManager IPoolManager contract address
     * @param _poolKey Pool key for ETH-USDC pool for liquidations
     */
    function setPoolManager(
        address _poolManager,
        PoolKey memory _poolKey
    ) external onlyOwner {
        poolManager = IPoolManager(_poolManager);
        liquidationPool = _poolKey;

        bytes32 poolId = keccak256(abi.encode(_poolKey));
        emit PoolManagerSet(_poolManager, poolId);
    }

    /**
     * @notice Update lending pool reference
     * @param _lendingPool New ProtocolCore address
     */
    function setLendingPool(address _lendingPool) external onlyOwner {
        lendingPool = ProtocolCore(payable(_lendingPool));
    }

    // ============ LIQUIDATION FUNCTIONS ============

    /**
     * @notice Start liquidation auction for underwater position
     * @param borrower Address of the borrower to liquidate
     * @return auctionId Unique identifier for the auction
     */
    function startAuction(address borrower) external returns (bytes32 auctionId) {
        // Check if position is liquidatable (health factor < 100%)
        uint256 healthFactor = lendingPool.getHealthFactor(borrower);
        if (healthFactor >= BPS_DENOMINATOR) revert LoanNotLiquidatable();

        // Get loan details
        (
            uint256 principal,
            ,
            ,
            uint256 accruedInterest,
            uint256 collateralValue,
            ,
            bool isActive
        ) = lendingPool.loans(borrower);

        if (!isActive) revert LoanNotLiquidatable();

        // Generate unique auction ID
        auctionId = keccak256(
            abi.encodePacked(borrower, block.timestamp, auctionCount++)
        );

        // Check no active auction exists
        if (auctions[auctionId].isActive) revert AuctionAlreadyActive();

        // Get current collateral price (18 decimals from oracle)
        // Assuming ETH collateral - in production, would be configurable
        address collateralAsset = address(0); // ETH
        uint256 collateralPrice = priceOracle.getPrice(collateralAsset);

        // Calculate collateral amount in native units (ETH with 18 decimals)
        // amount = value / price
        // collateralValue is in USD (6 decimals), price is in USD per ETH (18 decimals)
        // amount in ETH (18 decimals) = (collateralValue_6dec * 10^18) / price_18dec
        uint256 collateralAmount = (collateralValue * 1e18) / collateralPrice;

        // Create auction
        auctions[auctionId] = Auction({
            borrower: borrower,
            collateralAmount: collateralAmount,
            debtAmount: principal + accruedInterest,  // Total debt (6 decimals)
            startTime: block.timestamp,
            startPrice: collateralPrice,
            isActive: true
        });

        emit AuctionStarted(auctionId, borrower, collateralAmount, principal + accruedInterest);
    }

    /**
     * @notice Execute liquidation through Uniswap v4 pool
     * @param auctionId Auction identifier
     *
     * This function:
     * 1. Calculates current discount based on Dutch auction
     * 2. Swaps collateral → USDC through Uniswap v4 pool
     * 3. Repays debt on behalf of borrower
     * 4. Sends surplus to protocol reserves
     * 5. Penalizes borrower's credit score
     */
    function executeLiquidation(bytes32 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        if (!auction.isActive) revert AuctionNotActive();
        if (address(poolManager) == address(0)) revert NoPoolManager();

        // Mark auction as complete
        auction.isActive = false;

        // Prepare swap parameters
        // zeroForOne: true (ETH → USDC)
        // amountSpecified: negative = exact input (collateral amount)
        // sqrtPriceLimitX96: 0 = no limit
        SwapParams memory swapParams = SwapParams({
            zeroForOne: true,
            amountSpecified: -int256(auction.collateralAmount),
            sqrtPriceLimitX96: 0
        });

        // Execute swap through Uniswap v4 pool
        bytes memory hookData = ""; // Empty hook data
        BalanceDelta delta = poolManager.swap(liquidationPool, swapParams, hookData);

        // Extract USDC received from swap
        // delta.amount1() is USDC output (negative = tokens out)
        int128 amount1 = delta.amount1();
        uint256 usdcReceived = amount1 < 0 ? uint256(uint128(-amount1)) : 0;

        // Calculate liquidation payment breakdown:
        // 1. Debt repayment (goes to protocol)
        // 2. Liquidator bonus (extra USDC for liquidator)
        require(usdcReceived >= auction.debtAmount, "Insufficient USDC from swap");

        // Repay debt to lending pool
        usdc.safeApprove(address(lendingPool), auction.debtAmount);
        lendingPool.repayFromLiquidation(auction.borrower, auction.debtAmount);

        // Any remaining USDC from the swap is a surplus (bonus) and goes to reserves
        uint256 surplus = usdcReceived - auction.debtAmount;
        if (surplus > 0) {
            usdc.safeApprove(address(lendingPool), surplus);
            lendingPool.addToReserves(surplus);
        }

        // Penalize borrower's credit score
        creditScore.recordLiquidation(auction.borrower);

        emit LiquidationExecuted(
            auctionId,
            msg.sender,
            auction.collateralAmount,
            auction.debtAmount,
            surplus
        );
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Calculate current bonus in Dutch auction
     * @param auctionId Auction identifier
     * @return bonusBPS Current liquidation bonus in basis points
     *
     * Linear decrease from 15% to 5% over auctionDuration
     * This incentivizes fast liquidation while remaining profitable throughout
     */
    function getCurrentBonus(bytes32 auctionId) public view returns (uint256 bonusBPS) {
        Auction storage auction = auctions[auctionId];
        if (!auction.isActive) return 0;

        uint256 elapsed = block.timestamp - auction.startTime;

        if (elapsed >= auctionDuration) {
            // After 1 hour, bonus is at minimum (5%)
            bonusBPS = endBonusBPS;
        } else {
            // Linear decrease from 15% to 5%
            uint256 bonusRange = startBonusBPS - endBonusBPS;  // 1000 BPS (10%)
            uint256 decrease = (bonusRange * elapsed) / auctionDuration;
            bonusBPS = startBonusBPS - decrease;
        }
    }

    /**
     * @notice Check if a position is liquidatable
     * @param borrower Address of the borrower
     * @return liquidatable True if health factor < 100%
     * @return healthFactor Current health factor in BPS
     */
    function isLiquidatable(address borrower) external view returns (
        bool liquidatable,
        uint256 healthFactor
    ) {
        healthFactor = lendingPool.getHealthFactor(borrower);
        liquidatable = healthFactor < BPS_DENOMINATOR;
    }
}