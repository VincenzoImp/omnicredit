// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OFT} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";

/**
 * @title MockOFT
 * @notice Mock OFT token for testing cross-chain functionality
 * @dev Can be minted freely for testing. DO NOT USE IN PRODUCTION!
 *
 * Features:
 * - 6 decimals (matching USDC)
 * - Free minting for testing
 * - Full OFT functionality for cross-chain testing
 * - Can be used instead of USDCOmnitoken for local testing
 *
 * Usage:
 * 1. Deploy MockOFT on each test chain
 * 2. Configure LayerZero peers
 * 3. Mint tokens for testing: mockOFT.mint(user, 1000e6)
 * 4. Use in ProtocolCore as usdcOFT
 * 5. Test cross-chain deposits/withdrawals
 *
 * Note: OFT already inherits from OApp which has Ownable, so we don't need to add it again
 */
contract MockOFT is OFT {
    /// @notice Decimals (6, matching USDC)
    uint8 public constant DECIMALS = 6;

    /**
     * @notice Constructor
     * @param _name Token name (e.g., "Mock Omnichain USDC")
     * @param _symbol Token symbol (e.g., "mUSDC")
     * @param _lzEndpoint LayerZero V2 endpoint address
     * @param _delegate Delegate address for LayerZero configuration
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _delegate
    ) OFT(_name, _symbol, _lzEndpoint, _delegate) {}

    /**
     * @notice Override decimals to return 6 (matching USDC)
     * @return Number of decimals (6)
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @notice Mint tokens to any address (for testing)
     * @param to Address to mint tokens to
     * @param amount Amount to mint (6 decimals)
     *
     * WARNING: This allows unlimited minting! Only use in test environments.
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /**
     * @notice Mint tokens (only owner - uses OApp owner)
     * @param to Address to mint tokens to
     * @param amount Amount to mint (6 decimals)
     */
    function mintOwner(address to, uint256 amount) external {
        require(msg.sender == owner(), "Only owner");
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from caller
     * @param amount Amount to burn (6 decimals)
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    /**
     * @notice Burn tokens from specified address (only owner - uses OApp owner)
     * @param from Address to burn tokens from
     * @param amount Amount to burn (6 decimals)
     */
    function burnFrom(address from, uint256 amount) external {
        require(msg.sender == owner(), "Only owner");
        _burn(from, amount);
    }

    /**
     * @notice Helper function to mint common test amounts
     * @param to Address to mint to
     * @param usdAmount Amount in USD (will be converted to 6 decimals)
     *
     * Examples:
     * - mintUSD(to, 1000) mints 1000e6 tokens (1000 USDC)
     * - mintUSD(to, 1) mints 1e6 tokens (1 USDC)
     */
    function mintUSD(address to, uint256 usdAmount) external {
        _mint(to, usdAmount * 10**DECIMALS);
    }
}

