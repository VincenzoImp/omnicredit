# 🗑️ Contratti da Eliminare

Analisi dei contratti obsoleti nella nuova architettura.

---

## ❌ Contratti da Eliminare

### 1. **LenderDepositWrapper.sol** ❌
**Path**: `contracts/cross-chain/LenderDepositWrapper.sol`

**Motivo**:
- ✅ **Sostituito da**: `LenderVault.sol`
- La nuova architettura usa `LenderVault` che fa la stessa cosa ma è più specifico
- `LenderDepositWrapper` era pensato per Base Sepolia, ora il protocollo è su Arbitrum Sepolia
- `LenderVault` è più chiaro nel nome e nella struttura

**Funzionalità**:
- Depositava USDC cross-chain a ProtocolCore su Base
- Ora `LenderVault` fa la stessa cosa ma per Arbitrum Sepolia

**Riferimenti nel codice**:
- `ProtocolCore.sol`: Riferimenti a `authorizedDepositWrappers` (da cambiare in `authorizedLenderVaults`)
- Commenti che menzionano `LenderDepositWrapper`

---

### 2. **CrossChainCoordinator.sol** ❌
**Path**: `contracts/cross-chain/CrossChainCoordinator.sol`

**Motivo**:
- ✅ **Sostituito da**: `ProtocolCore` gestisce direttamente il collateral
- Nella vecchia architettura, `CrossChainCoordinator` aggregava collateral da diverse chain
- Nella nuova architettura, `ProtocolCore` riceve direttamente i messaggi da `CollateralVault`
- Non serve più un coordinatore separato

**Funzionalità**:
- Riceveva messaggi di collateral da `CollateralVault`
- Aggregava collateral per utente
- Ora `ProtocolCore` fa tutto direttamente

**Riferimenti nel codice**:
- `CollateralVault.sol`: Riferimenti a "coordinator" (ora è ProtocolCore)
- Commenti che menzionano `CrossChainCoordinator`

---

### 3. **USDCOFTAdapter.sol** ❌
**Path**: `contracts/cross-chain/USDCOFTAdapter.sol`

**Motivo**:
- ✅ **Sostituito da**: `MockOFT.sol`
- `USDCOFTAdapter` era per lockare USDC reale su Ethereum
- Nella nuova architettura usiamo `MockUSDC` e `MockOFT` su ogni chain per testing
- Non serve più un adapter per USDC reale

**Funzionalità**:
- Lockava USDC reale su Ethereum Sepolia
- Permetteva bridge a altre chain via OFT
- Ora usiamo MockOFT per testing

**Riferimenti nel codice**:
- `layerzero.config.ts`: Riferimenti a `usdcAdapter` (da rimuovere)
- Commenti che menzionano `USDCOFTAdapter`

---

### 4. **USDCOmnitoken.sol** ❌
**Path**: `contracts/cross-chain/USDCOmnitoken.sol`

**Motivo**:
- ✅ **Sostituito da**: `MockOFT.sol`
- `USDCOmnitoken` era l'OFT per USDC su chain diverse da Ethereum
- Nella nuova architettura usiamo `MockOFT` su ogni chain per testing
- Ogni chain ha il suo MockUSDC locale, non serve un token omnichain unificato

**Funzionalità**:
- Mintava/bruciava omUSDC su chain diverse da Ethereum
- Era collegato a `USDCOFTAdapter` su Ethereum
- Ora usiamo MockOFT indipendente su ogni chain

**Riferimenti nel codice**:
- `ProtocolCore.sol`: Riferimenti a `USDCOmnitoken` nei commenti (da cambiare in MockOFT)
- `layerzero.config.ts`: Riferimenti a `usdcOmnitoken` (da rimuovere)

---

## ✅ Contratti da Mantenere

### 1. **LenderVault.sol** ✅
**Path**: `contracts/cross-chain/LenderVault.sol`

**Motivo**: Nuovo contratto che sostituisce `LenderDepositWrapper`

---

### 2. **CollateralVault.sol** ✅
**Path**: `contracts/cross-chain/CollateralVault.sol`

**Motivo**: Mantenuto ma modificato per inviare a ProtocolCore su Arbitrum invece di CrossChainCoordinator

---

### 3. **MockUSDC.sol** ✅
**Path**: `contracts/mocks/MockUSDC.sol`

**Motivo**: Token USDC mock per testing su ogni chain

---

### 4. **MockOFT.sol** ✅
**Path**: `contracts/mocks/MockOFT.sol`

**Motivo**: OFT mock per bridge cross-chain di MockUSDC

---

### 5. **ProtocolCore.sol** ✅
**Path**: `contracts/base/ProtocolCore.sol`

**Motivo**: Protocollo principale, modificato per gestire collateral cross-chain direttamente

---

## 📝 Modifiche Necessarie

### 1. ProtocolCore.sol
- ✅ Cambiare `authorizedDepositWrappers` → `authorizedLenderVaults` (già fatto)
- ⚠️ Rimuovere riferimenti a `LenderDepositWrapper` nei commenti
- ⚠️ Cambiare riferimenti a `USDCOmnitoken` → `MockOFT` nei commenti

### 2. CollateralVault.sol
- ✅ Cambiato per inviare a ProtocolCore invece di CrossChainCoordinator
- ⚠️ Rimuovere riferimenti a "coordinator" nei commenti

### 3. layerzero.config.ts
- ✅ Già aggiornato per nuova architettura
- ⚠️ Verificare che non ci siano riferimenti a contratti eliminati

---

## 🗂️ File da Eliminare

```bash
# Contratti obsoleti
contracts/cross-chain/LenderDepositWrapper.sol
contracts/cross-chain/CrossChainCoordinator.sol
contracts/cross-chain/USDCOFTAdapter.sol
contracts/cross-chain/USDCOmnitoken.sol
```

---

## ✅ Checklist Pre-Eliminazione

- [ ] Verificare che `LenderVault` funzioni correttamente
- [ ] Verificare che `ProtocolCore` gestisca collateral cross-chain
- [ ] Rimuovere tutti i riferimenti nei commenti
- [ ] Aggiornare `layerzero.config.ts` (già fatto)
- [ ] Verificare che non ci siano import di questi contratti
- [ ] Aggiornare documentazione

---

## 📊 Confronto Vecchia vs Nuova Architettura

### Vecchia Architettura
```
LenderDepositWrapper → ProtocolCore (Base)
CollateralVault → CrossChainCoordinator (Base) → ProtocolCore
USDCOFTAdapter (Ethereum) ↔ USDCOmnitoken (altre chain)
```

### Nuova Architettura
```
LenderVault → ProtocolCore (Arbitrum Sepolia)
CollateralVault → ProtocolCore (Arbitrum Sepolia)
MockOFT (ogni chain) ↔ MockOFT (altre chain)
```

---

**Totale contratti da eliminare: 4**

