# 🏗️ Nuova Architettura OmniCredit

## 📋 Panoramica

Architettura completamente ristrutturata per supportare:
- **MockUSDC locale su ogni chain** (Sepolia, Optimism Sepolia)
- **Lenders depositano MockUSDC locale** sul vault della loro chain
- **Borrowers depositano token nativi** (ETH, MATIC, etc.) su qualsiasi chain
- **Protocollo principale su Arbitrum Sepolia**
- **Borrowers scelgono su quale chain ricevere MockUSDC** quando prendono prestito

---

## 🔗 Chain Supportate

1. **Arbitrum Sepolia** (Chain ID: 421614)
   - ProtocolCore (protocollo principale)
   - MockUSDC locale
   - MockOFT per bridge

2. **Sepolia** (Chain ID: 11155111)
   - LenderVault (deposita MockUSDC locale)
   - CollateralVault (deposita token nativi)
   - MockUSDC locale
   - MockOFT per bridge

3. **Optimism Sepolia** (Chain ID: 11155420)
   - LenderVault (deposita MockUSDC locale)
   - CollateralVault (deposita token nativi)
   - MockUSDC locale
   - MockOFT per bridge

---

## 📦 Contratti

### Arbitrum Sepolia

#### ProtocolCore
- Protocollo principale di lending/borrowing
- Riceve depositi da LenderVault su altre chain
- Riceve aggiornamenti collateral da CollateralVault su altre chain
- Gestisce prestiti e permette ai borrowers di scegliere chain di destinazione per MockUSDC

#### MockUSDC
- Token USDC locale per Arbitrum Sepolia
- Usato per lending/borrowing locale

#### MockOFT
- Bridge cross-chain per MockUSDC
- Permette trasferimenti tra chain

### Sepolia / Optimism Sepolia

#### LenderVault
- Vault per lenders
- Accetta MockUSDC locale
- Bridge MockUSDC a Arbitrum Sepolia
- Invia messaggio OApp a ProtocolCore

#### CollateralVault
- Vault per borrowers
- Accetta token nativi (ETH, MATIC, etc.)
- Invia messaggio OApp a ProtocolCore con info collateral
- Lock/unlock collateral locale

#### MockUSDC
- Token USDC locale per questa chain
- Diverso da MockUSDC su altre chain

#### MockOFT
- Bridge cross-chain per MockUSDC locale

---

## 🔄 Flussi

### 1. Lender Deposita (Sepolia → Arbitrum Sepolia)

```
1. Lender su Sepolia chiama LenderVault.deposit(amount)
2. LenderVault prende MockUSDC locale
3. LenderVault bridge MockUSDC a Arbitrum via MockOFT
4. LenderVault invia messaggio OApp a ProtocolCore
5. ProtocolCore riceve MockUSDC e messaggio
6. ProtocolCore assegna shares al lender
7. ProtocolCore invia conferma a LenderVault
```

### 2. Borrower Deposita Collateral (Sepolia → Arbitrum Sepolia)

```
1. Borrower su Sepolia deposita ETH in CollateralVault
2. CollateralVault lock ETH
3. CollateralVault calcola valore USD via PriceOracle
4. CollateralVault invia messaggio OApp a ProtocolCore su Arbitrum
5. ProtocolCore aggiorna borrowerCollateral[borrower][ETH]
6. Borrower può ora prendere prestito
```

### 3. Borrower Prende Prestito (Arbitrum → Qualsiasi Chain)

```
1. Borrower su Arbitrum chiama ProtocolCore.borrowCrossChain(amount, dstEid)
2. ProtocolCore verifica collateral (somma di tutti gli asset)
3. ProtocolCore verifica LTV e limiti
4. ProtocolCore crea loan
5. ProtocolCore bridge MockUSDC a chain di destinazione via MockOFT
6. Borrower riceve MockUSDC sulla chain scelta
```

### 4. Borrower Ripaga e Ritira Collateral

```
1. Borrower ripaga loan su Arbitrum
2. ProtocolCore invia messaggio a CollateralVault per unlock
3. CollateralVault unlock collateral
4. Borrower ritira collateral dalla chain originale
```

---

## 🔧 Modifiche Necessarie

### ProtocolCore

1. ✅ Cambiato `borrowerCollateral` da `mapping(address => uint256)` a `mapping(address => mapping(address => uint256))`
2. ✅ Aggiunto `authorizedLenderVaults` e `authorizedCollateralVaults`
3. ⚠️ **TODO**: Modificare `_lzReceive` per gestire messaggi da CollateralVault
4. ⚠️ **TODO**: Modificare `getBorrowerCollateralValue()` per sommare tutti gli asset
5. ⚠️ **TODO**: Modificare `borrow()` e `borrowCrossChain()` per usare nuovo mapping
6. ⚠️ **TODO**: Rimuovere `depositCollateral()` locale (ora solo cross-chain)

### CollateralVault

1. ✅ Modificato per inviare a ProtocolCore su Arbitrum
2. ✅ Modificato per includere asset address nel messaggio
3. ✅ Aggiunto `setProtocolCore()`

### LenderVault

1. ✅ Creato nuovo contratto
2. ✅ Gestisce depositi MockUSDC locale
3. ✅ Bridge a Arbitrum e invia messaggio

### PriceOracle

1. ⚠️ **TODO**: Aggiungere supporto per multipli token nativi (ETH, MATIC, etc.)
2. ⚠️ **TODO**: Configurare price feeds per tutti i token supportati

---

## 📝 Prossimi Step

1. **Completare modifiche a ProtocolCore**:
   - Fix `getBorrowerCollateralValue()` per sommare tutti gli asset
   - Fix `borrow()` e `borrowCrossChain()` per usare nuovo mapping
   - Implementare `_handleCollateralUpdate()` in `_lzReceive`

2. **Aggiornare PriceOracle**:
   - Aggiungere price feeds per ETH, MATIC, etc.
   - Testare con multipli asset

3. **Creare script di deployment**:
   - Deploy su Arbitrum Sepolia (ProtocolCore)
   - Deploy su Sepolia (LenderVault, CollateralVault)
   - Deploy su Optimism Sepolia (LenderVault, CollateralVault)
   - Configurare peers LayerZero

4. **Creare script di demo**:
   - Lender deposita su Sepolia
   - Borrower deposita collateral su Sepolia
   - Borrower prende prestito e riceve MockUSDC su Optimism Sepolia
   - Borrower ripaga e ritira collateral

---

## ⚠️ Note Importanti

- Ogni chain ha il suo MockUSDC locale (non condiviso)
- I depositi dei lenders vanno tutti al ProtocolCore su Arbitrum
- Il collateral dei borrowers è aggregato su Arbitrum ma fisicamente locked sulle chain originali
- I borrowers possono scegliere su quale chain ricevere MockUSDC quando prendono prestito
- L'oracolo deve supportare tutti i token nativi depositati dai borrowers

