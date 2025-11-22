// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ContinuousCreditScore} from "./ContinuousCreditScore.sol";
import {FeeBasedLimits} from "./FeeBasedLimits.sol";
import {PriceOracle} from "./PriceOracle.sol";
import {CrossChainCoordinator} from "../cross-chain/CrossChainCoordinator.sol";

/**
 * @title ProtocolCore
 * @notice Clean rewrite of core lending protocol - replaces LendingPool.sol
 * @dev Share-based lending pool with credit scoring and cross-chain collateral support
 *
 * Architecture:
 * - Lenders deposit USDC, receive shares
 * - Borrowers provide collateral, take loans based on credit score
 * - Interest accrues continuously
 * - Cross-chain collateral aggregated via CrossChainCoordinator
 *
 * Key Features:
 * - Progressive LTV (50% → 150%) based on credit score
 * - Fee-based limits prevent "score and run" attacks
 * - Interest buffer protects proven borrowers from liquidation
 * - Share-based accounting for fair yield distribution
 */
contract ProtocolCore is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============ STATE VARIABLES ============

    /// @notice Lending token (USDC - 6 decimals)
    IERC20 public immutable lendingToken;

    /// @notice Core protocol contracts
    ContinuousCreditScore public immutable creditScore;
    FeeBasedLimits public immutable feeBasedLimits;
    PriceOracle public immutable priceOracle;

    /// @notice Cross-chain coordinator (optional - only on Base)
    CrossChainCoordinator public coordinator;

    /// @notice Pool shares (lender deposits)
    mapping(address => uint256) public shares;
    uint256 public totalShares;

    /// @notice Pool liquidity tracking
    uint256 public totalDeposits;      // Total USDC deposited (6 decimals)
    uint256 public totalBorrowed;      // Total USDC borrowed (6 decimals)

    /// @notice Borrower loan structure
    struct Loan {
        uint256 principal;              // Amount borrowed in USDC (6 decimals)
        uint256 interestRate;           // Annual rate in BPS (e.g., 1000 = 10%)
        uint256 lastAccrualTimestamp;   // Last time interest was accrued
        uint256 accruedInterest;        // Interest accrued but not yet paid (6 decimals)
        uint256 collateralValueUSD;     // Total collateral value locked (6 decimals)
        uint256 dueDate;                // Timestamp when the loan is due
        bool isActive;                  // True if loan is active
    }

    mapping(address => Loan) public loans;

    /// @notice Interest rate model parameters
    uint256 public baseRateBPS = 200;               // 2% base rate
    uint256 public utilizationMultiplierBPS = 1000; // 10% utilization slope
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant LOAN_DURATION = 30 days;

    /// @notice Protocol settings
    uint256 public minLoanSize = 100e6;    // $100 minimum (6 decimals - USDC)
    uint256 public protocolFeeBPS = 1000;  // 10% of interest goes to protocol
    address public feeCollector;           // Address that receives protocol fees
    address public liquidationManager;     // Authorized liquidation manager
    uint256 public reserves;               // Protocol reserves from liquidation surplus

    // ============ EVENTS ============

    event Deposited(address indexed lender, uint256 amount, uint256 shares);
    event Withdrawn(address indexed lender, uint256 amount, uint256 shares);
    event Borrowed(address indexed borrower, uint256 amount, uint256 collateralValue);
    event Repaid(address indexed borrower, uint256 principal, uint256 interest);
    event InterestAccrued(address indexed borrower, uint256 interest);
    event CoordinatorSet(address indexed coordinator);
    event LiquidationManagerSet(address indexed liquidationManager);
    event LiquidationRepaid(address indexed borrower, uint256 amount);
    event ReservesAdded(uint256 amount);

    // ============ ERRORS ============

    error InvalidAmount();
    error LoanAlreadyActive();
    error NoActiveLoan();
    error InsufficientCollateral();
    error ExceedsBorrowLimit();
    error InsufficientLiquidity();
    error LoanTooSmall();
    error UnauthorizedLiquidation();

    // ============ CONSTRUCTOR ============

    constructor(
        address _lendingToken,
        address _creditScore,
        address _feeBasedLimits,
        address _priceOracle
    ) {
        lendingToken = IERC20(_lendingToken);
        creditScore = ContinuousCreditScore(_creditScore);
        feeBasedLimits = FeeBasedLimits(_feeBasedLimits);
        priceOracle = PriceOracle(_priceOracle);
        _transferOwnership(msg.sender);
    }

    // ============ ADMIN FUNCTIONS ============

    /**
     * @notice Set the cross-chain coordinator (only on Base)
     * @param _coordinator CrossChainCoordinator contract address
     */
    function setCoordinator(address _coordinator) external onlyOwner {
        coordinator = CrossChainCoordinator(_coordinator);
        emit CoordinatorSet(_coordinator);
    }

    /**
     * @notice Set the fee collector address
     * @param _feeCollector Address that receives protocol fees
     */
    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "Invalid address");
        feeCollector = _feeCollector;
    }

    // ============ LENDER FUNCTIONS ============

    /**
     * @notice Deposit USDC into the pool and receive shares
     * @param amount Amount of USDC to deposit (6 decimals)
     * @return sharesIssued Number of shares issued
     */
    function deposit(uint256 amount) external nonReentrant returns (uint256 sharesIssued) {
        if (amount == 0) revert InvalidAmount();

        // Calculate shares: first depositor gets 1:1, others get proportional
        if (totalShares == 0) {
            sharesIssued = amount;
        } else {
            uint256 poolValue = totalDeposits + totalBorrowed;
            sharesIssued = (amount * totalShares) / poolValue;
        }

        // Update state
        shares[msg.sender] += sharesIssued;
        totalShares += sharesIssued;
        totalDeposits += amount;

        // Transfer tokens
        lendingToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposited(msg.sender, amount, sharesIssued);
    }

    /**
     * @notice Withdraw USDC from the pool by burning shares
     * @param shareAmount Number of shares to burn
     * @return amountWithdrawn Amount of USDC withdrawn
     */
    function withdraw(uint256 shareAmount) external nonReentrant returns (uint256 amountWithdrawn) {
        if (shareAmount == 0) revert InvalidAmount();
        if (shares[msg.sender] < shareAmount) revert InvalidAmount();

        // Calculate withdrawal amount
        uint256 poolValue = totalDeposits + totalBorrowed;
        amountWithdrawn = (shareAmount * poolValue) / totalShares;

        // Check liquidity
        if (lendingToken.balanceOf(address(this)) < amountWithdrawn) {
            revert InsufficientLiquidity();
        }

        // Update state
        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        totalDeposits -= amountWithdrawn;

        // Transfer tokens
        lendingToken.safeTransfer(msg.sender, amountWithdrawn);

        emit Withdrawn(msg.sender, amountWithdrawn, shareAmount);
    }

    // ============ BORROWER FUNCTIONS ============

    /**
     * @notice Borrow USDC against collateral
     * @param amount Amount to borrow (6 decimals - USDC)
     * @param collateralValueUSD Total collateral value locked locally (6 decimals)
     */
    function borrow(uint256 amount, uint256 collateralValueUSD) external nonReentrant {
        if (amount < minLoanSize) revert LoanTooSmall();
        if (loans[msg.sender].isActive) revert LoanAlreadyActive();

        // Check liquidity
        if (lendingToken.balanceOf(address(this)) < amount) {
            revert InsufficientLiquidity();
        }

        // Get total collateral (local + cross-chain)
        uint256 totalCollateral = collateralValueUSD;
        if (address(coordinator) != address(0)) {
            totalCollateral += coordinator.getTotalCollateral(msg.sender);
        }

        // Validate using LTV
        uint256 ltvBPS = creditScore.getLTV(msg.sender);
        uint256 maxByLTV = (totalCollateral * ltvBPS) / BPS_DENOMINATOR;
        if (amount > maxByLTV) revert InsufficientCollateral();

        // Validate fee-based limits (prevents "score and run")
        (uint256 maxBorrow, , ) = feeBasedLimits.calculateMaxBorrow(
            msg.sender,
            totalCollateral
        );
        if (amount > maxBorrow) revert ExceedsBorrowLimit();

        // Calculate interest rate
        uint256 interestRate = _calculateInterestRate();

        // Create loan
        loans[msg.sender] = Loan({
            principal: amount,
            interestRate: interestRate,
            lastAccrualTimestamp: block.timestamp,
            accruedInterest: 0,
            collateralValueUSD: totalCollateral,
            dueDate: block.timestamp + LOAN_DURATION,
            isActive: true
        });

        // Update pool state
        totalBorrowed += amount;
        totalDeposits -= amount;

        // Record loan in credit score
        creditScore.recordLoanTaken(msg.sender);

        // Transfer USDC to borrower
        lendingToken.safeTransfer(msg.sender, amount);

        emit Borrowed(msg.sender, amount, totalCollateral);
    }

    /**
     * @notice Repay loan with interest
     * @param amount Amount to repay (6 decimals)
     */
    function repay(uint256 amount) external nonReentrant {
        Loan storage loan = loans[msg.sender];
        if (!loan.isActive) revert NoActiveLoan();

        // Accrue interest first
        _accrueInterest(msg.sender);

        // Check if repayment is on time for credit score
        bool onTime = block.timestamp <= loan.dueDate;

        // Calculate total debt
        uint256 totalDebt = loan.principal + loan.accruedInterest;
        uint256 repayAmount = amount > totalDebt ? totalDebt : amount;

        // Calculate how much goes to interest vs principal
        uint256 interestPaid = repayAmount > loan.accruedInterest
            ? loan.accruedInterest
            : repayAmount;
        uint256 principalPaid = repayAmount - interestPaid;

        // Update loan
        loan.accruedInterest -= interestPaid;
        loan.principal -= principalPaid;

        // If fully repaid, close loan
        if (loan.principal == 0) {
            loan.isActive = false;
        }

        // Split interest: 90% to lenders, 10% to protocol
        uint256 protocolFee = 0;
        uint256 lenderInterest = interestPaid;

        if (interestPaid > 0 && feeCollector != address(0)) {
            protocolFee = (interestPaid * protocolFeeBPS) / BPS_DENOMINATOR;
            lenderInterest = interestPaid - protocolFee;
        }

        // Update pool state
        totalBorrowed -= principalPaid;
        totalDeposits += principalPaid + lenderInterest; // Only lender portion goes to pool

        // Record GROSS interest payment in credit score (for credit building)
        if (interestPaid > 0) {
            creditScore.recordRepayment(msg.sender, interestPaid, onTime);
        }

        // Transfer tokens from borrower
        lendingToken.safeTransferFrom(msg.sender, address(this), repayAmount);

        // Transfer protocol fee to collector
        if (protocolFee > 0) {
            lendingToken.safeTransfer(feeCollector, protocolFee);
        }

        emit Repaid(msg.sender, principalPaid, interestPaid);
    }

    // ============ INTERNAL FUNCTIONS ============

    /**
     * @notice Accrue interest for a borrower
     * @param borrower Address of the borrower
     */
    function _accrueInterest(address borrower) internal {
        Loan storage loan = loans[borrower];
        if (!loan.isActive) return;

        uint256 timeElapsed = block.timestamp - loan.lastAccrualTimestamp;
        if (timeElapsed == 0) return;

        // Calculate interest: (principal × rate × time) / (BPS × year)
        uint256 interest = (loan.principal * loan.interestRate * timeElapsed) /
            (BPS_DENOMINATOR * SECONDS_PER_YEAR);

        loan.accruedInterest += interest;
        loan.lastAccrualTimestamp = block.timestamp;

        emit InterestAccrued(borrower, interest);
    }

    /**
     * @notice Calculate current interest rate based on utilization
     * @return rateBPS Interest rate in basis points
     */
    function _calculateInterestRate() internal view returns (uint256 rateBPS) {
        uint256 totalPool = totalDeposits + totalBorrowed;
        if (totalPool == 0) return baseRateBPS;

        uint256 utilization = (totalBorrowed * BPS_DENOMINATOR) / totalPool;
        rateBPS = baseRateBPS + ((utilization * utilizationMultiplierBPS) / BPS_DENOMINATOR);
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get total debt for a borrower (principal + accrued + pending interest)
     * @param borrower Address of the borrower
     * @return totalDebt Total debt amount (6 decimals)
     */
    function getTotalDebt(address borrower) external view returns (uint256 totalDebt) {
        Loan storage loan = loans[borrower];
        if (!loan.isActive) return 0;

        // Calculate pending interest
        uint256 timeElapsed = block.timestamp - loan.lastAccrualTimestamp;
        uint256 pendingInterest = (loan.principal * loan.interestRate * timeElapsed) /
            (BPS_DENOMINATOR * SECONDS_PER_YEAR);

        totalDebt = loan.principal + loan.accruedInterest + pendingInterest;
    }

    /**
     * @notice Calculate health factor for a borrower
     * @param borrower Address of the borrower
     * @return healthFactor Health factor in BPS (10000 = 100%, <10000 = liquidatable)
     *
     * Per spec: Liquidation Threshold = Collateral + (Total Interest Paid × 0.5)
     */
    function getHealthFactor(address borrower) public view returns (uint256 healthFactor) {
        Loan storage loan = loans[borrower];
        if (!loan.isActive) return type(uint256).max;

        // Calculate total debt
        uint256 timeElapsed = block.timestamp - loan.lastAccrualTimestamp;
        uint256 pendingInterest = (loan.principal * loan.interestRate * timeElapsed) /
            (BPS_DENOMINATOR * SECONDS_PER_YEAR);
        uint256 totalDebt = loan.principal + loan.accruedInterest + pendingInterest;

        if (totalDebt == 0) return type(uint256).max;

        // Get user's total interest paid (for buffer calculation)
        (ContinuousCreditScore.UserCredit memory credit, , ) = creditScore.getUserCreditProfile(borrower);

        // Calculate liquidation threshold: Collateral + (Interest Paid × 0.5)
        uint256 interestBuffer = (credit.totalInterestPaidUSD * 5000) / BPS_DENOMINATOR; // 50%
        uint256 baseThreshold = loan.collateralValueUSD + interestBuffer;

        // Apply 110% multiplier (liquidatable when health factor < 110%)
        uint256 liquidationThreshold = (baseThreshold * 11000) / BPS_DENOMINATOR;

        // Health Factor = (Liquidation Threshold / Total Debt) × 100%
        healthFactor = (liquidationThreshold * BPS_DENOMINATOR) / totalDebt;
    }

    /**
     * @notice Get share value in USDC
     * @param shareAmount Number of shares
     * @return value Value in USDC (6 decimals)
     */
    function getShareValue(uint256 shareAmount) external view returns (uint256 value) {
        if (totalShares == 0) return 0;
        uint256 poolValue = totalDeposits + totalBorrowed;
        value = (shareAmount * poolValue) / totalShares;
    }

    /**
     * @notice Get pool utilization rate
     * @return utilizationBPS Utilization in basis points (10000 = 100%)
     */
    function getUtilization() external view returns (uint256 utilizationBPS) {
        uint256 totalPool = totalDeposits + totalBorrowed;
        if (totalPool == 0) return 0;
        utilizationBPS = (totalBorrowed * BPS_DENOMINATOR) / totalPool;
    }

    // ============ LIQUIDATION FUNCTIONS ============

    /**
     * @notice Set authorized liquidation manager
     * @param _liquidationManager Address of LiquidationManager contract
     */
    function setLiquidationManager(address _liquidationManager) external onlyOwner {
        liquidationManager = _liquidationManager;
        emit LiquidationManagerSet(_liquidationManager);
    }

    /**
     * @notice Repay borrower's debt from liquidation proceeds
     * @param borrower Address of the borrower being liquidated
     * @param amount Amount of debt being repaid (USDC, 6 decimals)
     *
     * Only callable by authorized LiquidationManager
     */
    function repayFromLiquidation(address borrower, uint256 amount) external nonReentrant {
        if (msg.sender != liquidationManager) revert UnauthorizedLiquidation();

        Loan storage loan = loans[borrower];
        if (!loan.isActive) revert NoActiveLoan();

        // Accrue pending interest first
        _accrueInterest(borrower);

        uint256 totalDebt = loan.principal + loan.accruedInterest;
        if (amount > totalDebt) revert InvalidAmount();

        // Transfer USDC from liquidation manager
        lendingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Split payment: principal first, then interest
        uint256 principalPaid = amount > loan.principal ? loan.principal : amount;
        uint256 interestPaid = amount - principalPaid;

        // Update loan state
        loan.principal -= principalPaid;
        loan.accruedInterest -= interestPaid;

        // Update pool state
        totalBorrowed -= principalPaid;
        totalDeposits += principalPaid + interestPaid;

        // Close loan if fully repaid
        if (loan.principal == 0 && loan.accruedInterest == 0) {
            loan.isActive = false;
        }

        emit LiquidationRepaid(borrower, amount);
    }

    /**
     * @notice Add surplus USDC from liquidation to protocol reserves
     * @param amount Amount to add to reserves (USDC, 6 decimals)
     *
     * Only callable by authorized LiquidationManager
     */
    function addToReserves(uint256 amount) external nonReentrant {
        if (msg.sender != liquidationManager) revert UnauthorizedLiquidation();

        // Transfer USDC from liquidation manager
        lendingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Add to reserves
        reserves += amount;
        totalDeposits += amount;

        emit ReservesAdded(amount);
    }
}