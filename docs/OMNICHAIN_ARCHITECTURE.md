# Omnichain Architecture - OmniCredit Protocol

## Overview

OmniCredit è un protocollo di lending omnichain completo che permette:
- **Lender**: Depositare USDC da qualsiasi chain, ricevono shares su Base
- **Borrower**: Depositare ETH come collateral SOLO su Base, ricevono prestiti in USDC su qualsiasi chain di destinazione
- **Architettura Semplificata**: Collateral ETH gestito direttamente su Base, nessun vault cross-chain necessario

## Architettura

### Contratti Principali

#### Base Chain (Hub)
- **ProtocolCore**: Core lending pool con supporto OApp
  - Accetta depositi ETH come collateral (solo su Base)
  - Gestisce prestiti cross-chain (USDC inviato via OFT)
- **USDCOmnitoken**: OFT per bridging USDC tra chain

#### Satellite Chains (Arbitrum, Optimism, Ethereum, etc.)
- **LenderDepositWrapper**: Permette depositi USDC cross-chain
- **USDCOmnitoken**: OFT per bridging USDC

## Flussi Operativi

### 1. Deposito Lender Cross-Chain

```
Lender su Arbitrum:
1. LenderDepositWrapper.depositCrossChain(amount)
2. USDC bridgeato a Base via OFT
3. Messaggio OApp inviato a ProtocolCore su Base
4. ProtocolCore processa deposito e assegna shares
```

### 2. Deposito Collateral Borrower

```
Borrower su Base:
1. ProtocolCore.depositCollateral() (ETH nativo)
2. ETH bloccato direttamente in ProtocolCore su Base
3. Valore calcolato via PriceOracle
```

### 3. Prestito Cross-Chain

```
Borrower su Base:
1. ProtocolCore.borrowCrossChain(amount, collateralValue, dstEid, minAmount)
2. Validazione collateral (locale + cross-chain)
3. USDC bridgeato via OFT alla chain di destinazione
4. Borrower riceve USDC sulla chain scelta
```

### 4. Rimborso e Withdraw Collateral

```
Borrower su Base:
1. ProtocolCore.repay(amount) - rimborsa loan
2. Se loan completamente rimborsato, borrower può chiamare ProtocolCore.withdrawCollateral()
3. ETH ritirato direttamente da ProtocolCore
```

## Deployment

Vedi [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) per istruzioni dettagliate.

## Riferimenti

- [LayerZero V2 Docs](https://docs.layerzero.network/v2)
- [OFT Standard](https://docs.layerzero.network/v2/developers/evm/oft/quickstart)
- [OApp Guide](https://docs.layerzero.network/v2/developers/evm/oapp/overview)

