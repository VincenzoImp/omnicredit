// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OApp, Origin, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {OFT} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import {SendParam} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";

/**
 * @title LenderVault
 * @notice Vault per lenders su ogni chain - deposita MockUSDC locale e invia a ProtocolCore su Arbitrum
 * @dev Deployed su Sepolia, Optimism Sepolia, etc. - ogni chain ha il suo MockUSDC locale
 *
 * Flow:
 * 1. Lender deposita MockUSDC locale su questa chain
 * 2. Vault bridge MockUSDC a Arbitrum Sepolia via OFT
 * 3. Vault invia messaggio OApp a ProtocolCore su Arbitrum
 * 4. ProtocolCore processa il deposito e assegna shares
 *
 * Ogni chain ha il suo MockUSDC locale, ma tutti i depositi vanno al ProtocolCore su Arbitrum
 */
contract LenderVault is OApp, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using OptionsBuilder for bytes;

    /// @notice MockUSDC locale di questa chain
    IERC20 public immutable localUSDC;

    /// @notice MockOFT per bridge cross-chain (deve essere configurato per questa chain)
    OFT public usdcOFT;

    /// @notice ProtocolCore su Arbitrum Sepolia
    bytes32 public protocolCorePeer;
    uint32 public arbitrumEid;

    /// @notice Gas limits configurabili
    uint128 public oftExecutorGasLimit = 200000;
    uint128 public lzReceiveGasLimit = 300000;

    /// @notice Rate limiting
    uint256 public constant MIN_DEPOSIT_INTERVAL = 1 minutes;
    mapping(address => uint256) public lastDepositTime;

    /// @notice Pending deposits tracking
    struct PendingDeposit {
        address lender;
        uint256 amount;
        uint256 timestamp;
        bool processed;
    }
    mapping(bytes32 => PendingDeposit) public pendingDeposits;
    uint256 public constant DEPOSIT_TIMEOUT = 1 hours;

    // Events
    event DepositInitiated(
        address indexed lender,
        uint256 amount,
        bytes32 guid,
        uint32 srcEid
    );
    event DepositConfirmed(bytes32 indexed guid, bool success);
    event DepositRefunded(bytes32 indexed guid, address indexed lender, uint256 amount);
    event ProtocolCoreSet(bytes32 peer, uint32 eid);
    event USDCOTFSet(address indexed usdcOFT);
    event GasLimitsUpdated(uint128 oftLimit, uint128 lzLimit);

    // Errors
    error InvalidAmount();
    error ProtocolCoreNotSet();
    error USDCOTFNotSet();
    error RateLimited();
    error DepositNotFound();
    error DepositAlreadyProcessed();
    error DepositNotTimedOut();

    constructor(
        address _localUSDC,
        address _lzEndpoint,
        address _delegate
    ) OApp(_lzEndpoint, _delegate) {
        if (_localUSDC == address(0)) revert InvalidAmount();
        localUSDC = IERC20(_localUSDC);
    }

    /**
     * @notice Set ProtocolCore peer on Arbitrum Sepolia
     * @param _peer ProtocolCore address as bytes32
     * @param _eid Arbitrum Sepolia endpoint ID
     */
    function setProtocolCore(bytes32 _peer, uint32 _eid) external onlyOwner {
        protocolCorePeer = _peer;
        arbitrumEid = _eid;
        emit ProtocolCoreSet(_peer, _eid);
    }

    /**
     * @notice Set MockOFT for cross-chain bridging
     * @param _usdcOFT Address of MockOFT on this chain
     */
    function setUSDCOTF(address _usdcOFT) external onlyOwner {
        if (_usdcOFT == address(0)) revert InvalidAmount();
        usdcOFT = OFT(_usdcOFT);
        emit USDCOTFSet(_usdcOFT);
    }

    /**
     * @notice Set gas limits
     */
    function setGasLimits(uint128 _oftLimit, uint128 _lzLimit) external onlyOwner {
        oftExecutorGasLimit = _oftLimit;
        lzReceiveGasLimit = _lzLimit;
        emit GasLimitsUpdated(_oftLimit, _lzLimit);
    }

    /**
     * @notice Deposit MockUSDC locale e invia a ProtocolCore su Arbitrum
     * @param amount Amount of MockUSDC to deposit (6 decimals)
     * @param minAmountLD Minimum amount to receive on Arbitrum (slippage protection)
     * @return guid Unique identifier for this deposit
     */
    function deposit(uint256 amount, uint256 minAmountLD) external payable nonReentrant returns (bytes32 guid) {
        if (amount == 0) revert InvalidAmount();
        if (protocolCorePeer == bytes32(0)) revert ProtocolCoreNotSet();
        if (address(usdcOFT) == address(0)) revert USDCOTFNotSet();

        // Rate limiting
        if (block.timestamp < lastDepositTime[msg.sender] + MIN_DEPOSIT_INTERVAL) {
            revert RateLimited();
        }
        lastDepositTime[msg.sender] = block.timestamp;

        // Transfer MockUSDC locale da lender
        localUSDC.safeTransferFrom(msg.sender, address(this), amount);

        // Approve OFT
        localUSDC.safeApprove(address(usdcOFT), amount);

        // Bridge MockUSDC a Arbitrum via OFT
        bytes memory oftOptions = OptionsBuilder.newOptions();
        oftOptions.addExecutorLzReceiveOption(oftExecutorGasLimit, 0);
        
        SendParam memory sendParam = SendParam({
            dstEid: arbitrumEid,
            to: protocolCorePeer, // Send directly to ProtocolCore
            amountLD: amount,
            minAmountLD: minAmountLD,
            extraOptions: oftOptions,
            composeMsg: "",
            oftCmd: ""
        });

        // Quote OFT fee
        MessagingFee memory oftFee = usdcOFT.quoteSend(sendParam, false);

        // Bridge USDC
        usdcOFT.send{value: oftFee.nativeFee}(sendParam, oftFee, payable(msg.sender));

        // Generate GUID for OApp message
        guid = keccak256(abi.encodePacked(msg.sender, amount, block.timestamp, block.number));

        // Store pending deposit
        pendingDeposits[guid] = PendingDeposit({
            lender: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            processed: false
        });

        // Send OApp message to ProtocolCore
        bytes memory payload = abi.encode(uint8(1), msg.sender, amount, guid); // Type 1 = DEPOSIT

        bytes memory oappOptions = OptionsBuilder.newOptions();
        oappOptions.addExecutorLzReceiveOption(lzReceiveGasLimit, 0);
        MessagingFee memory oappFee = _quote(arbitrumEid, payload, oappOptions, false);
        oappFee.nativeFee = (oappFee.nativeFee * 12000) / 10000; // 20% buffer

        _lzSend(arbitrumEid, payload, oappOptions, oappFee, payable(msg.sender));

        emit DepositInitiated(msg.sender, amount, guid, arbitrumEid);
    }

    /**
     * @notice Receive confirmation from ProtocolCore
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 _guid,
        bytes calldata _message,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) internal override {
        // Only accept messages from ProtocolCore on Arbitrum
        if (_origin.srcEid != arbitrumEid || _origin.sender != protocolCorePeer) {
            return; // Ignore unauthorized messages
        }

        (uint8 messageType, bytes32 guid, bool success) = abi.decode(_message, (uint8, bytes32, bool));
        
        if (messageType != 2) return; // Type 2 = DEPOSIT_CONFIRMATION

        PendingDeposit storage deposit = pendingDeposits[guid];
        if (deposit.lender == address(0)) return; // Deposit not found

        if (success) {
            deposit.processed = true;
            emit DepositConfirmed(guid, true);
        } else {
            // Refund on failure
            deposit.processed = true;
            localUSDC.safeTransfer(deposit.lender, deposit.amount);
            emit DepositRefunded(guid, deposit.lender, deposit.amount);
        }
    }

    /**
     * @notice Manual refund after timeout
     */
    function checkAndRefund(bytes32 guid) external {
        PendingDeposit storage deposit = pendingDeposits[guid];
        if (deposit.lender == address(0)) revert DepositNotFound();
        if (deposit.processed) revert DepositAlreadyProcessed();
        if (block.timestamp <= deposit.timestamp + DEPOSIT_TIMEOUT) revert DepositNotTimedOut();

        deposit.processed = true;
        localUSDC.safeTransfer(deposit.lender, deposit.amount);
        emit DepositRefunded(guid, deposit.lender, deposit.amount);
    }

    /**
     * @notice Quote deposit fee
     */
    function quoteDeposit(uint256 amount) external view returns (MessagingFee memory totalFee) {
        if (protocolCorePeer == bytes32(0) || address(usdcOFT) == address(0)) {
            return MessagingFee(0, 0);
        }

        // OFT fee
        bytes memory oftOptions = OptionsBuilder.newOptions();
        oftOptions.addExecutorLzReceiveOption(oftExecutorGasLimit, 0);
        SendParam memory sendParam = SendParam({
            dstEid: arbitrumEid,
            to: protocolCorePeer,
            amountLD: amount,
            minAmountLD: 0,
            extraOptions: oftOptions,
            composeMsg: "",
            oftCmd: ""
        });
        MessagingFee memory oftFee = usdcOFT.quoteSend(sendParam, false);

        // OApp fee
        bytes memory payload = abi.encode(uint8(1), msg.sender, amount, bytes32(0));
        bytes memory oappOptions = OptionsBuilder.newOptions();
        oappOptions.addExecutorLzReceiveOption(lzReceiveGasLimit, 0);
        MessagingFee memory oappFee = _quote(arbitrumEid, payload, oappOptions, false);
        oappFee.nativeFee = (oappFee.nativeFee * 12000) / 10000; // 20% buffer

        totalFee = MessagingFee(
            oftFee.nativeFee + oappFee.nativeFee,
            oftFee.lzTokenFee + oappFee.lzTokenFee
        );
    }
}

