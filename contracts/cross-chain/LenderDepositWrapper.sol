// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import {OApp, Origin, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {OFT} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import {SendParam} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

/**
 * @title LenderDepositWrapper
 * @notice Allows lenders to deposit USDC from any chain to ProtocolCore on Base
 * @dev Deployed on all chains except Base. Handles cross-chain deposits via OFT + OApp messaging
 *
 * Flow:
 * 1. Lender calls depositCrossChain(amount) on their chain
 * 2. Wrapper takes USDC (native or omUSDC) and bridges it to Base via OFT
 * 3. Wrapper sends OApp message to ProtocolCore on Base with deposit details
 * 4. ProtocolCore receives message and processes deposit
 *
 * This enables true omnichain lending: deposit USDC on Arbitrum, earn yield on Base!
 */
contract LenderDepositWrapper is OApp, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using OptionsBuilder for bytes;

    /// @notice Base chain endpoint ID (where ProtocolCore lives)
    uint32 public immutable baseEid;

    /// @notice ProtocolCore contract address on Base
    bytes32 public protocolCorePeer;

    /// @notice USDC token on this chain (native USDC or omUSDC)
    IERC20 public immutable usdc;

    /// @notice OFT contract for bridging USDC to Base
    OFT public immutable usdcOFT;

    /// @notice Pending deposits tracking (for refunds if message fails)
    mapping(bytes32 => PendingDeposit) public pendingDeposits;

    struct PendingDeposit {
        address lender;
        uint256 amount;
        uint256 timestamp;
        bool processed;
    }

    // Events
    event CrossChainDepositInitiated(
        address indexed lender,
        uint256 amount,
        uint32 baseEid,
        bytes32 guid
    );
    event DepositConfirmed(bytes32 indexed guid, address indexed lender, uint256 amount);
    event DepositRefunded(bytes32 indexed guid, address indexed lender, uint256 amount);

    // Errors
    error InvalidAmount();
    error InvalidBaseEid();
    error ProtocolCoreNotSet();
    error DepositNotFound();
    error DepositAlreadyProcessed();
    error InsufficientUSDC();

    /**
     * @notice Constructor
     * @param _endpoint LayerZero V2 endpoint on this chain
     * @param _delegate Owner/delegate address
     * @param _baseEid Endpoint ID of Base chain (where ProtocolCore lives)
     * @param _usdc USDC token address on this chain
     * @param _usdcOFT OFT contract for bridging USDC
     */
    constructor(
        address _endpoint,
        address _delegate,
        uint32 _baseEid,
        address _usdc,
        address _usdcOFT
    ) OApp(_endpoint, _delegate) {
        if (_baseEid == 0) revert InvalidBaseEid();
        if (_usdc == address(0) || _usdcOFT == address(0)) revert InvalidAmount();

        baseEid = _baseEid;
        usdc = IERC20(_usdc);
        usdcOFT = OFT(_usdcOFT);
    }

    /**
     * @notice Set ProtocolCore peer address on Base
     * @param _protocolCore Address of ProtocolCore on Base (as bytes32)
     */
    function setProtocolCore(bytes32 _protocolCore) external onlyOwner {
        protocolCorePeer = _protocolCore;
    }

    /**
     * @notice Deposit USDC cross-chain to ProtocolCore on Base
     * @param amount Amount of USDC to deposit (6 decimals)
     * @param minAmountLD Minimum amount to receive on Base (for slippage protection)
     * @return guid Unique identifier for this deposit
     *
     * This function:
     * 1. Takes USDC from lender
     * 2. Bridges USDC to Base via OFT
     * 3. Sends OApp message to ProtocolCore to process deposit
     */
    function depositCrossChain(
        uint256 amount,
        uint256 minAmountLD
    ) external payable nonReentrant returns (bytes32 guid) {
        if (amount == 0) revert InvalidAmount();
        if (protocolCorePeer == bytes32(0)) revert ProtocolCoreNotSet();

        // Transfer USDC from lender
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Approve OFT to spend USDC
        usdc.safeApprove(address(usdcOFT), amount);

        // Bridge USDC to Base via OFT
        SendParam memory sendParam = SendParam({
            dstEid: baseEid,
            to: addressToBytes32(address(this)), // Send to this wrapper on Base
            amountLD: amount,
            minAmountLD: minAmountLD,
            extraOptions: OptionsBuilder.newOptions()
                .addExecutorLzReceiveOption(200000, 0)
                .toBytes(),
            composeMsg: "",
            oftCmd: ""
        });

        // Quote OFT fee
        MessagingFee memory oftFee = usdcOFT.quoteSend(sendParam, false);

        // Send USDC to Base (this will mint omUSDC on Base)
        usdcOFT.send{value: oftFee.nativeFee}(sendParam, oftFee, payable(msg.sender));

        // Generate unique GUID for this deposit
        guid = keccak256(abi.encodePacked(msg.sender, amount, block.timestamp, block.number));

        // Store pending deposit
        pendingDeposits[guid] = PendingDeposit({
            lender: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            processed: false
        });

        // Send OApp message to ProtocolCore on Base
        bytes memory payload = abi.encode(
            uint8(1), // Message type: DEPOSIT
            msg.sender, // Lender address
            amount, // Deposit amount
            guid // Unique identifier
        );

        bytes memory options = OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(300000, 0) // Gas for ProtocolCore._lzReceive
            .toBytes();

        MessagingFee memory oappFee = _quote(baseEid, payload, options, false);

        // Send message (user must provide fee)
        _lzSend(
            baseEid,
            payload,
            options,
            oappFee,
            payable(msg.sender)
        );

        emit CrossChainDepositInitiated(msg.sender, amount, baseEid, guid);
    }

    /**
     * @notice Receive confirmation from ProtocolCore that deposit was processed
     * @param _origin Origin information
     * @param _message Encoded confirmation message
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /* _guid */,
        bytes calldata _message,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) internal override {
        // Verify message is from Base ProtocolCore
        require(_origin.srcEid == baseEid, "Invalid source");
        require(_origin.sender == protocolCorePeer, "Unauthorized sender");

        // Decode message
        (uint8 messageType, bytes32 guid, bool success) = abi.decode(
            _message,
            (uint8, bytes32, bool)
        );

        require(messageType == 2, "Invalid message type"); // Type 2 = DEPOSIT_CONFIRMATION

        PendingDeposit storage deposit = pendingDeposits[guid];
        if (deposit.lender == address(0)) revert DepositNotFound();
        if (deposit.processed) revert DepositAlreadyProcessed();

        deposit.processed = true;

        if (success) {
            emit DepositConfirmed(guid, deposit.lender, deposit.amount);
        } else {
            // Refund USDC to lender if deposit failed
            usdc.safeTransfer(deposit.lender, deposit.amount);
            emit DepositRefunded(guid, deposit.lender, deposit.amount);
        }
    }

    /**
     * @notice Quote total fee for cross-chain deposit
     * @param amount Amount of USDC to deposit
     * @param minAmountLD Minimum amount to receive on Base
     * @return oftFee Fee for OFT bridging
     * @return oappFee Fee for OApp messaging
     */
    function quoteDeposit(
        uint256 amount,
        uint256 minAmountLD
    ) external view returns (MessagingFee memory oftFee, MessagingFee memory oappFee) {
        SendParam memory sendParam = SendParam({
            dstEid: baseEid,
            to: addressToBytes32(address(this)),
            amountLD: amount,
            minAmountLD: minAmountLD,
            extraOptions: OptionsBuilder.newOptions()
                .addExecutorLzReceiveOption(200000, 0)
                .toBytes(),
            composeMsg: "",
            oftCmd: ""
        });

        oftFee = usdcOFT.quoteSend(sendParam, false);

        bytes memory payload = abi.encode(uint8(1), msg.sender, amount, bytes32(0));
        bytes memory options = OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(300000, 0)
            .toBytes();

        oappFee = _quote(baseEid, payload, options, false);
    }

    /**
     * @notice Convert address to bytes32 for LayerZero
     */
    function addressToBytes32(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    /**
     * @notice Receive ETH for gas payments
     */
    receive() external payable {}
}

