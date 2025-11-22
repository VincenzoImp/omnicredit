import hre from "hardhat";

/**
 * @file deploy-liquidation-hook.ts
 * @notice Deploys LiquidationHook using CREATE2 to ensure correct address with hook flags
 * @dev Uniswap V4 requires hooks to be deployed at addresses with specific permission bits
 * 
 * NOTE: This script uses Hardhat, but CREATE2 deployment with specific addresses
 * is complex. For production, consider using Foundry which has better CREATE2 support.
 * 
 * This script will:
 * 1. Find a salt that produces an address with correct hook flags
 * 2. Deploy using the CREATE2 deployer contract
 */

// CREATE2 Deployer Proxy address (standard for deterministic deployments)
const CREATE2_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";

// Hook flags for LiquidationHook: beforeSwap and afterSwap
const BEFORE_SWAP_FLAG = BigInt(1) << BigInt(7);
const AFTER_SWAP_FLAG = BigInt(1) << BigInt(6);
const FLAGS = BEFORE_SWAP_FLAG | AFTER_SWAP_FLAG;
const FLAG_MASK = BigInt((1 << 14) - 1); // Bottom 14 bits

/**
 * Compute CREATE2 address
 * @param ethers Ethers instance from connection
 */
function computeAddress(
    ethers: any,
    deployer: string,
    salt: bigint,
    bytecodeHash: string
): string {
    // Use ethers utilities
    const encoded = ethers.solidityPackedKeccak256(
        ["bytes1", "address", "uint256", "bytes32"],
        ["0xff", deployer, salt, bytecodeHash]
    );
    return ethers.getAddress("0x" + encoded.slice(-40));
}

/**
 * Find salt that produces address with correct flags
 */
async function findSalt(
    ethers: any,
    deployer: string,
    bytecodeHash: string,
    maxIterations: number = 160444
): Promise<{ address: string; salt: bigint } | null> {
    for (let i = 0; i < maxIterations; i++) {
        const salt = BigInt(i);
        const address = computeAddress(ethers, deployer, salt, bytecodeHash);
        const addressBigInt = BigInt(address);
        const addressFlags = addressBigInt & FLAG_MASK;

        if (addressFlags === FLAGS) {
            // Check if address has no code (not already deployed)
            const code = await ethers.provider.getCode(address);
            if (code === "0x") {
                return { address, salt };
            }
        }
    }
    return null;
}

async function main() {
    console.log("\n" + "=".repeat(60));
    console.log("🔧 Deploying LiquidationHook with Hardhat (CREATE2)");
    console.log("=".repeat(60) + "\n");

    const connection = await hre.network.connect();

    // Access ethers from connection
    if (!connection.ethers) {
        throw new Error("ethers not available. Make sure @nomicfoundation/hardhat-ethers is installed.");
    }

    const ethers = connection.ethers;
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    // Get PoolManager address from environment or use default
    const poolManagerAddress =
        process.env.POOL_MANAGER || "0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408";
    console.log("PoolManager:", poolManagerAddress);

    // Get LiquidationHook factory
    const LiquidationHookFactory = await ethers.getContractFactory(
        "LiquidationHook"
    );

    // Get creation code and compute hash
    const creationCode = LiquidationHookFactory.bytecode;
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const constructorArgs = abiCoder.encode(
        ["address"],
        [poolManagerAddress]
    );
    const bytecode = creationCode + constructorArgs.slice(2);
    const bytecodeHash = ethers.keccak256(bytecode);

    console.log("\n🔍 Mining hook address with correct flags...");
    const result = await findSalt(ethers, CREATE2_DEPLOYER, bytecodeHash);

    if (!result) {
        throw new Error("Could not find salt that produces address with correct flags");
    }

    console.log("✅ Found valid address!");
    console.log("   Target address:", result.address);
    console.log("   Salt:", result.salt.toString());

    // Check if already deployed
    const code = await ethers.provider.getCode(result.address);
    if (code !== "0x") {
        console.log("⚠️  Contract already deployed at:", result.address);
        return result.address;
    }

    // Deploy using CREATE2 via the standard CREATE2 deployer
    console.log("\n📦 Deploying LiquidationHook using CREATE2...");

    // Use the standard CREATE2 deployer (0x4e59b44847b379578588920cA78FbF26c0B4956C)
    // This deployer is already deployed on most chains
    const CREATE2_DEPLOYER_ABI = [
        "function deploy(bytes32 salt, bytes memory bytecode) external returns (address deployed)"
    ];

    const create2Deployer = await ethers.getContractAt(
        CREATE2_DEPLOYER_ABI,
        CREATE2_DEPLOYER,
        deployer
    );

    try {
        // Convert salt to bytes32
        const saltBytes32 = ethers.zeroPadValue(
            ethers.toBeHex(result.salt, 32),
            32
        );

        const tx = await create2Deployer.deploy(saltBytes32, bytecode);
        const receipt = await tx.wait();

        if (!receipt) {
            throw new Error("Transaction receipt not found");
        }

        // Verify deployment
        const deployedCode = await ethers.provider.getCode(result.address);
        if (deployedCode === "0x") {
            throw new Error("Deployment failed - no code at target address");
        }

        console.log("✅ LiquidationHook deployed successfully!");
        return result.address;
    } catch (error: any) {
        console.error("❌ CREATE2 deployment failed:", error.message);
        console.log("📋 Note: CREATE2 deployment via Hardhat is complex");
        console.log("📋 Consider using Foundry script for CREATE2 deployment");
        throw error;
    }
}

main()
    .then((address) => {
        console.log("\n✅ Deployment script completed");
        console.log("Hook address:", address);
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Deployment failed:", error);
        process.exit(1);
    });
