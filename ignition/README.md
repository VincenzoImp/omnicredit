# 🚀 Hardhat Ignition Deployment Guide

Sistema professionale di deployment per OmniCredit Protocol usando Hardhat Ignition.

---

## 📋 Struttura

```
ignition/
├── modules/           # Moduli di deployment
│   ├── CoreContracts.ts      # Contratti core (Arbitrum Sepolia)
│   ├── MockOFT.ts            # MockOFT (riutilizzabile)
│   ├── ArbitrumSepolia.ts    # Deployment completo Arbitrum Sepolia
│   ├── SatelliteChain.ts     # Modulo riutilizzabile per chain satellite
│   ├── Sepolia.ts            # Deployment Sepolia
│   ├── OptimismSepolia.ts    # Deployment Optimism Sepolia
│   └── ConfigurePeers.ts    # Configurazione peers LayerZero
└── parameters/        # Parametri per ogni chain
    ├── arbitrumSepolia.json
    ├── sepolia.json
    └── optimismSepolia.json
```

---

## 🏗️ Moduli

### CoreContracts
Deploys i contratti core del protocollo su Arbitrum Sepolia:
- ContinuousCreditScore
- FeeBasedLimits
- PriceOracle
- MockUSDC
- ProtocolCore
- LiquidationManager

### MockOFT
Modulo riutilizzabile per deployare MockOFT su qualsiasi chain.

### ArbitrumSepolia
Deployment completo per Arbitrum Sepolia (chain principale).

### SatelliteChain
Modulo riutilizzabile per chain satellite (Sepolia, Optimism Sepolia):
- MockUSDC locale
- MockOFT
- LenderVault
- CollateralVault

### ConfigurePeers
Configura i peers LayerZero tra tutti i contratti dopo il deployment.

---

## 🚀 Deployment

### 1. Preparazione

Crea file `.env` con:
```bash
PRIVATE_KEY=your_private_key
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
OPTIMISM_SEPOLIA_RPC_URL=https://sepolia.optimism.io
```

Aggiorna i parametri in `ignition/parameters/*.json`:
- Indirizzi Pyth Network
- Indirizzi LayerZero endpoints
- Price feed IDs

### 2. Deploy Arbitrum Sepolia (Chain Principale)

```bash
npx hardhat ignition deploy ignition/modules/ArbitrumSepolia.ts \
  --network arbitrumSepolia \
  --parameters ignition/parameters/arbitrumSepolia.json
```

Questo deploya:
- Tutti i contratti core
- MockUSDC
- MockOFT
- Configurazione iniziale

**Salva gli indirizzi deployati!**

### 3. Deploy Sepolia

Prima di deployare, aggiorna `ignition/parameters/sepolia.json`:
```json
{
  "protocolCoreAddress": "0x000000000000000000000000...", // Address di ProtocolCore su Arbitrum come bytes32 (64 caratteri hex)
  ...
}
```

**Nota**: `protocolCoreAddress` deve essere l'indirizzo di ProtocolCore convertito in bytes32.
Usa questo helper per convertire: `"0x" + address.slice(2).padStart(64, "0")`

```bash
npx hardhat ignition deploy ignition/modules/Sepolia.ts \
  --network sepolia \
  --parameters ignition/parameters/sepolia.json
```

### 4. Deploy Optimism Sepolia

Prima di deployare, aggiorna `ignition/parameters/optimismSepolia.json`:
```json
{
  "protocolCoreAddress": "0x000000000000000000000000...", // Address di ProtocolCore su Arbitrum come bytes32 (64 caratteri hex)
  ...
}
```

**Nota**: `protocolCoreAddress` deve essere l'indirizzo di ProtocolCore convertito in bytes32.
Usa questo helper per convertire: `"0x" + address.slice(2).padStart(64, "0")`

```bash
npx hardhat ignition deploy ignition/modules/OptimismSepolia.ts \
  --network optimismSepolia \
  --parameters ignition/parameters/optimismSepolia.json
```

### 5. Configurare Peers LayerZero

Dopo aver deployato su tutte le chain, configura i peers usando lo script dedicato:

```bash
# Su Arbitrum Sepolia
npx hardhat run scripts/configure-peers.ts --network arbitrumSepolia

# Su Sepolia
npx hardhat run scripts/configure-peers.ts --network sepolia

# Su Optimism Sepolia
npx hardhat run scripts/configure-peers.ts --network optimismSepolia
```

Lo script legge automaticamente gli indirizzi dai deployment di Ignition e configura tutti i peers.

---

## 📝 Best Practices

### 1. Deployment Incrementale
Ignition supporta deployment incrementali. Se un contratto è già deployato, Ignition lo riutilizza.

### 2. Verifica Contratti
Dopo il deployment, verifica i contratti:
```bash
npx hardhat verify --network arbitrumSepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS>
```

### 3. Salvare Deployment Info
Ignition salva automaticamente le informazioni di deployment in:
```
ignition/deployments/chain-<CHAIN_ID>/deployed_addresses.json
```

### 4. Reset Deployment
Per resettare un deployment:
```bash
npx hardhat ignition deploy ignition/modules/ArbitrumSepolia.ts \
  --network arbitrumSepolia \
  --reset
```

---

## 🔧 Parametri

### Arbitrum Sepolia
- `pythAddress`: Indirizzo contratto Pyth Network
- `lzEndpoint`: LayerZero V2 endpoint
- `ethPriceFeedId`: Pyth ETH/USD price feed ID
- `delegate`: Address delegate per LayerZero

### Sepolia / Optimism Sepolia
- `lzEndpoint`: LayerZero V2 endpoint
- `protocolCoreEid`: Endpoint ID di Arbitrum Sepolia (40231)
- `protocolCoreAddress`: Indirizzo ProtocolCore su Arbitrum (bytes32)
- `delegate`: Address delegate per LayerZero

---

## 🐛 Troubleshooting

### Error: Contract already deployed
Ignition riutilizza contratti già deployati. Se vuoi forzare un nuovo deployment, usa `--reset`.

### Error: Missing parameter
Verifica che tutti i parametri richiesti siano presenti nel file JSON.

### Error: Insufficient funds
Assicurati di avere ETH sufficiente sulla chain di destinazione.

---

## 📚 Risorse

- [Hardhat Ignition Docs](https://hardhat.org/ignition/docs)
- [Hardhat Ignition Examples](https://github.com/NomicFoundation/hardhat-ignition-examples)

---

## ✅ Checklist Deployment

- [ ] Configurare `.env` file
- [ ] Aggiornare parametri in `ignition/parameters/*.json`
- [ ] Deploy Arbitrum Sepolia
- [ ] Salvare indirizzi deployati
- [ ] Aggiornare `protocolCoreAddress` in parametri satellite
- [ ] Deploy Sepolia
- [ ] Deploy Optimism Sepolia
- [ ] Configurare peers LayerZero
- [ ] Verificare contratti su explorer
- [ ] Testare funzionalità cross-chain

