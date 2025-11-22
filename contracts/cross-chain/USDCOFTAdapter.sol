// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OFTAdapter} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFTAdapter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title USDCOFTAdapter
 * @notice OFT Adapter for USDC on Ethereum - locks native USDC and enables omnichain transfers
 * @dev DEPLOY ONLY ONCE on Ethereum mainnet/testnet where native USDC exists
 *
 * Architecture:
 * - Ethereum (Sepolia): USDCOFTAdapter locks real USDC
 * - Other chains: USDCOmnitoken mints/burns wrapped omUSDC
 * - LayerZero V2 bridges between them with unified liquidity
 *
 * CRITICAL: This adapter should only be deployed ONCE per USDC token globally
 * Multiple adapters would fragment liquidity and break the OFT standard
 */
contract USDCOFTAdapter is OFTAdapter {
    /**
     * @notice Constructor
     * @param _token Address of native USDC token on this chain
     * @param _lzEndpoint LayerZero V2 endpoint address on this chain
     * @param _delegate Address that can configure LayerZero settings (typically owner)
     *
     * Sepolia Testnet Addresses:
     * - USDC: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 (Circle's testnet USDC)
     * - LZ Endpoint: 0x6EDCE65403992e310A62460808c4b910D972f10f
     */
    constructor(
        address _token,
        address _lzEndpoint,
        address _delegate
    ) OFTAdapter(_token, _lzEndpoint, _delegate) {}
}