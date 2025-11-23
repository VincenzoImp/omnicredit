# Ignition Parameters Files

These parameter files are used with Hardhat Ignition to deploy contracts.

## Before Deploying

**IMPORTANT**: You must replace `REPLACE_WITH_YOUR_DEPLOYER_ADDRESS` in the parameter files with your actual deployer address (the account that will sign the deployment transactions).

### Quick Setup

1. Get your deployer address:
   ```bash
   # Check your account address
   npx hardhat run -e "import('hardhat').then(async h => { const hre = h.default || h; const conn = await hre.network.connect(); const [signer] = await conn.ethers.getSigners(); console.log('Deployer:', signer.address); })" --network arbitrumSepolia
   ```

2. Or use a simple script:
   ```bash
   node -e "import('hardhat/config').then(async () => { const hre = await import('hardhat'); const conn = await (hre.default || hre).network.connect(); const [signer] = await conn.ethers.getSigners(); console.log(signer.address); })"
   ```

3. Replace `REPLACE_WITH_YOUR_DEPLOYER_ADDRESS` in the parameter files with your address.

## Deployment Commands

### Deploy Base Protocol (Arbitrum Sepolia)

```bash
npx hardhat ignition deploy ignition/modules/BaseProtocol.ts \
  --network arbitrumSepolia \
  --parameters ignition/parameters/arbitrumSepolia.json
```

### Deploy Cross-Chain (Sepolia)

```bash
npx hardhat ignition deploy ignition/modules/CrossChain.ts \
  --network sepolia \
  --parameters ignition/parameters/sepolia.json
```

## Parameter Descriptions

### BaseProtocol Parameters

- **pythAddress**: Pyth Network price feed contract address on Arbitrum Sepolia
- **usdcAddress**: USDC token address on Arbitrum Sepolia
- **lzEndpoint**: LayerZero V2 endpoint address on Arbitrum Sepolia
- **lzDelegate**: Your deployer address (used as LayerZero delegate)
- **poolManager**: Uniswap V4 PoolManager address
  - **For Testnets (Arbitrum Sepolia)**: Deploy your own using:
    ```bash
    forge script lib/v4-periphery/script/01_PoolManager.s.sol:DeployPoolManager \
      --rpc-url $ARBITRUM_SEPOLIA_RPC_URL \
      --broadcast \
      --private-key $PRIVATE_KEY
    ```
    Then copy the deployed address to this parameter.
  - **For Mainnet**: Use the official Uniswap V4 PoolManager address (check Uniswap V4 documentation)
  - **Note**: PoolManager is typically deployed ONCE per chain and shared by all protocols
- **feeCollector**: Address that will receive protocol fees (typically your deployer address)

### CrossChain Parameters

- **chainType**: Type of chain - "ethereum", "satellite", or "non-usdc"
- **lzEndpoint**: LayerZero V2 endpoint address
- **lzDelegate**: Your deployer address (used as LayerZero delegate)
- **coordinatorEid**: Base chain endpoint ID (required for satellite chains)
- **usdcAddress**: USDC token address (required for Ethereum chain type)

## PoolManager Deployment

### Why Deploy Your Own?

- **Testnets**: Uniswap V4 may not have official deployments on all testnets
- **Development**: You need full control over the PoolManager instance
- **Custom Configuration**: You want to set your own protocol fee owner

### How to Deploy PoolManager

1. **Using Foundry** (Recommended):
   ```bash
   forge script lib/v4-periphery/script/01_PoolManager.s.sol:DeployPoolManager \
     --rpc-url $BASE_SEPOLIA_RPC_URL \
     --broadcast \
     --private-key $PRIVATE_KEY
   ```

2. **Update Parameters**:
   - Copy the deployed PoolManager address from the output
   - Update `ignition/parameters/arbitrumSepolia.json`:
     ```json
     {
       "BaseProtocol": {
         "poolManager": "0x<your-deployed-poolmanager-address>",
         ...
       }
     }
     ```

3. **Deploy Base Protocol**:
   ```bash
   npx hardhat ignition deploy ignition/modules/BaseProtocol.ts \
     --network arbitrumSepolia \
     --parameters ignition/parameters/arbitrumSepolia.json \
     --reset
   ```

### Using Official Uniswap V4 PoolManager

When Uniswap V4 is officially deployed on mainnet, you can use their PoolManager address:
- Check Uniswap V4 documentation for official addresses
- Update the `poolManager` parameter with the official address
- No need to deploy your own
