// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OFT} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";

/**
 * @title USDCOmnitoken
 * @notice Omnichain USDC token for all non-Ethereum chains
 * @dev Mints/burns wrapped USDC backed by locked USDC on Ethereum via OFTAdapter
 *
 * Token Properties:
 * - Name: "Omnichain USDC"
 * - Symbol: "omUSDC"
 * - Decimals: 6 (MUST match native USDC for OFT standard compatibility)
 *
 * CRITICAL: LayerZero OFT standard requires the same decimals on all chains!
 * Since native USDC uses 6 decimals, omUSDC must also use 6 decimals.
 *
 * Deployment:
 * - Deploy on Base, Arbitrum, Optimism, and any other target chains
 * - Configure LayerZero peers to connect with USDCOFTAdapter on Ethereum
 * - Users can bridge USDC from Ethereum to any chain seamlessly
 *
 * Usage Flow:
 * 1. User deposits USDC on Ethereum → locked in OFTAdapter
 * 2. LayerZero message sent to target chain
 * 3. USDCOmnitoken mints equivalent omUSDC on target chain
 * 4. User can use omUSDC for lending/borrowing
 * 5. Reverse: Burn omUSDC → unlock USDC on Ethereum
 */
contract USDCOmnitoken is OFT {
    /**
     * @notice Constructor
     * @param _lzEndpoint LayerZero V2 endpoint address on this chain
     * @param _delegate Address that can configure LayerZero settings
     *
     * Chain-specific Endpoints (Testnets):
     * - Base Sepolia: 0x6EDCE65403992e310A62460808c4b910D972f10f
     * - Arbitrum Sepolia: 0x6EDCE65403992e310A62460808c4b910D972f10f
     * - Optimism Sepolia: 0x6EDCE65403992e310A62460808c4b910D972f10f
     */
    constructor(
        address _lzEndpoint,
        address _delegate
    ) OFT("Omnichain USDC", "omUSDC", _lzEndpoint, _delegate) {}

    /**
     * @notice Override decimals to match native USDC (6 decimals)
     * @return decimals Token decimals (6)
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}