# Testing con MockUSDC

## 📋 Panoramica

Per facilitare il testing del protocollo senza dover acquistare USDC reale, puoi usare `MockUSDC` - un token ERC20 che simula USDC ma può essere mintato gratuitamente.

---

## 🎯 MockUSDC

### Caratteristiche

- ✅ **6 decimals** (come USDC reale)
- ✅ **Minting gratuito** per testing
- ✅ **Stessa interfaccia** di USDC reale
- ✅ **Compatibile** con ProtocolCore
- ⚠️ **SOLO PER TESTING** - Non usare in produzione!

### Deployment

```solidity
// Deploy MockUSDC
MockUSDC mockUSDC = new MockUSDC("Mock USDC", "mUSDC");

// Mint tokens per testing
mockUSDC.mint(user1, 10000e6);  // 10,000 USDC
mockUSDC.mint(user2, 5000e6);   // 5,000 USDC
```

### Funzioni Utili

```solidity
// Mint standard
mockUSDC.mint(to, amount);

// Mint in USD (converte automaticamente)
mockUSDC.mintUSD(to, 1000);  // Minta 1000e6 (1000 USDC)

// Mint batch (a più utenti)
address[] memory users = [user1, user2, user3];
uint256[] memory amounts = [1000e6, 2000e6, 3000e6];
mockUSDC.mintBatch(users, amounts);

// Burn (se necessario)
mockUSDC.burn(amount);
```

---

## 🔄 MockOFT (per Cross-Chain Testing)

Se vuoi testare anche la funzionalità cross-chain, usa `MockOFT` invece di `USDCOmnitoken`.

### Caratteristiche

- ✅ **6 decimals** (come USDC)
- ✅ **Minting gratuito** per testing
- ✅ **Full OFT functionality** per cross-chain
- ✅ **Compatibile** con LayerZero V2
- ⚠️ **SOLO PER TESTING**

### Deployment

```solidity
// Deploy su ogni chain di test
MockOFT mockOFT = new MockOFT(
    "Mock Omnichain USDC",
    "mUSDC",
    lzEndpoint,  // LayerZero endpoint
    delegate     // Delegate address
);

// Configura peers tra chain
mockOFT.setPeer(dstEid, peerAddress);

// Mint per testing
mockOFT.mint(user, 10000e6);
```

---

## 📝 Esempio di Setup Completo

### 1. Deploy MockUSDC

```solidity
// Deploy MockUSDC
MockUSDC mockUSDC = new MockUSDC("Mock USDC", "mUSDC");

// Mint a test accounts
address lender1 = 0x...;
address lender2 = 0x...;
address borrower = 0x...;

mockUSDC.mintUSD(lender1, 10000);  // 10,000 USDC
mockUSDC.mintUSD(lender2, 5000);   // 5,000 USDC
mockUSDC.mintUSD(borrower, 1000);  // 1,000 USDC (per repay)
```

### 2. Deploy ProtocolCore con MockUSDC

```solidity
ProtocolCore protocol = new ProtocolCore(
    address(mockUSDC),      // lendingToken = MockUSDC
    address(creditScore),
    address(feeBasedLimits),
    address(priceOracle),
    lzEndpoint,
    delegate
);
```

### 3. Test Deposits

```solidity
// Lender approva e deposita
mockUSDC.approve(address(protocol), 1000e6);
protocol.deposit(1000e6);

// Verifica shares
uint256 shares = protocol.shares(lender1);
console.log("Shares:", shares);
```

### 4. Test Borrowing

```solidity
// Borrower deposita ETH collateral
protocol.depositCollateral{value: 1 ether}();

// Borrower prende prestito
protocol.borrow(500e6);

// Borrower ripaga
mockUSDC.approve(address(protocol), 550e6); // Principal + interest
protocol.repay(550e6);
```

---

## 🔗 Testing Cross-Chain con MockOFT

### Setup Multi-Chain

```solidity
// Chain 1 (Base Sepolia)
MockOFT mockOFTBase = new MockOFT("Mock USDC", "mUSDC", lzEndpointBase, delegate);
mockOFTBase.setPeer(arbitrumEid, address(mockOFTArb));

// Chain 2 (Arbitrum Sepolia)
MockOFT mockOFTArb = new MockOFT("Mock USDC", "mUSDC", lzEndpointArb, delegate);
mockOFTArb.setPeer(baseEid, address(mockOFTBase));

// Mint su entrambe le chain
mockOFTBase.mint(lender, 10000e6);
mockOFTArb.mint(lender, 10000e6);
```

### Test Cross-Chain Deposit

```solidity
// Su Arbitrum: Lender deposita cross-chain
LenderDepositWrapper wrapper = LenderDepositWrapper(...);
mockOFTArb.approve(address(wrapper), 1000e6);
wrapper.depositCrossChain(1000e6, 990e6); // minAmountLD con slippage

// Su Base: ProtocolCore riceve e processa
// (automatico via LayerZero)
```

---

## ⚠️ Avvertenze

### ⛔ NON USARE IN PRODUZIONE

- `MockUSDC` e `MockOFT` permettono minting illimitato
- Non hanno valore reale
- Non sono sicuri per produzione
- Usa solo per testing locale/testnet

### ✅ Quando Usare

- ✅ Testing locale (Hardhat, Foundry)
- ✅ Testnet deployment
- ✅ Development environment
- ✅ Integration tests

### ❌ Quando NON Usare

- ❌ Mainnet deployment
- ❌ Production environment
- ❌ Con valore reale

---

## 🧪 Esempi di Test

### Test Hardhat

```typescript
import { ethers } from "hardhat";

describe("ProtocolCore with MockUSDC", () => {
  let mockUSDC: MockUSDC;
  let protocol: ProtocolCore;
  let lender: Signer;

  beforeEach(async () => {
    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUSDC = await MockUSDC.deploy("Mock USDC", "mUSDC");

    // Mint to lender
    await mockUSDC.mintUSD(await lender.getAddress(), 10000);

    // Deploy ProtocolCore
    const ProtocolCore = await ethers.getContractFactory("ProtocolCore");
    protocol = await ProtocolCore.deploy(
      await mockUSDC.getAddress(),
      creditScoreAddress,
      feeBasedLimitsAddress,
      priceOracleAddress,
      lzEndpointAddress,
      delegateAddress
    );
  });

  it("Should allow lender to deposit", async () => {
    await mockUSDC.connect(lender).approve(await protocol.getAddress(), 1000e6);
    await protocol.connect(lender).deposit(1000e6);
    
    const shares = await protocol.shares(await lender.getAddress());
    expect(shares).to.be.gt(0);
  });
});
```

### Test Foundry

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/mocks/MockUSDC.sol";
import "../contracts/base/ProtocolCore.sol";

contract ProtocolCoreTest is Test {
    MockUSDC public mockUSDC;
    ProtocolCore public protocol;
    address public lender = address(0x1);

    function setUp() public {
        // Deploy MockUSDC
        mockUSDC = new MockUSDC("Mock USDC", "mUSDC");
        
        // Mint to lender
        mockUSDC.mintUSD(lender, 10000);
        
        // Deploy ProtocolCore
        protocol = new ProtocolCore(
            address(mockUSDC),
            address(creditScore),
            address(feeBasedLimits),
            address(priceOracle),
            address(lzEndpoint),
            address(delegate)
        );
    }

    function testDeposit() public {
        vm.prank(lender);
        mockUSDC.approve(address(protocol), 1000e6);
        
        vm.prank(lender);
        protocol.deposit(1000e6);
        
        uint256 shares = protocol.shares(lender);
        assertGt(shares, 0);
    }
}
```

---

## 📊 Confronto MockUSDC vs USDC Reale

| Feature | MockUSDC | USDC Reale |
|---------|----------|------------|
| Decimals | 6 | 6 |
| Minting | ✅ Gratuito | ❌ Solo da Circle |
| Value | $0 | $1 per token |
| Testing | ✅ Perfetto | ⚠️ Richiede acquisto |
| Production | ❌ NO | ✅ Sì |
| Costo | Gratis | ~$1 per token |

---

## 🚀 Quick Start

1. **Deploy MockUSDC**:
   ```bash
   npx hardhat run scripts/deploy-mock-usdc.ts
   ```

2. **Mint per testing**:
   ```typescript
   await mockUSDC.mintUSD(lender, 10000);
   ```

3. **Usa in ProtocolCore**:
   ```typescript
   const protocol = await deployProtocolCore(mockUSDC.address);
   ```

4. **Test tutti i flussi** senza spendere USDC reale!

---

## 📝 Note

- MockUSDC è identico a USDC reale per quanto riguarda l'interfaccia
- Tutti i test funzioneranno esattamente come con USDC reale
- Per mainnet, sostituisci semplicemente MockUSDC con USDC reale
- MockOFT può essere usato per testare cross-chain senza costi reali

---

**Happy Testing! 🎉**

