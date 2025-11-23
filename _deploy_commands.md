1. Arbitrum Sepolia (Main Hub)
CONFIGURE_PEERS=true npx hardhat run scripts/deploy.ts --network arbitrumSepoliaAUTHORIZE_VAULTS=true npx hardhat run scripts/deploy.ts --network arbitrumSepolia
2. Base Sepolia (Satellite)
CONFIGURE_PEERS=true npx hardhat run scripts/deploy.ts --network baseSepolia
3. Optimism Sepolia (Satellite)
CONFIGURE_PEERS=true npx hardhat run scripts/deploy.ts --network optimismSepolia
