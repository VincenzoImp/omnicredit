# OmniCredit Deployment Guide

## Prerequisites

1. Set up your `.env` file with:
   ```env
   PRIVATE_KEY=your_private_key_here
   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
   SEPOLIA_RPC_URL=https://rpc.ankr.com/eth_sepolia
   ```

2. Ensure you have sufficient testnet ETH on Base Sepolia and Sepolia

3. **Get your deployer address** and update the parameter files:
   ```bash
   # Get your deployer address
   npx hardhat run scripts/get-deployer-address.ts --network baseSepolia
   ```
   
   This will display your deployer address. Copy it and replace `REPLACE_WITH_YOUR_DEPLOYER_ADDRESS` in the parameter files.

4. Update `ignition/parameters/baseSepolia.json` and `ignition/parameters/sepolia.json`:
   - Replace `REPLACE_WITH_YOUR_DEPLOYER_ADDRESS` with your actual deployer address
   - This address will be used for `lzDelegate` and `feeCollector` parameters

## Deployment

### Deploy Base Protocol (Base Sepolia)

```bash
npx hardhat ignition deploy ignition/modules/BaseProtocol.ts \
  --network baseSepolia \
  --parameters ignition/parameters/baseSepolia.json
```

### Deploy Satellite Chain (Sepolia)

```bash
npx hardhat ignition deploy ignition/modules/CrossChain.ts \
  --network sepolia \
  --parameters ignition/parameters/sepolia.json
```

## Network Configuration

### Base Sepolia (Base Chain)
- **Chain ID**: 84532
- **Pyth Address**: `0x2880aB155794e7179c9eE2e38200202908C17B43`
- **USDC Address**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
- **LayerZero Endpoint**: `0x6EDCE65403992e310A62460808c4b910D972f10f`
- **LayerZero Endpoint ID**: 40245

### Sepolia (Satellite Chain)
- **Chain ID**: 11155111
- **USDC Address**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- **LayerZero Endpoint**: `0x6EDCE65403992e310A62460808c4b910D972f10f`
- **LayerZero Endpoint ID**: 40161

## Troubleshooting

### Error: InvalidDelegate()
- **Cause**: The `lzDelegate` parameter is set to zero address
- **Solution**: Ensure `lzDelegate` is set to your deployer address (the account that will sign transactions)

### Error: InvalidPythAddress()
- **Cause**: The `pythAddress` parameter is set to zero address or invalid
- **Solution**: Verify the Pyth address is correct for the network you're deploying to

### Error: Cannot read properties of undefined (reading 'getSigners')
- **Cause**: Hardhat v3 network connection issue
- **Solution**: Use the deployment script which properly handles network connections

## Post-Deployment

After deployment, you'll need to:
1. Configure contract permissions and relationships
2. Authorize vaults in CrossChainCoordinator
3. Set up LayerZero trusted remotes
4. Configure price feeds in PriceOracle

See the deployment script output for next steps.

