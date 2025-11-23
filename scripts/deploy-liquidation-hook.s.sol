// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "forge-std/Script.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {HookMiner} from "v4-periphery/src/utils/HookMiner.sol";
import {LiquidationHook} from "../contracts/hooks/LiquidationHook.sol";

/**
 * @title DeployLiquidationHook
 * @notice Deploys LiquidationHook using CREATE2 to ensure correct address with hook flags
 * @dev Uniswap V4 requires hooks to be deployed at addresses with specific permission bits
 */
contract DeployLiquidationHook is Script {
    // CREATE2 Deployer Proxy address (standard for deterministic deployments)
    address constant CREATE2_DEPLOYER = address(0x4e59b44847b379578588920cA78FbF26c0B4956C);

    function run() public returns (address hookAddress) {
        // Get PoolManager address from environment or use default
        address poolManagerAddress = vm.envOr("POOL_MANAGER", address(0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408));
        IPoolManager poolManager = IPoolManager(poolManagerAddress);

        console.log("Deploying LiquidationHook...");
        console.log("PoolManager:", address(poolManager));

        // LiquidationHook permissions: beforeSwap and afterSwap
        uint160 flags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
        );

        bytes memory constructorArgs = abi.encode(poolManager);
        bytes memory creationCode = type(LiquidationHook).creationCode;

        // Mine a salt that will produce a hook address with the correct flags
        console.log("Mining hook address with correct flags...");
        (address targetAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            flags,
            creationCode,
            constructorArgs
        );

        console.log("Target hook address:", targetAddress);
        console.log("Salt:", vm.toString(salt));

        // Deploy the hook using CREATE2
        vm.startBroadcast();
        LiquidationHook hook = new LiquidationHook{salt: salt}(poolManager);
        vm.stopBroadcast();

        require(address(hook) == targetAddress, "Hook address mismatch");

        console.log("LiquidationHook deployed at:", address(hook));
        console.log("\nDeployment successful!");
        console.log("Update ignition/parameters/arbitrumSepolia.json with:");
        console.log("  \"liquidationHook\": \"", address(hook), "\"");

        return address(hook);
    }
}
