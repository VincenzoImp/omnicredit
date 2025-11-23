# Deployment Scripts

Scripts professionali per il deployment e la configurazione del protocollo OmniCredit.

## 📋 Prerequisiti

1. **Variabili d'ambiente** (crea un file `.env`):
   ```bash
   PRIVATE_KEY=your_private_key_here
   ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
   OPTIMISM_SEPOLIA_RPC_URL=https://sepolia.optimism.io
   ```

2. **Parametri di deployment** (aggiorna i file in `ignition/parameters/`):
   - `arbitrumSepolia.json`: Pyth address, LayerZero endpoint, ETH price feed ID
   - `baseSepolia.json`: LayerZero endpoint, ProtocolCore EID (40231)
   - `optimismSepolia.json`: LayerZero endpoint, ProtocolCore EID (40231)

## 🚀 Deployment Completo

### ⚠️ Nota Importante

A causa di un problema noto con Hardhat 3 e `@nomicfoundation/hardhat-ethers`, lo script `deploy.ts` potrebbe non funzionare correttamente. In questo caso, usa i comandi diretti di Ignition (Opzione 2).

### Opzione 1: Script Automatico (Se funziona)

Lo script `deploy.ts` gestisce automaticamente tutto il processo:

```bash
# Deploy su Arbitrum Sepolia
npx hardhat run scripts/deploy.ts --network arbitrumSepolia

# Lo script aggiornerà automaticamente i parametri e deployerà su tutte le chain
```

**Se ottieni un errore "hre.ethers is undefined", usa l'Opzione 2.**

Lo script:
1. ✅ Deploya ProtocolCore su Arbitrum Sepolia
2. ✅ Aggiorna automaticamente i parametri per Base Sepolia e Optimism
3. ✅ Deploya vault e token su Base Sepolia
4. ✅ Deploya vault e token su Optimism Sepolia
5. ✅ Salva tutti gli indirizzi in `deployments.json`

### Opzione 2: Deployment Modulare (consigliato)

Usa i comandi suddivisi per chain. Ogni comando aggiorna automaticamente i parametri di Ignition con l'indirizzo di `ProtocolCore` evitando modifiche manuali:

```bash
# 1. Deploy Arbitrum Sepolia
npm run deploy:arbitrum

# 2. Deploy Base Sepolia (aggiornamento parametri automatico)
npm run deploy:baseSepolia

# 3. Deploy Optimism Sepolia (aggiornamento parametri automatico)
npm run deploy:optimism
```

## 🔗 Configurazione Peer LayerZero

Dopo il deployment, configura i peer LayerZero:

```bash
# 1. Configura su Arbitrum Sepolia (autorizza vault e configura peer)
npm run configure:peers:arbitrum

# 2. Configura su Base Sepolia (configura peer OFT e OApp)
npm run configure:peers:baseSepolia

# 3. Configura su Optimism Sepolia (configura peer OFT e OApp)
npm run configure:peers:optimism
```

Oppure usa lo script diretto:

```bash
npx hardhat run scripts/configure-peers.ts --network arbitrumSepolia
npx hardhat run scripts/configure-peers.ts --network baseSepolia
npx hardhat run scripts/configure-peers.ts --network optimismSepolia
```

## 📄 File Generati

Dopo il deployment, verrà creato il file `deployments.json` nella root del progetto con tutti gli indirizzi:

```json
{
  "arbitrumSepolia": {
    "protocolCore": "0x...",
    "mockUSDC": "0x...",
    "mockOFT": "0x...",
    ...
  },
  "baseSepolia": {
    "lenderVault": "0x...",
    "collateralVault": "0x...",
    ...
  },
  "optimismSepolia": {
    "lenderVault": "0x...",
    "collateralVault": "0x...",
    ...
  }
}
```

## 🔍 Verifica Deployment

Per verificare che tutto sia stato deployato correttamente:

1. **Controlla gli indirizzi** in `deployments.json`
2. **Verifica su block explorer**:
   - Arbitrum Sepolia: https://sepolia.arbiscan.io/
   - Base Sepolia: https://sepolia.basescan.org/
   - Optimism Sepolia: https://sepolia-optimism.etherscan.io/
3. **Verifica i peer LayerZero** usando LayerZeroScan: https://layerzeroscan.com/

## 🛠️ Script Disponibili

| Script | Descrizione |
|--------|-------------|
| `deploy.ts` | Script principale per deployment completo |
| `deploy-satellite.ts` | Helper che aggiorna i parametri e lancia Ignition per le chain satellite |
| `configure-peers.ts` | Configura i peer LayerZero tra i contratti |

## 📝 Note Importanti

1. **Ordine di deployment**: Deploya sempre Arbitrum Sepolia per primo, poi le chain satellite
2. **Configurazione peer**: Deve essere eseguita su ogni network dopo il deployment
3. **Autorizzazione vault**: Viene fatta automaticamente su Arbitrum Sepolia durante la configurazione peer
4. **Deployment incrementale**: Ignition supporta deployment incrementali - se un contratto è già deployato, verrà riutilizzato

## ❓ Troubleshooting

### Errore: "Deployment file not found"
- Assicurati di aver eseguito il deployment su Arbitrum Sepolia prima

### Errore: "Insufficient balance"
- Verifica che il tuo account abbia abbastanza ETH/gas su tutte le chain

### Errore: "Peer already configured"
- I peer possono essere riconfigurati senza problemi

### Deployment fallito su una chain
- Puoi riprovare solo quella chain specifica - Ignition riutilizzerà i contratti già deployati

## 🔐 Sicurezza

- ⚠️ **NON committare** il file `.env` o `deployments.json` con chiavi private
- ⚠️ Usa sempre account separati per testnet e mainnet
- ⚠️ Verifica sempre gli indirizzi deployati prima di usarli in produzione

