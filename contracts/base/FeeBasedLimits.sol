// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ContinuousCreditScore} from "./ContinuousCreditScore.sol";

/**
 * @title FeeBasedLimits
 * @notice Anti-gaming mechanism that limits borrowing based on LTV and fees paid
 * @dev Prevents users from building credit score and running away with excessive loans
 *
 * Key Formula:
 * Max Loan = min(
 *     Collateral × LTV,
 *     Collateral + (Total Interest Paid × 0.5)
 * )
 *
 * Where:
 * - LTV ranges from 50% (score 0) to 150% (score 1000)
 * - Interest buffer prevents borrowing beyond proven track record
 *
 * Example:
 * - User has paid $1000 in interest, has $10,000 collateral, LTV 100%
 * - LTV-based limit = $10,000 × 100% = $10,000
 * - Interest-buffered limit = $10,000 + ($1,000 × 0.5) = $10,500
 * - Max Borrow = min($10,000, $10,500) = $10,000
 *
 * This ensures users can't abuse high LTVs by borrowing far beyond their proven history.
 */
contract FeeBasedLimits is Ownable {
    // Constants
    uint256 public constant BPS_DENOMINATOR = 10000; // 100% = 10000 BPS

    // Interest buffer factor per spec (lines 117-170): 50% of interest paid
    // This is FIXED at 50% to prevent "score and run" attacks
    uint256 public constant INTEREST_BUFFER_FACTOR = 5000; // 50% in BPS

    // Minimum fee limit to enable borrowing (prevents dust attacks)
    // Default: $10 USD (6 decimals - USDC)
    uint256 public minimumFeeLimitUSD = 10e6;

    // Reference to the credit score contract
    ContinuousCreditScore public immutable creditScore;

    // Events
    event MinimumFeeLimitUpdated(uint256 oldMinimum, uint256 newMinimum);
    event BorrowLimitCalculated(
        address indexed user,
        uint256 feeLimit,
        uint256 ratioLimit,
        uint256 finalLimit
    );

    // Errors
    error InvalidMinimum();
    error InsufficientFeeHistory();

    /**
     * @notice Constructor
     * @param _creditScore Address of the ContinuousCreditScore contract
     * 
     */
    constructor(
        address _creditScore
    ) {
        creditScore = ContinuousCreditScore(_creditScore);
        _transferOwnership(msg.sender);
    }

    /**
     * @notice Update the minimum fee limit
     * @param newMinimumUSD New minimum in USD with 6 decimals (USDC)
     * @dev Only owner can update. Must be > 0
     */
    function setMinimumFeeLimit(uint256 newMinimumUSD) external onlyOwner {
        if (newMinimumUSD == 0) revert InvalidMinimum();
        uint256 oldMinimum = minimumFeeLimitUSD;
        minimumFeeLimitUSD = newMinimumUSD;
        emit MinimumFeeLimitUpdated(oldMinimum, newMinimumUSD);
    }

    /**
     * @notice Calculate interest-buffered limit for a user
     * @param user Address of the borrower
     * @param collateralValueUSD Total collateral value in USD (6 decimals - USDC)
     * @return bufferedLimitUSD Maximum borrowable based on collateral + interest buffer
     */
    function calculateBufferedLimit(address user, uint256 collateralValueUSD)
        public
        view
        returns (uint256 bufferedLimitUSD)
    {
        (ContinuousCreditScore.UserCredit memory credit, , ) = creditScore.getUserCreditProfile(user);

        // Buffered Limit = Collateral + (Total Interest Paid × 0.5)
        // Per spec lines 117-170, this prevents "score and run" attacks
        uint256 interestBuffer = (credit.totalInterestPaidUSD * INTEREST_BUFFER_FACTOR) / BPS_DENOMINATOR; // 50%
        bufferedLimitUSD = collateralValueUSD + interestBuffer;
    }

    /**
     * @notice Calculate LTV-based limit for a user
     * @param user Address of the borrower
     * @param collateralValueUSD Total collateral value in USD (6 decimals - USDC)
     * @return ltvLimitUSD Maximum borrowable based on LTV ratio (6 decimals - USDC)
     */
    function calculateLTVLimit(address user, uint256 collateralValueUSD)
        public
        view
        returns (uint256 ltvLimitUSD)
    {
        // Get user's LTV ratio
        (, , uint256 ltvBPS) = creditScore.getUserCreditProfile(user);

        // LTV Limit = Collateral Value × LTV
        // If LTV is 50% (5000 BPS), user can borrow: collateral × 0.5
        // If LTV is 150% (15000 BPS), user can borrow: collateral × 1.5
        ltvLimitUSD = (collateralValueUSD * ltvBPS) / BPS_DENOMINATOR;
    }

    /**
     * @notice Calculate maximum borrow amount for a user
     * @param user Address of the borrower
     * @param collateralValueUSD Total collateral value in USD (6 decimals - USDC)
     * @return maxBorrowUSD Maximum amount user can borrow (6 decimals - USDC)
     * @return ltvLimit LTV-based limit component (6 decimals - USDC)
     * @return bufferedLimit Interest-buffered limit component (6 decimals - USDC)
     */
    function calculateMaxBorrow(address user, uint256 collateralValueUSD)
        public
        view
        returns (
            uint256 maxBorrowUSD,
            uint256 ltvLimit,
            uint256 bufferedLimit
        )
    {
        ltvLimit = calculateLTVLimit(user, collateralValueUSD);
        bufferedLimit = calculateBufferedLimit(user, collateralValueUSD);

        // Max Borrow = min(LTV Limit, Buffered Limit)
        maxBorrowUSD = ltvLimit < bufferedLimit ? ltvLimit : bufferedLimit;
    }

    /**
     * @notice Check if a user can borrow a specific amount
     * @param user Address of the borrower
     * @param collateralValueUSD Total collateral value in USD (6 decimals - USDC)
     * @param requestedBorrowUSD Requested borrow amount in USD (6 decimals - USDC)
     * @return allowed True if user can borrow the requested amount
     * @return maxBorrowUSD Maximum amount user can actually borrow (6 decimals - USDC)
     */
    function canBorrow(
        address user,
        uint256 collateralValueUSD,
        uint256 requestedBorrowUSD
    ) external view returns (bool allowed, uint256 maxBorrowUSD) {
        (maxBorrowUSD, , ) = calculateMaxBorrow(user, collateralValueUSD);
        allowed = requestedBorrowUSD <= maxBorrowUSD;
    }

    /**
     * @notice Get detailed borrow limit breakdown for a user
     * @param user Address of the borrower
     * @param collateralValueUSD Total collateral value in USD (6 decimals - USDC)
     * @return maxBorrow Maximum borrowable amount (6 decimals - USDC)
     * @return ltvLimit LTV-based limit (6 decimals - USDC)
     * @return bufferedLimit Interest-buffered limit (6 decimals - USDC)
     * @return limitingFactor "ltv" or "buffer" indicating which limit is active
     * @return totalInterestPaid Total interest user has paid historically (6 decimals - USDC)
     * @return ltvBPS User's current LTV ratio
     */
    function getBorrowLimitDetails(address user, uint256 collateralValueUSD)
        external
        view
        returns (
            uint256 maxBorrow,
            uint256 ltvLimit,
            uint256 bufferedLimit,
            string memory limitingFactor,
            uint256 totalInterestPaid,
            uint256 ltvBPS
        )
    {
        (maxBorrow, ltvLimit, bufferedLimit) = calculateMaxBorrow(user, collateralValueUSD);

        limitingFactor = ltvLimit < bufferedLimit ? "ltv" : "buffer";

        (ContinuousCreditScore.UserCredit memory credit, , uint256 userLtvBPS) = creditScore.getUserCreditProfile(user);
        totalInterestPaid = credit.totalInterestPaidUSD;
        ltvBPS = userLtvBPS;
    }

    /**
     * @notice Validate a borrow request and revert if invalid
     * @param user Address of the borrower
     * @param collateralValueUSD Total collateral value in USD (6 decimals - USDC)
     * @param requestedBorrowUSD Requested borrow amount in USD (6 decimals - USDC)
     * @dev Reverts with InsufficientFeeHistory if user cannot borrow the requested amount
     */
    function validateBorrowRequest(
        address user,
        uint256 collateralValueUSD,
        uint256 requestedBorrowUSD
    ) external view {
        (uint256 maxBorrow, , ) = calculateMaxBorrow(
            user,
            collateralValueUSD
        );

        if (requestedBorrowUSD > maxBorrow) {
            revert InsufficientFeeHistory();
        }
    }

    /**
     * @notice Calculate how much additional interest a user needs to pay to unlock a target borrow amount
     * @param user Address of the borrower
     * @param targetBorrowUSD Desired borrow amount in USD (6 decimals - USDC)
     * @param collateralValueUSD Current collateral value in USD (6 decimals - USDC)
     * @return additionalInterestNeeded Amount of additional interest needed (6 decimals - USDC)
     * @return isPossible True if achievable with current collateral, false if need more collateral
     */
    function calculateInterestNeededForBorrow(
        address user,
        uint256 targetBorrowUSD,
        uint256 collateralValueUSD
    ) external view returns (uint256 additionalInterestNeeded, bool isPossible) {
        // Calculate current limits
        (uint256 currentMaxBorrow, uint256 currentFeeLimit, uint256 ratioLimit) = calculateMaxBorrow(
            user,
            collateralValueUSD
        );

        // If already can borrow target amount, no additional interest needed
        if (targetBorrowUSD <= currentMaxBorrow) {
            return (0, true);
        }

        // If ratio limit is the bottleneck and target exceeds it, need more collateral
        if (targetBorrowUSD > ratioLimit) {
            isPossible = false;
            additionalInterestNeeded = 0;
            return (additionalInterestNeeded, isPossible);
        }

        // Calculate additional buffered limit needed
        uint256 additionalBufferNeeded = targetBorrowUSD - currentFeeLimit;

        // Convert buffer back to interest needed
        // Buffer = Interest × 0.5
        // Interest = Buffer / 0.5 = Buffer × 2
        additionalInterestNeeded = (additionalBufferNeeded * BPS_DENOMINATOR) / INTEREST_BUFFER_FACTOR; // × 2
        isPossible = true;
    }
}