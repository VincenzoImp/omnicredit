# Ignition Parameters Files

These parameter files are used with Hardhat Ignition to deploy contracts.

## Before Deploying

**IMPORTANT**: You must replace `REPLACE_WITH_YOUR_DEPLOYER_ADDRESS` in the parameter files with your actual deployer address (the account that will sign the deployment transactions).

### Quick Setup

1. Get your deployer address:
   ```bash
   # Check your account address
   npx hardhat run -e "import('hardhat').then(async h => { const hre = h.default || h; const conn = await hre.network.connect(); const [signer] = await conn.ethers.getSigners(); console.log('Deployer:', signer.address); })" --network baseSepolia
   ```

2. Or use a simple script:
   ```bash
   node -e "import('hardhat/config').then(async () => { const hre = await import('hardhat'); const conn = await (hre.default || hre).network.connect(); const [signer] = await conn.ethers.getSigners(); console.log(signer.address); })"
   ```

3. Replace `REPLACE_WITH_YOUR_DEPLOYER_ADDRESS` in the parameter files with your address.

## Deployment Commands

### Deploy Base Protocol (Base Sepolia)

```bash
npx hardhat ignition deploy ignition/modules/BaseProtocol.ts \
  --network baseSepolia \
  --parameters ignition/parameters/baseSepolia.json
```

### Deploy Cross-Chain (Sepolia)

```bash
npx hardhat ignition deploy ignition/modules/CrossChain.ts \
  --network sepolia \
  --parameters ignition/parameters/sepolia.json
```

## Parameter Descriptions

### BaseProtocol Parameters

- **pythAddress**: Pyth Network price feed contract address on Base Sepolia
- **usdcAddress**: USDC token address on Base Sepolia
- **lzEndpoint**: LayerZero V2 endpoint address on Base Sepolia
- **lzDelegate**: Your deployer address (used as LayerZero delegate)
- **poolManager**: Uniswap V4 PoolManager address (set to zero if not available)
- **feeCollector**: Address that will receive protocol fees (typically your deployer address)

### CrossChain Parameters

- **chainType**: Type of chain - "ethereum", "satellite", or "non-usdc"
- **lzEndpoint**: LayerZero V2 endpoint address
- **lzDelegate**: Your deployer address (used as LayerZero delegate)
- **coordinatorEid**: LayerZero endpoint ID of the Base chain coordinator (40245 for Base Sepolia)
- **usdcAddress**: USDC token address (required for "ethereum" chain type)

