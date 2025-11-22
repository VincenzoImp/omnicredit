# 🔨 HARDHAT 3.0.0+ - COMPLETE TECHNICAL GUIDE

**Version**: 3.0.15+ (Production Ready)  
**Date**: November 2024  
**Target**: Only Hardhat 3.0.0+ qualifies for hackathon

---

## 📋 TABLE OF CONTENTS

1. [Getting Started](#1-getting-started)
2. [Solidity Tests](#2-solidity-tests)
3. [Performance - Rust Components](#3-performance-rust-components)
4. [Multichain Support](#4-multichain-support)
5. [OP Stack Simulation](#5-op-stack-simulation)
6. [Revamped Build System](#6-revamped-build-system)
7. [CLI and Plugin System](#7-cli-and-plugin-system)
8. [Hardhat 2 vs 3 - Differences](#8-hardhat-2-vs-3-differences)
9. [Best Practices](#9-best-practices)
10. [Practical Examples](#10-practical-examples)

---

## 1. GETTING STARTED

### System Requirements

- **Node.js**: v22.10.0+ (REQUIRED)
- **npm/pnpm/yarn**: Latest version
- **OS**: Windows 10+, macOS 10.15+, Linux

### Quick Installation

```bash
# Create project
mkdir my-hardhat-project && cd my-hardhat-project

# Initialize Hardhat 3
npx hardhat --init
# Choose: TypeScript + Viem toolbox

# Verify installation
npx hardhat --version
```

### Project Structure

```
my-project/
├── hardhat.config.ts          # ESM Config (TypeScript)
├── contracts/                 # Smart contracts
│   ├── Contract.sol
│   └── Contract.t.sol        # Solidity tests
├── test/                      # TypeScript tests
│   └── Contract.ts
├── ignition/modules/          # Deployment modules
├── scripts/                   # Automation scripts
├── artifacts/                 # Build artifacts
└── cache/                     # Hardhat cache
```

### Basic Configuration

```typescript
import { defineConfig, configVariable } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

export default defineConfig({
  plugins: [hardhatToolboxViem],
  
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "shanghai",
    },
  },
  
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
});
```

### Secure Secret Management

```bash
# Install keystore
npm install --save-dev @nomicfoundation/hardhat-keystore

# Set encrypted variables
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat keystore list
```

### Essential Commands

```bash
npx hardhat build                    # Compile contracts
npx hardhat test                     # All tests
npx hardhat test solidity            # Solidity tests only
npx hardhat test --coverage          # With coverage
npx hardhat node                     # Local node
npx hardhat ignition deploy <module> # Deploy
npx hardhat verify <address>         # Verify contract
npx hardhat clean                    # Clean cache
```

---

## 2. SOLIDITY TESTS

Hardhat 3 introduces native Solidity tests compatible with Foundry - **10-100x faster** than TypeScript tests.

### Solidity Test Setup

**Install forge-std:**

```bash
npm install --save-dev github:foundry-rs/forge-std#v1.9.7
```

### Complete Test Example

```solidity
// contracts/Token.t.sol
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
import { Token } from "./Token.sol";

contract TokenTest is Test {
    Token token;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    
    function setUp() public {
        token = new Token("MyToken", "MTK", 1_000_000 * 10**18);
        token.transfer(alice, 1000 * 10**18);
    }
    
    // Basic test
    function test_InitialSupply() public view {
        assertEq(token.totalSupply(), 1_000_000 * 10**18);
    }
    
    // Transfer test
    function test_Transfer() public {
        uint256 amount = 100 * 10**18;
        
        vm.prank(alice);
        token.transfer(bob, amount);
        
        assertEq(token.balanceOf(bob), amount);
    }
    
    // Revert test
    function test_RevertWhenInsufficientBalance() public {
        vm.prank(alice);
        vm.expectRevert("Insufficient balance");
        token.transfer(bob, 10000 * 10**18);
    }
    
    // Event test
    function test_EmitsTransferEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Transfer(alice, bob, 100);
        
        vm.prank(alice);
        token.transfer(bob, 100);
    }
    
    // Fuzz test
    function testFuzz_Transfer(uint256 amount) public {
        uint256 balance = token.balanceOf(alice);
        vm.assume(amount <= balance);
        vm.assume(amount > 0);
        
        vm.prank(alice);
        token.transfer(bob, amount);
        
        assertEq(token.balanceOf(alice), balance - amount);
    }
    
    event Transfer(address indexed from, address indexed to, uint256 value);
}
```

### Key Cheatcodes

```solidity
// State manipulation
vm.prank(address);              // Change msg.sender for one call
vm.startPrank(address);         // Change msg.sender persistently
vm.deal(address, uint);         // Set ETH balance
vm.warp(uint);                  // Set block.timestamp
vm.roll(uint);                  // Set block.number

// Testing
vm.expectRevert();              // Expect revert
vm.expectEmit(bool,bool,bool,bool); // Expect event
vm.expectCall(address, bytes); // Expect call

// Mocking
vm.mockCall(address, bytes, bytes);
vm.clearMockedCalls();

// Snapshot
uint256 id = vm.snapshot();
vm.revertTo(id);
```

### Assertions

```solidity
// Equality
assertEq(uint a, uint b);
assertEq(address a, address b);
assertTrue(bool);
assertFalse(bool);

// Comparison
assertGt(uint a, uint b);  // Greater than
assertGe(uint a, uint b);  // Greater or equal
assertLt(uint a, uint b);  // Less than
assertLe(uint a, uint b);  // Less or equal

// Approximate
assertApproxEqAbs(uint a, uint b, uint maxDelta);
assertApproxEqRel(uint a, uint b, uint maxPercentDelta);
```

### Running Tests

```bash
npx hardhat test solidity           # Solidity tests only
npx hardhat test                    # All tests
npx hardhat test --coverage         # With coverage
REPORT_GAS=true npx hardhat test    # Gas reporting
```

### Best Practices

1. **Naming**: `test_FunctionName`, `testFuzz_Function`, `test_RevertWhen_Condition`
2. **Organize**: Group tests by functionality
3. **Use setUp()**: Common setup for all tests
4. **vm.assume()**: Filter invalid inputs in fuzz tests
5. **Test Edge Cases**: Zero values, max values, boundaries

---

## 3. PERFORMANCE - RUST COMPONENTS

### EDR (Ethereum Development Runtime)

Hardhat 3 rewrites the core in Rust for **2-10x performance improvement**.

**Rust Components:**
- **Blockchain Simulation Layer** - State, mining, transactions
- **EVM Execution** - Via revm (Rust EVM)
- **Observability** - Stack traces, console.log, errors
- **Network Protocol** - JSON-RPC, WebSocket

### Performance Improvements

| Scenario | Hardhat 2 | Hardhat 3 | Improvement |
|----------|-----------|-----------|-------------|
| ERC-20 Test Suite | 8m 14s | 2m 23s | **70% faster** |
| Parallel Tests (7 workers) | Not supported | 2m 23s | **N/A** |
| CI/CD (2 cores) | Baseline | 35% faster | **35%** |

### Build Profiles

```typescript
solidity: {
  profiles: {
    default: {
      version: "0.8.28",
      settings: { optimizer: { enabled: false } }
    },
    production: {
      version: "0.8.28",
      isolated: true,
      settings: {
        optimizer: { enabled: true, runs: 200 },
        viaIR: true,
        metadata: { bytecodeHash: "none" }
      }
    },
    gasOptimized: {
      version: "0.8.28",
      settings: {
        optimizer: { enabled: true, runs: 10000 },
        viaIR: true
      }
    }
  }
}
```

**Usage:**

```bash
npx hardhat build --build-profile production
```

### Isolated Builds

```typescript
solidity: {
  version: "0.8.28",
  isolated: true,  // Each contract compiled independently
}
```

**Benefits:**
- Reproducible builds
- Simplified contract verification
- Cleaner artifacts

---

## 4. MULTICHAIN SUPPORT

Hardhat 3 supports **multiple chain types simultaneously**.

### Chain Types

1. **`l1`** - Ethereum Mainnet and L1 chains
2. **`op`** - OP Stack (Optimism, Base, etc.)
3. **`generic`** - Fallback for other chains

### Multichain Configuration

```typescript
networks: {
  // Simulated
  hardhatMainnet: {
    type: "edr-simulated",
    chainType: "l1",
  },
  hardhatOp: {
    type: "edr-simulated",
    chainType: "op",
  },
  
  // Testnets
  sepolia: {
    type: "http",
    chainType: "l1",
    url: configVariable("SEPOLIA_RPC_URL"),
    accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    chainId: 11155111,
  },
  optimismSepolia: {
    type: "http",
    chainType: "op",
    url: configVariable("OPTIMISM_SEPOLIA_RPC_URL"),
    accounts: [configVariable("OPTIMISM_PRIVATE_KEY")],
    chainId: 11155420,
  },
  baseSepolia: {
    type: "http",
    chainType: "op",
    url: configVariable("BASE_SEPOLIA_RPC_URL"),
    accounts: [configVariable("BASE_PRIVATE_KEY")],
    chainId: 84532,
  },
  
  // Mainnets
  optimism: {
    type: "http",
    chainType: "op",
    url: configVariable("OPTIMISM_RPC_URL"),
    accounts: [configVariable("OPTIMISM_PRIVATE_KEY")],
    chainId: 10,
  },
  base: {
    type: "http",
    chainType: "op",
    url: configVariable("BASE_RPC_URL"),
    accounts: [configVariable("BASE_PRIVATE_KEY")],
    chainId: 8453,
  },
}
```

### Multiple Connections

```typescript
import { network } from "hardhat";

// Connect to L1
const { viem: l1Viem } = await network.connect({ network: "sepolia" });

// Connect to L2
const { viem: l2Viem } = await network.connect({ network: "optimismSepolia" });

// Deploy on both
const l1Contract = await l1Viem.deployContract("L1Bridge");
const l2Contract = await l2Viem.deployContract("L2Bridge", [l1Contract.address]);
```

### Multichain Deployment

```typescript
const NETWORKS = ["sepolia", "optimismSepolia", "baseSepolia"];

for (const net of NETWORKS) {
  const connection = await network.connect({ network: net });
  const { viem } = connection;
  const contract = await viem.deployContract("MyContract");
  console.log(`${net}: ${contract.address}`);
}
```

---

## 5. OP STACK SIMULATION

### OP Stack Features

When `chainType: "op"`, Hardhat simulates:

1. **L1 Data Fees** - L1 data availability fee
2. **Predeploys** - OP Stack predeploy contracts
3. **Gas Calculations** - L2 execution fee + L1 security fee
4. **EVM Equivalence** - OVM-compliant behavior

### Gas Fee Structure

```javascript
L2_execution_fee = (L2_base_fee + L2_priority_fee) * L2_gas_used
L1_data_fee = L1_gas_price * (tx_data_gas + fixed_overhead) * dynamic_overhead
total_fee = L2_execution_fee + L1_data_fee
```

### OP Stack Script Example

```typescript
import { network } from "hardhat";

const { viem } = await network.connect({ network: "hardhatOp" });

// Deploy on simulated OP Stack
const counter = await viem.deployContract("Counter");

// Transaction
const tx = await counter.write.incBy([5n]);
const receipt = await viem.getPublicClient().getTransactionReceipt({ hash: tx });

console.log("Gas Used:", receipt.gasUsed);
console.log("L1 Fee:", receipt.l1Fee);  // OP Stack-specific field
console.log("L1 Gas Used:", receipt.l1GasUsed);
```

### OP Stack Tests

```typescript
describe("OP Stack features", async () => {
  it("should calculate L1 data fees", async () => {
    const { viem } = await network.connect({ network: "hardhatOp" });
    const contract = await viem.deployContract("Counter");
    
    const tx = await contract.write.increment();
    const receipt = await viem.getPublicClient().getTransactionReceipt({ hash: tx });
    
    // Verify L1 fee present
    assert.ok(receipt.l1Fee > 0n);
    
    // L1 fee typically > L2 execution fee
    const l2Fee = receipt.gasUsed * receipt.effectiveGasPrice;
    assert.ok(receipt.l1Fee > l2Fee);
  });
});
```

### Predeploy Contracts

```typescript
const OP_PREDEPLOYS = {
  L2ToL1MessagePasser: "0x4200000000000000000000000000000000000016",
  L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
  L2StandardBridge: "0x4200000000000000000000000000000000000010",
  GasPriceOracle: "0x420000000000000000000000000000000000000F",
};
```

### Gas Optimization for OP Stack

```solidity
// BAD: Large calldata = High L1 fee
function badBatch(address[] memory addrs, uint256[] memory amounts) external {
    for (uint i = 0; i < addrs.length; i++) {
        token.transfer(addrs[i], amounts[i]);
    }
}

// GOOD: Compressed calldata
function goodBatch(bytes calldata compressedData) external {
    // Decompress and process
    // Save on L1 data fee
}
```

---

## 6. REVAMPED BUILD SYSTEM

### Build Profiles

```typescript
solidity: {
  profiles: {
    default: {
      version: "0.8.28",
      settings: { optimizer: { enabled: false } }
    },
    production: {
      version: "0.8.28",
      isolated: true,
      settings: {
        optimizer: { enabled: true, runs: 200 },
        viaIR: true,
      }
    }
  }
}
```

### Isolated Builds

```typescript
solidity: {
  version: "0.8.28",
  isolated: true,  // Reproducible builds
}
```

### Incremental Compilation

```bash
npx hardhat build              # Only modified files
npx hardhat build --force      # Force all
npx hardhat clean              # Clean cache
```

### Multiple Solidity Versions

```typescript
solidity: {
  compilers: [
    { version: "0.8.28" },
    { version: "0.8.20" },
    { version: "0.7.6" },
  ],
  overrides: {
    "contracts/legacy/Old.sol": {
      version: "0.7.6",
      settings: { optimizer: { enabled: false } }
    }
  }
}
```

### Optimizer Settings

```typescript
optimizer: {
  enabled: true,
  runs: 200,  // 1=min deployment, 200=balanced, 10000=min runtime
}
```

---

## 7. CLI AND PLUGIN SYSTEM

### New CLI Commands

```bash
# Build (was "compile")
npx hardhat build
npx hardhat build --force
npx hardhat build --build-profile production

# Ignition
npx hardhat ignition deploy <module>
npx hardhat ignition status <deploymentId>
npx hardhat ignition verify <deploymentId>
npx hardhat ignition visualize <module>

# Keystore
npx hardhat keystore set <VAR>
npx hardhat keystore get <VAR>
npx hardhat keystore list
npx hardhat keystore delete <VAR>
npx hardhat keystore change-password

# Test
npx hardhat test
npx hardhat test solidity
npx hardhat test --coverage
```

### Hook-Based Plugin System

```typescript
import type { HardhatPlugin } from "hardhat/types/plugins";

const myPlugin: HardhatPlugin = {
  id: "hardhat-my-plugin",
  
  hookHandlers: {
    "hardhat:network": networkHooks,
    "hardhat:config": configHooks,
  },
  
  tasks: [
    {
      name: "my-task",
      description: "Custom task",
      async action(args, hre) {
        // Implementation
      }
    }
  ],
  
  dependencies: [],
};

export default myPlugin;
```

### Official Plugins

```bash
# Toolbox plugins
npm install --save-dev @nomicfoundation/hardhat-toolbox-viem
npm install --save-dev @nomicfoundation/hardhat-toolbox-mocha-ethers

# Core plugins
npm install --save-dev @nomicfoundation/hardhat-ignition-viem
npm install --save-dev @nomicfoundation/hardhat-verify
npm install --save-dev @nomicfoundation/hardhat-keystore
npm install --save-dev @nomicfoundation/hardhat-network-helpers
```

### Using Plugins

```typescript
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import myPlugin from "hardhat-my-plugin";

export default defineConfig({
  plugins: [hardhatToolboxViem, myPlugin],  // Explicit declaration
  myPlugin: { setting: "value" },
});
```

---

## 8. HARDHAT 2 VS 3 - DIFFERENCES

### Main Breaking Changes

| Feature | Hardhat 2 | Hardhat 3 |
|---------|-----------|-----------|
| **Node.js** | v14+ | v22.10+ (REQUIRED) |
| **Config** | CommonJS | ESM (TypeScript) |
| **Plugins** | Side-effect import | Explicit declaration |
| **Network** | Global connection | Explicit connections |
| **Command** | `compile` | `build` |
| **Solidity Tests** | Not supported | Foundry-compatible |
| **Runtime** | JavaScript | Rust (EDR) |
| **Coverage** | Plugin | Built-in |
| **Chain Types** | Ethereum only | L1, OP, generic |

### Step-by-Step Migration

**1. Upgrade Node.js**

```bash
node --version  # Must be >= 22.10.0
nvm install 22
nvm use 22
```

**2. Clean Hardhat 2**

```bash
npx hardhat clean
# Remove all hardhat-* dependencies from package.json
```

**3. Enable ESM**

```json
// package.json
{
  "type": "module"
}
```

**4. Install Hardhat 3**

```bash
npm install --save-dev hardhat
npm install --save-dev @nomicfoundation/hardhat-toolbox-viem
```

**5. Convert Config**

```typescript
// From hardhat.config.js (CommonJS)
const { task } = require("hardhat/config");
require("@nomiclabs/hardhat-waffle");
module.exports = { solidity: "0.8.20" };

// To hardhat.config.ts (ESM)
import { defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: "0.8.20"
});
```

**6. Update Tests**

```typescript
// From (Hardhat 2)
const { expect } = require("chai");
const { ethers } = require("hardhat");

// To (Hardhat 3)
import { expect } from "chai";
import { network } from "hardhat";
const { ethers } = await network.connect();
```

**7. Update Commands**

```bash
# Hardhat 2 → Hardhat 3
npx hardhat compile → npx hardhat build
npx hardhat init → npx hardhat --init
```

### API Changes

**Network Connection:**

```typescript
// Hardhat 2
const provider = hre.ethers.provider;

// Hardhat 3
const connection = await network.connect();
const provider = connection.provider;
```

**Chai Matchers:**

```typescript
// Hardhat 2
await expect(tx).to.be.reverted;

// Hardhat 3
await expect(tx).to.revert(ethers);
await expect(tx).to.changeEtherBalance(ethers, account, amount);
```

### Configuration Changes

```typescript
// Hardhat 2
networks: {
  hardhat: {},
  mainnet: { url: "..." }
}

// Hardhat 3
networks: {
  hardhat: {
    type: "edr-simulated",
    chainType: "l1"
  },
  mainnet: {
    type: "http",
    chainType: "l1",
    url: configVariable("MAINNET_RPC_URL")
  }
}
```

---

## 9. BEST PRACTICES

### Optimal Project Structure

```
project/
├── hardhat.config.ts
├── contracts/
│   ├── src/              # Main contracts
│   ├── test/             # Solidity unit tests
│   │   └── *.t.sol
│   ├── interfaces/
│   └── libraries/
├── test/                 # TypeScript integration tests
│   ├── unit/
│   ├── integration/
│   └── fixtures.ts
├── ignition/modules/     # Deployment
├── scripts/              # Automation
└── docs/                 # Documentation
```

### Testing Strategy

**Use Case Matrix:**

| Type | Tool | Speed | Use For |
|------|------|-------|---------|
| Unit Tests | Solidity (.t.sol) | 10-100x | Single functions, fuzz |
| Integration | TypeScript | 1x | Multi-contract, E2E |
| Fork Tests | TypeScript | Slow | Mainnet state |

**Example:**

```solidity
// contracts/Token.t.sol - Unit tests
contract TokenTest is Test {
    function test_Transfer() public { }
    function testFuzz_Transfer(uint256 amt) public { }
}
```

```typescript
// test/TokenIntegration.ts - Integration
describe("Token Integration", () => {
  it("should handle complex workflow", async () => {
    // Multi-step scenario
  });
});
```

### Security Best Practices

1. **Secret Management**

```bash
# USE keystore, NOT .env in production
npx hardhat keystore set PRIVATE_KEY
npx hardhat keystore set API_KEY
```

2. **100% Test Coverage**

```bash
npx hardhat test --coverage
# Target: 100% coverage statements, branches, functions
```

3. **Slither Analysis**

```bash
pip install slither-analyzer
slither contracts/
```

4. **Gas Optimization**

```bash
REPORT_GAS=true npx hardhat test
```

5. **Contract Verification**

```bash
npx hardhat verify --network mainnet <address> <args>
```

### Deployment Best Practices

**1. Complete Test Flow:**

```bash
# 1. Local test
npx hardhat test --coverage

# 2. Local deploy
npx hardhat node  # Terminal 1
npx hardhat ignition deploy ignition/modules/Token.ts --network localhost  # Terminal 2

# 3. Testnet deploy
npx hardhat ignition deploy ignition/modules/Token.ts --network sepolia

# 4. Verify
npx hardhat verify --network sepolia <address>

# 5. Mainnet deploy (with keystore)
npx hardhat ignition deploy ignition/modules/Token.ts --network mainnet --verify
```

**2. Use Build Profiles:**

```bash
# Development
npx hardhat build  # Fast, no optimizer

# Production
npx hardhat build --build-profile production  # Optimized, isolated
```

**3. Multi-sig for Admin:**

```solidity
// Use Gnosis Safe for critical operations
contract MyContract is Ownable {
    constructor(address gnosisSafe) {
        transferOwnership(gnosisSafe);
    }
}
```

### Gas Optimization Patterns

```solidity
// 1. Pack storage variables
struct User {
    address owner;       // 20 bytes
    uint88 balance;      // 11 bytes  
    bool isActive;       // 1 byte
}  // Total: 32 bytes = 1 slot

// 2. Use calldata for external
function process(uint[] calldata data) external {
    // Cheaper than memory
}

// 3. Cache storage reads
function example() public view returns (uint) {
    uint cached = storageVar;  // Read once
    return cached + cached + cached;
}

// 4. Use unchecked for safe math
function increment(uint x) public pure returns (uint) {
    unchecked { return x + 1; }  // Save gas if no overflow
}

// 5. Short-circuit conditions
require(cheap() && expensive());  // expensive() not called if cheap() false
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Hardhat Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js 22
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run Hardhat tests
        run: npx hardhat test
      
      - name: Run coverage
        run: npx hardhat test --coverage
      
      - name: Check coverage threshold
        run: |
          npx istanbul check-coverage \
            --statements 90 \
            --branches 90 \
            --functions 90
```

---

## 10. PRACTICAL EXAMPLES

### Example 1: Complete ERC-20 Token

**Contract:**

```solidity
// contracts/MyToken.sol
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000 * 10**18;
    
    constructor() ERC20("MyToken", "MTK") Ownable(msg.sender) {
        _mint(msg.sender, MAX_SUPPLY);
    }
    
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
```

**Solidity Test:**

```solidity
// contracts/MyToken.t.sol
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { MyToken } from "./MyToken.sol";

contract MyTokenTest is Test {
    MyToken token;
    address alice = makeAddr("alice");
    
    function setUp() public {
        token = new MyToken();
        token.transfer(alice, 1000 * 10**18);
    }
    
    function test_InitialSupply() public view {
        assertEq(token.totalSupply(), token.MAX_SUPPLY());
    }
    
    function test_Transfer() public {
        vm.prank(alice);
        token.transfer(address(this), 100 * 10**18);
        assertEq(token.balanceOf(address(this)), token.MAX_SUPPLY() - 900 * 10**18);
    }
    
    function testFuzz_Burn(uint256 amount) public {
        uint256 balance = token.balanceOf(alice);
        vm.assume(amount <= balance);
        
        vm.prank(alice);
        token.burn(amount);
        
        assertEq(token.balanceOf(alice), balance - amount);
        assertEq(token.totalSupply(), token.MAX_SUPPLY() - amount);
    }
}
```

**TypeScript Test:**

```typescript
// test/MyToken.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

describe("MyToken Integration", async () => {
  async function deployFixture() {
    const { viem } = await network.connect();
    const token = await viem.deployContract("MyToken");
    const [owner, user] = await viem.getWalletClients();
    return { token, owner, user };
  }
  
  it("Should transfer tokens", async () => {
    const { token, owner, user } = await deployFixture();
    
    await token.write.transfer([user.account.address, 1000n * 10n**18n]);
    
    const balance = await token.read.balanceOf([user.account.address]);
    assert.equal(balance, 1000n * 10n**18n);
  });
});
```

**Deployment:**

```typescript
// ignition/modules/MyToken.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MyTokenModule", (m) => {
  const token = m.contract("MyToken");
  return { token };
});
```

**Deploy:**

```bash
# Local
npx hardhat node
npx hardhat ignition deploy ignition/modules/MyToken.ts --network localhost

# Testnet
npx hardhat ignition deploy ignition/modules/MyToken.ts --network sepolia --verify

# Mainnet
npx hardhat ignition deploy ignition/modules/MyToken.ts --network mainnet --verify
```

### Example 2: NFT Collection with Whitelist

```solidity
// contracts/NFT.sol
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract MyNFT is ERC721, Ownable {
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public constant MINT_PRICE = 0.05 ether;
    uint256 public totalMinted;
    bytes32 public merkleRoot;
    mapping(address => bool) public hasMinted;
    
    constructor(bytes32 _merkleRoot) 
        ERC721("MyNFT", "MNFT") 
        Ownable(msg.sender) 
    {
        merkleRoot = _merkleRoot;
    }
    
    function whitelistMint(bytes32[] calldata proof) external payable {
        require(!hasMinted[msg.sender], "Already minted");
        require(totalMinted < MAX_SUPPLY, "Sold out");
        require(msg.value >= MINT_PRICE, "Insufficient payment");
        
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "Not whitelisted");
        
        hasMinted[msg.sender] = true;
        totalMinted++;
        _mint(msg.sender, totalMinted);
    }
    
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
```

**Test:**

```solidity
// contracts/NFT.t.sol
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { MyNFT } from "./NFT.sol";
import { Merkle } from "murky/Merkle.sol";

contract NFTTest is Test {
    MyNFT nft;
    Merkle merkle;
    bytes32 root;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    
    function setUp() public {
        merkle = new Merkle();
        
        bytes32[] memory leaves = new bytes32[](2);
        leaves[0] = keccak256(abi.encodePacked(alice));
        leaves[1] = keccak256(abi.encodePacked(bob));
        
        root = merkle.getRoot(leaves);
        nft = new MyNFT(root);
        
        vm.deal(alice, 1 ether);
        vm.deal(bob, 1 ether);
    }
    
    function test_WhitelistMint() public {
        bytes32[] memory proof = merkle.getProof(
            [keccak256(abi.encodePacked(alice)), keccak256(abi.encodePacked(bob))],
            0
        );
        
        vm.prank(alice);
        nft.whitelistMint{value: 0.05 ether}(proof);
        
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.totalMinted(), 1);
    }
    
    function test_RevertWhenNotWhitelisted() public {
        address notWhitelisted = makeAddr("notWhitelisted");
        vm.deal(notWhitelisted, 1 ether);
        
        bytes32[] memory emptyProof = new bytes32[](0);
        
        vm.prank(notWhitelisted);
        vm.expectRevert("Not whitelisted");
        nft.whitelistMint{value: 0.05 ether}(emptyProof);
    }
}
```

### Example 3: DeFi Vault

```solidity
// contracts/Vault.sol
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Vault is ERC20 {
    IERC20 public immutable asset;
    
    constructor(IERC20 _asset) ERC20("Vault Token", "vTKN") {
        asset = _asset;
    }
    
    function deposit(uint256 amount) external returns (uint256 shares) {
        uint256 totalAssets = asset.balanceOf(address(this));
        uint256 totalShares = totalSupply();
        
        if (totalShares == 0) {
            shares = amount;
        } else {
            shares = (amount * totalShares) / totalAssets;
        }
        
        asset.transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, shares);
    }
    
    function withdraw(uint256 shares) external returns (uint256 amount) {
        uint256 totalAssets = asset.balanceOf(address(this));
        amount = (shares * totalAssets) / totalSupply();
        
        _burn(msg.sender, shares);
        asset.transfer(msg.sender, amount);
    }
}
```

### Example 4: Cross-Chain Bridge (L1-L2)

```typescript
// scripts/bridge-demo.ts
import { network } from "hardhat";

async function main() {
  // Connect L1
  const { viem: l1Viem } = await network.connect({ network: "sepolia" });
  
  // Connect L2
  const { viem: l2Viem } = await network.connect({ network: "optimismSepolia" });
  
  // Deploy L1 contract
  console.log("Deploying L1 contract...");
  const l1Bridge = await l1Viem.deployContract("L1Bridge");
  console.log("L1 Bridge:", l1Bridge.address);
  
  // Deploy L2 contract
  console.log("Deploying L2 contract...");
  const l2Bridge = await l2Viem.deployContract("L2Bridge", [l1Bridge.address]);
  console.log("L2 Bridge:", l2Bridge.address);
  
  // Configure bridges
  await l1Bridge.write.setL2Bridge([l2Bridge.address]);
  await l2Bridge.write.setL1Bridge([l1Bridge.address]);
  
  console.log("Bridge setup complete!");
}

main().catch(console.error);
```

### Example 5: Upgrade Pattern (UUPS)

```solidity
// contracts/MyContractV1.sol
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract MyContractV1 is UUPSUpgradeable, OwnableUpgradeable {
    uint256 public value;
    
    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
    }
    
    function setValue(uint256 _value) external {
        value = _value;
    }
    
    function _authorizeUpgrade(address) internal override onlyOwner {}
}

// contracts/MyContractV2.sol
contract MyContractV2 is MyContractV1 {
    uint256 public newFeature;
    
    function setNewFeature(uint256 _value) external {
        newFeature = _value;
    }
}
```

---

## 📚 OFFICIAL RESOURCES

### Documentation

- [Hardhat Docs](https://hardhat.org/docs)
- [Getting Started](https://hardhat.org/docs/getting-started)
- [Configuration](https://hardhat.org/docs/reference/configuration)
- [What's New in Hardhat 3](https://hardhat.org/docs/hardhat3/whats-new)
- [Migration Guide](https://hardhat.org/docs/migrate-from-hardhat2)

### Repository

- [GitHub Hardhat](https://github.com/NomicFoundation/hardhat)
- [Releases](https://github.com/NomicFoundation/hardhat/releases)
- [Changelog](https://github.com/NomicFoundation/hardhat/blob/main/CHANGELOG.md)

### Community

- [Discord](https://hardhat.org/discord)
- [Telegram Beta Group](https://hardhat.org/hardhat3-beta-telegram-group)
- [Twitter](https://twitter.com/HardhatHQ)

### Tools

- [Hardhat VSCode Extension](https://marketplace.visualstudio.com/items?itemName=NomicFoundation.hardhat-solidity)
- [Hardhat Network Helpers](https://hardhat.org/hardhat-network-helpers)
- [Hardhat Ignition](https://hardhat.org/ignition)

---

## 🎯 QUICK REFERENCE

### Quick Setup

```bash
mkdir project && cd project
npx hardhat --init
npm install --save-dev @nomicfoundation/hardhat-toolbox-viem
npx hardhat build
npx hardhat test
```

### Essential Commands

```bash
npx hardhat build                    # Compile
npx hardhat test                     # Test
npx hardhat test --coverage          # Coverage
npx hardhat node                     # Local node
npx hardhat ignition deploy <module> # Deploy
npx hardhat verify <address>         # Verify
```

### Minimal Config

```typescript
import { defineConfig } from "hardhat/config";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: "0.8.28",
});
```

---

## ✅ HACKATHON CHECKLIST

**Initial Setup:**
- [ ] Node.js v22.10.0+
- [ ] Hardhat 3.0.15+
- [ ] Toolbox plugin installed
- [ ] Keystore configured

**Development:**
- [ ] Solidity contracts written
- [ ] Solidity tests (.t.sol) - 100% coverage
- [ ] TypeScript integration tests
- [ ] Gas optimization verified
- [ ] Slither analysis passed

**Deployment:**
- [ ] Production build profile configured
- [ ] Testnet deployment successful
- [ ] Contracts verified on explorer
- [ ] Multichain if applicable
- [ ] Complete documentation

**Security:**
- [ ] No secrets in git
- [ ] Keystore for production
- [ ] Multi-sig for admin functions
- [ ] Audit completed

---

**End of Complete Hardhat 3.0.0+ Technical README**

---

This README provides all the knowledge needed to win the hackathon with Hardhat 3! 🏆
