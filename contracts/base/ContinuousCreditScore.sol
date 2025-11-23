// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ContinuousCreditScore
 * @notice Implements a continuous 0-1000 point credit scoring system for OmniCredit
 * @dev Credit score determines Loan-to-Value (LTV) ratio and borrowing capacity
 *
 * Scoring Formula:
 * - Base Score = Total Interest Paid (USD) / $10
 * - Streak Multiplier = 100% + (consecutive on-time loans × 5%) [capped at 150%]
 * - Liquidation Penalty = -200 points per liquidation
 * - Final Score = (Base × Multiplier) - Penalties [capped at 1000]
 *
 * Loan-to-Value (LTV) System:
 * - Score 0    → 50% LTV (borrow $50 per $100 collateral)
 * - Score 500  → 100% LTV (borrow $100 per $100 collateral)
 * - Score 1000 → 150% LTV (borrow $150 per $100 collateral!)
 *
 * Borrowing Limit:
 * - Max Loan = min(Collateral × LTV, Collateral + (Total Interest Paid × 0.5))
 */
contract ContinuousCreditScore is Ownable {
    // Constants
    uint256 public constant MAX_SCORE = 1000;
    uint256 public constant INTEREST_PER_POINT = 10e6; // $10 in USDC (6 decimals)
    uint256 public constant STREAK_BONUS_BPS = 500; // 5% per consecutive loan
    uint256 public constant MAX_STREAK_MULTIPLIER_BPS = 15000; // 150% cap
    uint256 public constant BASE_MULTIPLIER_BPS = 10000; // 100% base
    uint256 public constant LIQUIDATION_PENALTY = 200; // -200 points per liquidation

    // LTV parameters (in basis points, 10000 = 100%)
    uint256 public constant BASE_LTV_BPS = 5000;     // 50% LTV for score 0
    uint256 public constant MAX_LTV_BPS = 15000;     // 150% LTV for score 1000
    uint256 public constant INTEREST_BUFFER_FACTOR = 5000; // 50% of paid interest as buffer

    // Time window for "on-time" repayment tracking (30 days)
    uint256 public constant ON_TIME_WINDOW = 30 days;

    /**
     * @notice User credit profile
     * @dev All monetary values in USD with 6 decimals (USDC standard)
     */
    struct UserCredit {
        uint256 totalInterestPaidUSD;      // Lifetime interest paid in USD (6 decimals - USDC)
        uint256 totalLoansCount;           // Total number of loans taken
        uint256 liquidationCount;          // Number of times liquidated
        uint256 liquidationPenalty;        // Total penalty points from liquidations
        uint256 consecutiveOnTimeCount;    // Current streak of on-time repayments
        uint256 lastLoanTimestamp;         // Timestamp of last loan taken
        uint256 lastRepaymentTimestamp;    // Timestamp of last repayment
    }

    // User address => credit profile
    mapping(address => UserCredit) public userCredits;

    // Authorized contracts that can update credit scores
    mapping(address => bool) public authorizedUpdaters;

    // Events
    event CreditScoreUpdated(
        address indexed user,
        uint256 newScore,
        uint256 totalInterestPaid,
        uint256 consecutiveStreak
    );
    event LoanRecorded(address indexed user, uint256 loanCount);
    event RepaymentRecorded(
        address indexed user,
        uint256 interestPaidUSD,
        bool onTime,
        uint256 newStreak
    );
    event LiquidationRecorded(
        address indexed user,
        uint256 liquidationCount,
        uint256 penaltyApplied
    );
    event UpdaterAuthorized(address indexed updater, bool authorized);

    // Errors
    error Unauthorized();
    error InvalidAddress();

    constructor() {
        _transferOwnership(msg.sender);
    }

    // Modifiers
    modifier onlyAuthorized() {
        if (!authorizedUpdaters[msg.sender] && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    /**
     * @notice Authorize a contract to update credit scores
     * @param updater Address to authorize (typically LendingPool)
     * @param authorized True to authorize, false to revoke
     */
    function setAuthorizedUpdater(address updater, bool authorized) external onlyOwner {
        if (updater == address(0)) revert InvalidAddress();
        authorizedUpdaters[updater] = authorized;
        emit UpdaterAuthorized(updater, authorized);
    }

    /**
     * @notice Record a new loan being taken
     * @param user Address of the borrower
     */
    function recordLoanTaken(address user) external onlyAuthorized {
        UserCredit storage credit = userCredits[user];
        credit.totalLoansCount++;
        credit.lastLoanTimestamp = block.timestamp;

        emit LoanRecorded(user, credit.totalLoansCount);
    }

    /**
     * @notice Record a loan repayment with interest
     * @param user Address of the borrower
     * @param interestPaidUSD Amount of interest paid in USD (6 decimals - USDC)
     */
    function recordRepayment(address user, uint256 interestPaidUSD, bool onTime) external onlyAuthorized {
        UserCredit storage credit = userCredits[user];

        // Update total interest paid
        credit.totalInterestPaidUSD += interestPaidUSD;

        // Update streak based on input from authorized caller
        if (onTime) {
            credit.consecutiveOnTimeCount++;
        } else {
            credit.consecutiveOnTimeCount = 0; // Reset streak
        }

        credit.lastRepaymentTimestamp = block.timestamp;

        emit RepaymentRecorded(user, interestPaidUSD, onTime, credit.consecutiveOnTimeCount);

        // Emit updated score
        uint256 newScore = calculateCreditScore(user);
        emit CreditScoreUpdated(
            user,
            newScore,
            credit.totalInterestPaidUSD,
            credit.consecutiveOnTimeCount
        );
    }

    /**
     * @notice Record a liquidation event
     * @param user Address of the liquidated borrower
     */
    function recordLiquidation(address user) external onlyAuthorized {
        UserCredit storage credit = userCredits[user];

        credit.liquidationCount++;
        credit.liquidationPenalty += LIQUIDATION_PENALTY;
        credit.consecutiveOnTimeCount = 0; // Reset streak on liquidation

        emit LiquidationRecorded(user, credit.liquidationCount, LIQUIDATION_PENALTY);

        // Emit updated score
        uint256 newScore = calculateCreditScore(user);
        emit CreditScoreUpdated(
            user,
            newScore,
            credit.totalInterestPaidUSD,
            credit.consecutiveOnTimeCount
        );
    }

    /**
     * @notice Calculate credit score for a user (0-1000)
     * @param user Address of the user
     * @return score Credit score (0-1000)
     */
    function calculateCreditScore(address user) public view returns (uint256 score) {
        UserCredit storage credit = userCredits[user];

        // Base score = Total Interest Paid / $10
        uint256 baseScore = credit.totalInterestPaidUSD / INTEREST_PER_POINT;

        // Streak multiplier = 100% + (consecutive loans × 5%), capped at 150%
        uint256 streakMultiplierBPS = BASE_MULTIPLIER_BPS +
            (credit.consecutiveOnTimeCount * STREAK_BONUS_BPS);
        if (streakMultiplierBPS > MAX_STREAK_MULTIPLIER_BPS) {
            streakMultiplierBPS = MAX_STREAK_MULTIPLIER_BPS;
        }

        // Apply multiplier
        uint256 multipliedScore = (baseScore * streakMultiplierBPS) / BASE_MULTIPLIER_BPS;

        // Apply liquidation penalty
        if (multipliedScore > credit.liquidationPenalty) {
            score = multipliedScore - credit.liquidationPenalty;
        } else {
            score = 0;
        }

        // Cap at MAX_SCORE
        if (score > MAX_SCORE) {
            score = MAX_SCORE;
        }
    }

    /**
     * @notice Get Loan-to-Value ratio for a user
     * @param user Address of the user
     * @return ltvBPS LTV in basis points (10000 = 100%)
     *
     * Linear interpolation:
     * - Score 0    → 50% LTV (5000 BPS)
     * - Score 500  → 100% LTV (10000 BPS)
     * - Score 1000 → 150% LTV (15000 BPS)
     *
     * Formula: LTV = 5000 + (score × 10)
     */
    /**
     * @notice Get Loan-to-Value ratio for a user
     * @param user Address of the user
     * @return ltvBPS LTV in basis points (10000 = 100%)
     *
     * Linear interpolation:
     * - Score 0    → 50% LTV (5000 BPS)
     * - Score 500  → 100% LTV (10000 BPS)
     * - Score 1000 → 150% LTV (15000 BPS)
     *
     * Formula: LTV = 5000 + (score × 10)
     */
    function getLTV(address user) public view returns (uint256 ltvBPS) {
        uint256 score = calculateCreditScore(user);

        // Linear interpolation: LTV = 50% + (score / 1000) × 100%
        // In BPS: LTV = 5000 + (score × 10000) / 1000
        // Simplified: LTV = 5000 + (score × 10)
        uint256 increase = (score * (MAX_LTV_BPS - BASE_LTV_BPS)) / MAX_SCORE;
        ltvBPS = BASE_LTV_BPS + increase;
    }

    /**
     * @notice Check if a position is liquidatable
     * @param loanAmount Current loan amount in USD
     * @param collateralValue Current collateral value in USD
     * @param totalInterestPaid Total interest paid by user in USD
     * @return isLiquidatable True if position should be liquidated
     *
     * Liquidation when: Loan Amount > Collateral Value + (Interest Paid × 0.5)
     */
    function isLiquidatable(
        uint256 loanAmount,
        uint256 collateralValue,
        uint256 totalInterestPaid
    ) public pure returns (bool) {
        uint256 interestBuffer = (totalInterestPaid * INTEREST_BUFFER_FACTOR) / 10000;
        uint256 maxAllowedLoan = collateralValue + interestBuffer;
        return loanAmount > maxAllowedLoan;
    }

    /**
     * @notice Get complete credit profile for a user
     * @param user Address of the user
     * @return credit UserCredit struct
     * @return score Current credit score (0-1000)
     * @return ltvBPS Loan-to-Value ratio in BPS
     */
    function getUserCreditProfile(address user)
        external
        view
        returns (
            UserCredit memory credit,
            uint256 score,
            uint256 ltvBPS
        )
    {
        credit = userCredits[user];
        score = calculateCreditScore(user);
        ltvBPS = getLTV(user);
    }

    /**
     * @notice Check if user qualifies for a specific LTV
     * @param user Address of the user
     * @param requiredLtvBPS Required LTV in BPS
     * @return qualified True if user's score qualifies them for this LTV or better
     */
    function qualifiesForLTV(address user, uint256 requiredLtvBPS)
        external
        view
        returns (bool qualified)
    {
        uint256 userLTV = getLTV(user);
        qualified = userLTV >= requiredLtvBPS;
    }

    /**
     * @notice Get collateral ratio required for a user (inverse of LTV)
     * @param user Address of the user
     * @return ratioBPS Collateral ratio in basis points
     * @dev This is the inverse of LTV. For compatibility with LendingPool.
     *
     * Collateral Ratio = 100% / LTV% = 10000 * 10000 / LTV
     */
    function getCollateralRatio(address user) public view returns (uint256 ratioBPS) {
        uint256 ltvBPS = getLTV(user);
        // Collateral Ratio = 100% / LTV% = 10000 * 10000 / LTV
        ratioBPS = (10000 * 10000) / ltvBPS;
    }
}