# LayerZero V2: Guida Completa

## 📚 Indice
1. [Panoramica](#panoramica)
2. [Architettura Base](#architettura-base)
3. [OApp (Omnichain Application)](#oapp-omnichain-application)
4. [OFT (Omnichain Fungible Token)](#oft-omnichain-fungible-token)
5. [Flusso di Messaggi Cross-Chain](#flusso-di-messaggi-cross-chain)
6. [Implementazione nel Tuo Progetto](#implementazione-nel-tuo-progetto)
7. [Sicurezza](#sicurezza)

---

## Panoramica

**LayerZero V2** è un protocollo di interoperabilità omnichain che permette a smart contract su blockchain diverse di comunicare direttamente, come se fossero sulla stessa chain.

### Problema che Risolve
- **Frammentazione**: Ogni blockchain è un'isola isolata
- **Liquidità Silos**: Asset bloccati su una sola chain
- **Complessità**: Wrapping/unwrapping, bridge multipli, UX frammentata

### Soluzione LayerZero
- **Messaggistica Diretta**: Contratti comunicano direttamente tra chain
- **Asset Nativi**: Trasferimenti senza wrapping (tramite OFT)
- **Unificazione**: Un'unica API per tutte le chain

---

## Architettura Base

### Componenti Principali

#### 1. **Endpoint LayerZero**
Ogni blockchain ha un contratto **Endpoint** che funge da hub di comunicazione:
- Riceve messaggi in uscita
- Valida messaggi in entrata
- Gestisce routing cross-chain

#### 2. **Ultra Light Nodes (ULN)**
- Verificano transazioni con **minimo overhead**
- Richiedono solo **block headers** (non interi blocchi)
- Mantengono sicurezza paragonabile alla chain sottostante

#### 3. **Oracles e Relayers** (Separati per Sicurezza)
- **Oracle**: Fornisce block headers per verifica
- **Relayer**: Trasmette le prove delle transazioni
- **Sicurezza**: Entrambi devono colludere per compromettere il sistema

### Modello di Sicurezza
```
Chain A → Endpoint → Oracle (header) + Relayer (proof) → Endpoint → Chain B
                    ↓
            Verifica indipendente e parallela
```

**Perché è sicuro?**
- Oracle e Relayer sono **entità separate**
- Devono **colludere** per attaccare (economicamente impraticabile)
- Verifica **on-chain** con prove crittografiche

---

## OApp (Omnichain Application)

**OApp** è il contratto base per applicazioni omnichain. Permette di inviare messaggi arbitrari tra chain.

### Caratteristiche Principali

#### 1. **Eredita da `OApp`**
```solidity
contract ProtocolCore is OApp, ReentrancyGuard {
    // Il tuo contratto diventa omnichain!
}
```

#### 2. **Funzioni Chiave**

##### `_lzSend()` - Invia Messaggio
```solidity
function _lzSend(
    uint32 _dstEid,           // Endpoint ID della chain destinazione
    bytes memory _payload,     // Dati da inviare
    bytes memory _options,     // Opzioni (gas, executor, etc.)
    MessagingFee memory _fee,  // Fee per il messaggio
    address payable _refundTo // Chi riceve il refund se fallisce
) internal;
```

##### `_lzReceive()` - Riceve Messaggio
```solidity
function _lzReceive(
    Origin calldata _origin,      // Info sulla chain sorgente
    bytes32 _guid,                // GUID univoco del messaggio
    bytes calldata _message,       // Payload del messaggio
    address _executor,             // Chi ha eseguito il messaggio
    bytes calldata _extraData      // Dati extra
) internal override {
    // La tua logica qui!
}
```

#### 3. **Origin Structure**
```solidity
struct Origin {
    uint32 srcEid;    // Endpoint ID della chain sorgente
    bytes32 sender;   // Indirizzo del mittente (come bytes32)
    uint64 nonce;     // Nonce per prevenire replay
}
```

### Esempio: Deposito Cross-Chain

**Scenario**: Lender deposita USDC su Arbitrum, riceve shares su Base

```solidity
// Su Arbitrum: LenderDepositWrapper
function depositCrossChain(uint256 amount) external {
    // 1. Prendi USDC dal lender
    usdc.transferFrom(msg.sender, address(this), amount);
    
    // 2. Bridge USDC via OFT (vedi sezione OFT)
    usdcOFT.send(...);
    
    // 3. Invia messaggio OApp a ProtocolCore su Base
    bytes memory payload = abi.encode(
        uint8(1),        // Message type: DEPOSIT
        msg.sender,      // Lender address
        amount,          // Deposit amount
        guid             // Unique identifier
    );
    
    _lzSend(
        baseEid,         // Destinazione: Base
        payload,         // Messaggio
        options,         // Opzioni (gas, etc.)
        fee,             // Fee
        payable(msg.sender)
    );
}

// Su Base: ProtocolCore
function _lzReceive(...) internal override {
    // 1. Verifica mittente autorizzato
    require(authorizedDepositWrappers[_origin.srcEid] == _origin.sender);
    
    // 2. Decodifica messaggio
    (uint8 msgType, address lender, uint256 amount, bytes32 guid) = 
        abi.decode(_message, ...);
    
    // 3. Processa deposito (USDC già arrivato via OFT)
    _deposit(lender, amount);
}
```

---

## OFT (Omnichain Fungible Token)

**OFT** permette di avere token fungibili nativi su più chain con **supply unificata**.

### Due Tipi di OFT

#### 1. **OFT Nativo** (per token nuovi)
- Token creato direttamente come OFT
- Burn su source chain → Mint su destination chain
- Supply globale unificata

#### 2. **OFTAdapter** (per token esistenti)
- Wrapper per token esistenti (es. USDC)
- Lock su chain originale → Mint su altre chain
- Unlock su chain originale → Burn su altre chain

### Come Funziona OFT

#### Su Chain Sorgente (es. Arbitrum)
```solidity
// 1. User approva OFT
usdc.approve(address(usdcOFT), amount);

// 2. OFT locka/burna i token
usdcOFT.send(
    SendParam({
        dstEid: baseEid,           // Destinazione: Base
        to: addressToBytes32(to), // Destinatario
        amountLD: amount,          // Quantità
        minAmountLD: minAmount,     // Slippage protection
        extraOptions: options,      // Opzioni
        composeMsg: "",            // Messaggio composito
        oftCmd: ""                 // Comando OFT
    }),
    fee,                           // Fee LayerZero
    payable(msg.sender)            // Refund address
);
```

**Cosa succede:**
1. OFT **locka** USDC (o lo brucia se è OFT nativo)
2. Invia messaggio a destination chain
3. User paga fee LayerZero

#### Su Chain Destinazione (es. Base)
```solidity
// OFT riceve automaticamente il messaggio
function _lzReceive(...) internal override {
    // 1. Verifica messaggio valido
    // 2. MINT token al destinatario
    _mint(to, amount);
}
```

**Risultato:**
- USDC lockato su Arbitrum
- USDC mintato su Base
- Supply globale invariata (lock = mint)

### Esempio nel Tuo Progetto

```solidity
// ProtocolCore.sol - borrowCrossChain()
function borrowCrossChain(uint256 amount, uint32 dstEid) external {
    // 1. Valida prestito (collaterale, credit score, etc.)
    // 2. Aggiorna stato locale (debt, shares, etc.)
    
    // 3. Bridge USDC alla chain destinazione via OFT
    SendParam memory sendParam = SendParam({
        dstEid: dstEid,
        to: addressToBytes32(msg.sender), // Borrower riceve USDC
        amountLD: amount,
        minAmountLD: minAmountLD,
        extraOptions: OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(200000, 0)
            .toBytes(),
        composeMsg: "",
        oftCmd: ""
    });
    
    // 4. Approva e invia
    lendingToken.safeApprove(address(usdcOFT), amount);
    MessagingFee memory fee = usdcOFT.quoteSend(sendParam, false);
    usdcOFT.send{value: fee.nativeFee}(sendParam, fee, payable(msg.sender));
    
    // Borrower riceve USDC sulla chain che ha scelto!
}
```

---

## Flusso di Messaggi Cross-Chain

### Step-by-Step Flow

#### Scenario: Lender deposita da Arbitrum a Base

```
┌─────────────────┐
│  Arbitrum       │
│                 │
│ 1. Lender chiama│
│    depositCross │
│    Chain()      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ LenderDeposit   │
│ Wrapper         │
│                 │
│ 2. Prende USDC  │
│ 3. Bridge via   │
│    OFT          │
│ 4. Invia OApp   │
│    message      │
└────────┬────────┘
         │
         │ LayerZero Network
         │ (Oracle + Relayer)
         │
         ▼
┌─────────────────┐
│  Base            │
│                  │
│ 5. OFT riceve    │
│    e mint USDC   │
│ 6. ProtocolCore  │
│    riceve OApp   │
│    message       │
│ 7. Processa      │
│    deposito      │
└──────────────────┘
```

### Dettagli Tecnici

#### 1. **OptionsBuilder** - Configurazione Messaggi
```solidity
bytes memory options = OptionsBuilder.newOptions()
    .addExecutorLzReceiveOption(200000, 0)  // Gas per _lzReceive
    .toBytes();
```

**Opzioni disponibili:**
- `addExecutorLzReceiveOption(gas, value)`: Gas per eseguire `_lzReceive`
- `addNativeDropOption(amount, receiver)`: Invia ETH nativo
- `addComposeOption(index, gas, value)`: Messaggi compositi

#### 2. **MessagingFee** - Quote e Pagamento
```solidity
// Quote del fee
MessagingFee memory fee = _quote(
    dstEid,      // Chain destinazione
    payload,     // Payload del messaggio
    options,     // Opzioni
    false        // Pay in native token
);

// Invia messaggio (user paga fee)
_lzSend(dstEid, payload, options, fee, payable(msg.sender));
```

**Fee Components:**
- **Native Fee**: Fee in ETH/native token
- **LZToken Fee**: Fee in LZ token (opzionale)

#### 3. **GUID (Globally Unique Identifier)**
Ogni messaggio ha un GUID univoco:
- Previene replay attacks
- Permette tracking del messaggio
- Usato per refunds e confirmations

---

## Implementazione nel Tuo Progetto

### Architettura Omnichain

```
┌─────────────────────────────────────────────────────────┐
│                    LENDER FLOW                          │
│                                                          │
│  Arbitrum/Any Chain          Base Chain                 │
│  ────────────────            ──────────                 │
│                                                          │
│  Lender                    LenderDepositWrapper         │
│    │                            │                        │
│    │ depositCrossChain()        │                        │
│    ├───────────────────────────>│                        │
│    │                            │                        │
│    │                            │ 1. Bridge USDC via OFT │
│    │                            │ 2. Send OApp message   │
│    │                            │                        │
│    │                            │        │               │
│    │                            │        ▼               │
│    │                            │  ProtocolCore          │
│    │                            │    │                   │
│    │                            │    │ _lzReceive()      │
│    │                            │    │ Process deposit   │
│    │                            │    │ Issue shares      │
│    │                            │    │                   │
│    │                            │    ▼                   │
│    │                            │  Send confirmation     │
│    │                            │                        │
│    │<───────────────────────────┤                        │
│    │ Confirmation               │                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   BORROWER FLOW                         │
│                                                          │
│  Base Chain                Any Destination Chain        │
│  ──────────               ──────────────────────        │
│                                                          │
│  Borrower                  Borrower                      │
│    │                         │                           │
│    │ 1. Deposit ETH          │                           │
│    │    collateral            │                           │
│    │                         │                           │
│    │ 2. borrowCrossChain()   │                           │
│    │    (specify dstEid)      │                           │
│    │                         │                           │
│    │        │                 │                           │
│    │        ▼                 │                           │
│    │  ProtocolCore            │                           │
│    │    │                     │                           │
│    │    │ 3. Validate loan    │                           │
│    │    │ 4. Update state     │                           │
│    │    │ 5. Bridge USDC via  │                           │
│    │    │    OFT              │                           │
│    │    │                     │                           │
│    │    │        │             │                           │
│    │    │        │ LayerZero   │                           │
│    │    │        │ Network     │                           │
│    │    │        │             │                           │
│    │    │        ▼             │                           │
│    │    │  OFT on dest chain   │                           │
│    │    │    │                 │                           │
│    │    │    │ Mint USDC       │                           │
│    │    │    │                 │                           │
│    │    │    ▼                 │                           │
│    │    │  Borrower receives   │                           │
│    │    │  USDC!               │                           │
└─────────────────────────────────────────────────────────┘
```

### Contratti Chiave

#### 1. **ProtocolCore** (Base Chain)
- **Ruolo**: Core lending protocol
- **OApp**: Riceve depositi cross-chain, gestisce prestiti
- **Funzioni**:
  - `_lzReceive()`: Processa depositi da LenderDepositWrapper
  - `borrowCrossChain()`: Presta USDC su qualsiasi chain via OFT

#### 2. **LenderDepositWrapper** (Tutte le chain tranne Base)
- **Ruolo**: Entry point per lender
- **OApp**: Invia messaggi a ProtocolCore
- **Funzioni**:
  - `depositCrossChain()`: Bridge USDC + invia messaggio
  - `_lzReceive()`: Riceve conferme da ProtocolCore

#### 3. **USDCOmnitoken / USDCOFTAdapter**
- **Ruolo**: Bridge USDC tra chain
- **OFT**: Lock/burn su source, mint su destination
- **Funzioni**:
  - `send()`: Bridge USDC cross-chain
  - `_lzReceive()`: Mint USDC su destination

### Esempio Completo: Deposito Cross-Chain

```solidity
// === STEP 1: Lender su Arbitrum ===
// LenderDepositWrapper.depositCrossChain(1000e6)

// === STEP 2: Wrapper prende USDC ===
usdc.transferFrom(lender, address(this), 1000e6);

// === STEP 3: Bridge USDC via OFT ===
usdcOFT.send({
    dstEid: baseEid,
    to: addressToBytes32(address(this)), // Wrapper su Base
    amountLD: 1000e6,
    ...
});

// Cosa succede:
// - Arbitrum: USDC lockato
// - Base: USDC mintato al wrapper

// === STEP 4: Invia OApp message ===
_lzSend(
    baseEid,
    abi.encode(1, lender, 1000e6, guid),
    options,
    fee,
    payable(lender)
);

// === STEP 5: ProtocolCore su Base riceve ===
function _lzReceive(...) {
    // Verifica mittente
    require(authorizedDepositWrappers[_origin.srcEid] == _origin.sender);
    
    // Decodifica
    (uint8 msgType, address lender, uint256 amount, bytes32 guid) = 
        abi.decode(_message, ...);
    
    // USDC già arrivato via OFT (nel wrapper su Base)
    // Trasferisci al ProtocolCore
    usdc.transferFrom(wrapperAddress, address(this), amount);
    
    // Processa deposito
    uint256 shares = calculateShares(amount);
    shares[lender] += shares;
    totalShares += shares;
    totalDeposits += amount;
}
```

---

## Sicurezza

### Meccanismi di Sicurezza

#### 1. **Verifica del Mittente**
```solidity
// Solo deposit wrapper autorizzati possono inviare messaggi
mapping(uint32 => bytes32) public authorizedDepositWrappers;

function _lzReceive(...) {
    require(
        authorizedDepositWrappers[_origin.srcEid] == _origin.sender,
        "Unauthorized"
    );
}
```

#### 2. **Nonce e Replay Protection**
- Ogni messaggio ha un nonce univoco
- LayerZero previene replay automaticamente
- GUID univoco per ogni messaggio

#### 3. **Slippage Protection (OFT)**
```solidity
SendParam({
    amountLD: amount,
    minAmountLD: minAmountLD,  // Protezione slippage
    ...
});
```

#### 4. **Gas Limits**
```solidity
OptionsBuilder.newOptions()
    .addExecutorLzReceiveOption(300000, 0)  // Limite gas
```

### Best Practices

1. **Sempre verificare il mittente** in `_lzReceive()`
2. **Usare nonce/GUID** per tracking e refunds
3. **Validare i dati** ricevuti nel payload
4. **Gestire errori** con try-catch e refunds
5. **Testare** su testnet prima di mainnet

---

## Riepilogo

### LayerZero V2 Fornisce:

✅ **OApp**: Messaggistica arbitraria cross-chain
✅ **OFT**: Token fungibili nativi su più chain
✅ **Sicurezza**: Oracle + Relayer separati
✅ **Efficienza**: Ultra Light Nodes, bassi costi
✅ **Flessibilità**: Messaggi personalizzati, opzioni configurabili

### Nel Tuo Progetto:

- **Lender**: Deposita da qualsiasi chain → riceve shares su Base
- **Borrower**: Deposita ETH su Base → riceve USDC su qualsiasi chain
- **USDC**: Bridge seamless via OFT
- **Messaggi**: Comunicazione sicura via OApp

### Vantaggi:

🚀 **UX Unificata**: Un'interfaccia per tutte le chain
💰 **Liquidità Aggregata**: Pool unificato su Base
🔒 **Sicuro**: Verifica decentralizzata
⚡ **Veloce**: 2-5 minuti per messaggi
💸 **Economico**: Fee basse ($0.01+)

---

## Risorse

- [LayerZero Docs](https://docs.layerzero.network/)
- [OApp Guide](https://docs.layerzero.network/v2/developers/evm-guides/lz-receive)
- [OFT Guide](https://docs.layerzero.network/v2/developers/evm-guides/oft)
- [GitHub Examples](https://github.com/LayerZero-Labs)

---

**Nota**: Questa guida si basa su LayerZero V2. Assicurati di usare la versione corretta delle librerie nel tuo progetto.

