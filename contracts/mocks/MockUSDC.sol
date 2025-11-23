// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token for testing purposes
 * @dev Can be minted freely for testing. DO NOT USE IN PRODUCTION!
 *
 * Features:
 * - 6 decimals (matches real USDC)
 * - Free minting for testing
 * - Same interface as real USDC
 * - Can be used with ProtocolCore for local testing
 *
 * Usage:
 * 1. Deploy MockUSDC
 * 2. Mint tokens to test accounts: mockUSDC.mint(user, 1000e6)
 * 3. Use in ProtocolCore constructor as lendingToken
 * 4. Test all lending/borrowing flows without real USDC
 */
contract MockUSDC is ERC20, Ownable {
    /// @notice Decimals (6, matching real USDC)
    uint8 public constant DECIMALS = 6;

    /**
     * @notice Constructor
     * @param _name Token name (e.g., "Mock USDC")
     * @param _symbol Token symbol (e.g., "mUSDC")
     */
    constructor(
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) Ownable() {}

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
     * @notice Mint tokens (only owner)
     * @param to Address to mint tokens to
     * @param amount Amount to mint (6 decimals)
     */
    function mintOwner(address to, uint256 amount) external onlyOwner {
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
     * @notice Burn tokens from specified address (only owner)
     * @param from Address to burn tokens from
     * @param amount Amount to burn (6 decimals)
     */
    function burnFrom(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    /**
     * @notice Mint tokens to multiple addresses at once (for testing)
     * @param recipients Array of addresses to mint to
     * @param amounts Array of amounts to mint (must match recipients length)
     */
    function mintBatch(address[] calldata recipients, uint256[] calldata amounts) external {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }
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

