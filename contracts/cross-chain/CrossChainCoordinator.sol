// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OApp, Origin, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";

/**
 * @title CrossChainCoordinator
 * @notice Receives collateral messages from all chains and coordinates with LendingPool
 * @dev Deployed ONLY on Base (core protocol chain)
 *
 * Architecture:
 * - CollateralVault on Chain A sends "user deposited $1000 ETH"
 * - CrossChainCoordinator receives message on Base
 * - Updates user's collateral credit in mapping
 * - LendingPool queries this contract to validate borrowing capacity
 *
 * This enables true cross-chain lending:
 * - Deposit ETH on Ethereum
 * - Borrow USDC on Base
 * - All coordinated via LayerZero V2 messaging
 */
contract CrossChainCoordinator is OApp {
    using OptionsBuilder for bytes;
    // User collateral credits (aggregated from all chains)
    // user => total collateral value in USD (6 decimals - USDC standard)
    mapping(address => uint256) public userCollateralUSD;

    // Track collateral by source chain
    // user => chainEid => valueUSD (6 decimals - USDC standard)
    mapping(address => mapping(uint32 => uint256)) public collateralByChain;

    // Authorized vault addresses per chain
    // chainEid => vault address
    mapping(uint32 => address) public authorizedVaults;

    // Authorized contracts that can trigger unlock messages (e.g., LendingPool)
    mapping(address => bool) public authorizedSenders;

    // LendingPool contract (for integration)
    address public lendingPool;

    // Events
    event CollateralUpdated(
        address indexed user,
        uint32 indexed sourceEid,
        uint256 valueUSD,
        bool isDeposit,
        uint256 newTotalCollateral
    );
    event UnlockMessageSent(
        address indexed user,
        uint32 indexed destinationEid,
        address indexed asset,
        uint256 amount
    );
    event VaultAuthorized(uint32 indexed eid, address vaultAddress);
    event VaultRevoked(uint32 indexed eid);
    event LendingPoolUpdated(address oldPool, address newPool);
    event SenderAuthorized(address indexed sender, bool authorized);

    // Errors
    error UnauthorizedVault(uint32 eid, address sender);
    error UnauthorizedSender();
    error InvalidVaultAddress();
    error InvalidLendingPool();

    /**
     * @notice Constructor
     * @param _endpoint LayerZero V2 endpoint on Base
     * @param _delegate Owner/delegate address
     */
    constructor(
        address _endpoint,
        address _delegate
    ) OApp(_endpoint, _delegate) {}

    modifier onlyAuthorizedSender() {
        if (!authorizedSenders[msg.sender]) revert UnauthorizedSender();
        _;
    }

    /**
     * @notice Authorize a contract to send unlock messages
     * @param sender Address to authorize (typically LendingPool)
     * @param authorized True to authorize, false to revoke
     */
    function setAuthorizedSender(address sender, bool authorized) external onlyOwner {
        authorizedSenders[sender] = authorized;
        emit SenderAuthorized(sender, authorized);
    }

    /**
     * @notice Authorize a vault contract on a specific chain
     * @param eid Endpoint ID of the source chain
     * @param vaultAddress Address of the CollateralVault on that chain
     */
    function authorizeVault(uint32 eid, address vaultAddress) external onlyOwner {
        if (vaultAddress == address(0)) revert InvalidVaultAddress();
        authorizedVaults[eid] = vaultAddress;
        emit VaultAuthorized(eid, vaultAddress);
    }

    /**
     * @notice Revoke vault authorization
     * @param eid Endpoint ID to revoke
     */
    function revokeVault(uint32 eid) external onlyOwner {
        delete authorizedVaults[eid];
        emit VaultRevoked(eid);
    }

    /**
     * @notice Set the lending pool contract
     * @param _lendingPool LendingPool address
     */
    function setLendingPool(address _lendingPool) external onlyOwner {
        if (_lendingPool == address(0)) revert InvalidLendingPool();
        address oldPool = lendingPool;
        lendingPool = _lendingPool;
        emit LendingPoolUpdated(oldPool, _lendingPool);
    }

    /**
     * @notice Receive collateral update messages from vaults
     * @param _origin Origin information (source chain EID and sender)
     * @param _message Encoded message payload
     * @dev This allows coordinator on Base to approve collateral withdrawals
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /* _guid */,
        bytes calldata _message,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) internal override {
        // Verify sender is authorized vault
        bytes32 sender = _origin.sender;
        address senderAddress = address(uint160(uint256(sender)));

        if (authorizedVaults[_origin.srcEid] != senderAddress) {
            revert UnauthorizedVault(_origin.srcEid, senderAddress);
        }

        // Decode message
        (address user, uint256 valueUSD, bool isDeposit) = abi.decode(
            _message,
            (address, uint256, bool)
        );

        // Update collateral tracking
        if (isDeposit) {
            userCollateralUSD[user] += valueUSD;
            collateralByChain[user][_origin.srcEid] += valueUSD;
        } else {
            userCollateralUSD[user] -= valueUSD;
            collateralByChain[user][_origin.srcEid] -= valueUSD;
        }

        emit CollateralUpdated(
            user,
            _origin.srcEid,
            valueUSD,
            isDeposit,
            userCollateralUSD[user]
        );

        // Note: LendingPool will query userCollateralUSD when user borrows
    }

    /**
     * @notice Get user's total collateral across all chains
     * @param user User address
     * @return totalValueUSD Total collateral in USD (6 decimals - USDC standard)
     */
    function getTotalCollateral(address user) external view returns (uint256 totalValueUSD) {
        totalValueUSD = userCollateralUSD[user];
    }

    /**
     * @notice Get user's collateral on a specific chain
     * @param user User address
     * @param eid Chain endpoint ID
     * @return valueUSD Collateral value in USD (6 decimals - USDC standard)
     */
    function getCollateralByChain(address user, uint32 eid)
        external
        view
        returns (uint256 valueUSD)
    {
        valueUSD = collateralByChain[user][eid];
    }

    /**
     * @notice Check if a vault is authorized
     * @param eid Chain endpoint ID
     * @return authorized True if vault is authorized
     * @return vaultAddress Address of the authorized vault
     */
    function isVaultAuthorized(uint32 eid)
        external
        view
        returns (bool authorized, address vaultAddress)
    {
        vaultAddress = authorizedVaults[eid];
        authorized = vaultAddress != address(0);
    }

    /**
     * @notice Called by LendingPool to send withdrawal approval after loan repayment
     * @param user The user who repaid the loan
     * @param destinationEid The chain where the collateral is held
     * @param asset The address of the collateral asset
     * @param amount The amount of collateral to unlock
     */
    function sendUnlockMessage(
        address user,
        uint32 destinationEid,
        address asset,
        uint256 amount
    ) external onlyAuthorizedSender {
        // Message type 2 for withdrawal approval
        bytes memory payload = abi.encode(uint8(2), user, asset, amount);

        // Build LayerZero options (200k gas for lzReceive on destination)
        bytes memory options = OptionsBuilder.newOptions();
        options.addExecutorLzReceiveOption(200000, 0);

        // Quote and send message (caller must provide fee)
        MessagingFee memory fee = _quote(destinationEid, payload, options, false);
        _lzSend(destinationEid, payload, options, fee, payable(msg.sender));

        emit UnlockMessageSent(user, destinationEid, asset, amount);
    }
}