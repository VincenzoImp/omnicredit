// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OApp, Origin, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IPriceOracle {
    function getAssetValueUSD(
        address asset,
        uint256 amount,
        uint256 assetDecimals
    ) external view returns (uint256 valueUSD);
}

/**
 * @title CollateralVault
 * @notice Locks collateral on source chains and sends messages to ProtocolCore on Arbitrum Sepolia
 * @dev Deployed on Sepolia, Optimism Sepolia - anywhere users want to deposit native tokens
 *
 * Cross-Chain Flow:
 * 1. User deposits native token (ETH, MATIC, etc.) into CollateralVault
 * 2. Vault locks collateral and sends LayerZero message to Arbitrum Sepolia
 * 3. ProtocolCore on Arbitrum receives message and updates borrower collateral
 * 4. User can borrow MockUSDC on any chain against their collateral
 * 5. To withdraw: User repays loan on Arbitrum → message sent to Vault → collateral unlocked
 */
contract CollateralVault is OApp, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using OptionsBuilder for bytes;

    // ProtocolCore endpoint ID (Arbitrum Sepolia)
    uint32 public protocolCoreEid;
    bytes32 public protocolCorePeer;

    // User collateral balances
    // user => asset => amount
    mapping(address => mapping(address => uint256)) public userCollateral;

    // Amount a user is approved to withdraw (unlocked by coordinator)
    // user => asset => amount
    mapping(address => mapping(address => uint256)) public withdrawalAllowance;

    // Total collateral locked per asset
    mapping(address => uint256) public totalCollateralLocked;

    // Decimals for each supported asset
    mapping(address => uint8) public assetDecimals;

    // Native token address (for ETH deposits)
    address public constant NATIVE_TOKEN = address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE);

    // Price oracle for valuing collateral
    IPriceOracle public priceOracle;

    // Events
    event CollateralDeposited(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 valueUSD
    );
    event CollateralWithdrawn(
        address indexed user,
        address indexed asset,
        uint256 amount
    );
    event WithdrawalApproved(address indexed user, address indexed asset, uint256 amount);
    event CollateralMessageSent(
        address indexed user,
        uint256 valueUSD,
        bytes32 guid
    );
    event ProtocolCoreUpdated(bytes32 peer, uint32 eid);
    event PriceOracleUpdated(address oldOracle, address newOracle);
    event AssetDecimalsSet(address indexed asset, uint8 decimals);

    // Errors
    error InvalidAmount();
    error InvalidAsset();
    error InsufficientCollateral();
    error InvalidProtocolCore();
    error InvalidPriceOracle();
    error DecimalsNotSet(address asset);

    /**
     * @notice Constructor
     * @param _endpoint LayerZero V2 endpoint on this chain
     * @param _delegate Owner/delegate address
     */
    constructor(
        address _endpoint,
        address _delegate
    ) OApp(_endpoint, _delegate) {}

    /**
     * @notice Set the price oracle address
     * @param _priceOracle Address of the price oracle contract
     */
    function setPriceOracle(address _priceOracle) external onlyOwner {
        if (_priceOracle == address(0)) revert InvalidPriceOracle();
        address oldOracle = address(priceOracle);
        priceOracle = IPriceOracle(_priceOracle);
        emit PriceOracleUpdated(oldOracle, _priceOracle);
    }

    /**
     * @notice Set ProtocolCore peer on Arbitrum Sepolia
     * @param _peer ProtocolCore address as bytes32
     * @param _eid Arbitrum Sepolia endpoint ID
     */
    function setProtocolCore(bytes32 _peer, uint32 _eid) external onlyOwner {
        if (_peer == bytes32(0) || _eid == 0) revert InvalidProtocolCore();
        protocolCorePeer = _peer;
        protocolCoreEid = _eid;
        emit ProtocolCoreUpdated(_peer, _eid);
    }

    /**
     * @notice Set the decimals for a supported collateral asset
     * @param asset Address of the asset
     * @param decimals The asset's decimals (e.g., 18 for ETH, 18 for MATIC)
     */
    function setAssetDecimals(address asset, uint8 decimals) external onlyOwner {
        if (asset == address(0)) revert InvalidAsset();
        assetDecimals[asset] = decimals;
        emit AssetDecimalsSet(asset, decimals);
    }

    /**
     * @notice Deposit native ETH as collateral
     */
    function depositNative() external payable nonReentrant {
        if (msg.value == 0) revert InvalidAmount();
        
        uint8 decimals = assetDecimals[NATIVE_TOKEN];
        if (decimals == 0) revert DecimalsNotSet(NATIVE_TOKEN);

        // Calculate value with trusted oracle
        uint256 valueUSD18 = priceOracle.getAssetValueUSD(NATIVE_TOKEN, msg.value, decimals);
        // Convert to 6 decimals for coordinator
        uint256 valueUSD6 = valueUSD18 / 1e12;

        // Update balances
        userCollateral[msg.sender][NATIVE_TOKEN] += msg.value;
        totalCollateralLocked[NATIVE_TOKEN] += msg.value;

        emit CollateralDeposited(msg.sender, NATIVE_TOKEN, msg.value, valueUSD6);

        // Send cross-chain message to ProtocolCore on Arbitrum Sepolia
        _sendCollateralUpdate(msg.sender, NATIVE_TOKEN, msg.value, valueUSD6, true);
    }

    /**
     * @notice Deposit ERC20 token as collateral
     * @param asset Address of the ERC20 token
     * @param amount Amount to deposit
     */
    function depositToken(
        address asset,
        uint256 amount
    ) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (asset == address(0) || asset == NATIVE_TOKEN) revert InvalidAsset();

        uint8 decimals = assetDecimals[asset];
        if (decimals == 0) revert DecimalsNotSet(asset);

        // Calculate value with trusted oracle
        uint256 valueUSD18 = priceOracle.getAssetValueUSD(asset, amount, decimals);
        // Convert to 6 decimals for coordinator
        uint256 valueUSD6 = valueUSD18 / 1e12;

        // Transfer tokens from user
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        // Update balances
        userCollateral[msg.sender][asset] += amount;
        totalCollateralLocked[asset] += amount;

        emit CollateralDeposited(msg.sender, asset, amount, valueUSD6);

        // Send cross-chain message to ProtocolCore on Arbitrum Sepolia
        _sendCollateralUpdate(msg.sender, asset, amount, valueUSD6, true);
    }

    /**
     * @notice Withdraw collateral (requires approval from coordinator)
     * @param asset Address of the asset
     * @param amount Amount to withdraw
     */
    function withdraw(address asset, uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (userCollateral[msg.sender][asset] < amount) revert InsufficientCollateral();
        if (amount > withdrawalAllowance[msg.sender][asset]) revert InsufficientCollateral(); // Not approved

        // Update balances
        withdrawalAllowance[msg.sender][asset] -= amount;
        userCollateral[msg.sender][asset] -= amount;
        totalCollateralLocked[asset] -= amount;

        // Transfer assets
        if (asset == NATIVE_TOKEN) {
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(asset).safeTransfer(msg.sender, amount);
        }

        emit CollateralWithdrawn(msg.sender, asset, amount);
    }

    /**
     * @notice Receive messages from ProtocolCore (for withdrawal approvals)
     * @param _origin Origin information
     * @param _message Encoded message
     * @dev This allows ProtocolCore on Arbitrum to approve collateral withdrawals
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /* _guid */,
        bytes calldata _message,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) internal override {
        // Verify message is from ProtocolCore on Arbitrum
        require(_origin.srcEid == protocolCoreEid && _origin.sender == protocolCorePeer, "Invalid source");

        // Decode withdrawal approval message
        (uint8 messageType, address user, address asset, uint256 amount) = abi.decode(
            _message,
            (uint8, address, address, uint256)
        );

        // messageType 1 = collateral deposit confirmation (handled by ProtocolCore)
        // messageType 2 = withdrawal approval (after loan repaid)
        if (messageType == 2) {
            // Increase user's allowance for withdrawal
            withdrawalAllowance[user][asset] += amount;
            emit WithdrawalApproved(user, asset, amount);
        }
    }



    /**
     * @notice Get user's total collateral for an asset
     * @param user User address
     * @param asset Asset address
     * @return amount Collateral amount
     */
    function getUserCollateral(address user, address asset)
        external
        view
        returns (uint256 amount)
    {
        amount = userCollateral[user][asset];
    }

    /**
     * @notice Send collateral update message to ProtocolCore on Arbitrum Sepolia
     * @param user Address of the user
     * @param asset Address of the collateral asset
     * @param amount Amount of collateral
     * @param valueUSD USD value of the collateral change (6 decimals)
     * @param isDeposit True for deposit, false for withdrawal
     */
    function _sendCollateralUpdate(
        address user,
        address asset,
        uint256 amount,
        uint256 valueUSD,
        bool isDeposit
    ) internal {
        if (protocolCorePeer == bytes32(0) || protocolCoreEid == 0) revert InvalidProtocolCore();

        // Encode message payload: (messageType, user, asset, amount, valueUSD, isDeposit)
        // messageType = 3 for COLLATERAL_UPDATE
        bytes memory payload = abi.encode(uint8(3), user, asset, amount, valueUSD, isDeposit);

        // Build LayerZero options (200k gas for lzReceive on destination)
        bytes memory options = OptionsBuilder.newOptions();
        options.addExecutorLzReceiveOption(200000, 0);

        // Quote fee
        MessagingFee memory fee = _quote(protocolCoreEid, payload, options, false);

        // Send message (requires msg.value to cover fee)
        // In production, user should send extra ETH to cover LayerZero fees
        _lzSend(
            protocolCoreEid,
            payload,
            options,
            fee,
            payable(address(this)) // Refund to vault
        );

        emit CollateralMessageSent(user, valueUSD, bytes32(0));
    }

    /**
     * @notice Quote LayerZero fee for sending collateral update
     * @param user Address of the user
     * @param asset Address of the collateral asset
     * @param amount Amount of collateral
     * @param valueUSD USD value of the collateral change
     * @param isDeposit True for deposit, false for withdrawal
     * @return fee MessagingFee struct with nativeFee and lzTokenFee
     */
    function quoteCollateralUpdate(
        address user,
        address asset,
        uint256 amount,
        uint256 valueUSD,
        bool isDeposit
    ) external view returns (MessagingFee memory fee) {
        bytes memory payload = abi.encode(user, asset, amount, valueUSD, isDeposit);
        bytes memory options = OptionsBuilder.newOptions();
        options.addExecutorLzReceiveOption(200000, 0);
        fee = _quote(protocolCoreEid, payload, options, false);
    }

    /**
     * @notice Receive ETH for gas payments and deposits
     */
    receive() external payable {}
}