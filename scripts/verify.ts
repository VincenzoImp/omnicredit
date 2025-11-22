import { ethers } from "hardhat";
import { getNetworkConfig } from "./config/networks";
import { Contract } from "ethers";

/**
 * Deployment Verification Script
 *
 * This script validates that all contracts are properly deployed and configured.
 * It performs comprehensive checks to ensure the protocol is ready for use.
 *
 * Usage: npx hardhat run scripts/verify.ts --network <network-name>
 */

interface VerificationResult {
  passed: boolean;
  message: string;
  details?: any;
}

class DeploymentVerifier {
  private results: VerificationResult[] = [];
  private networkName: string;
  private config: any;

  constructor(networkName: string) {
    this.networkName = networkName;
    this.config = getNetworkConfig(networkName);
  }

  /**
   * Add a verification result
   */
  private addResult(check: string, passed: boolean, details?: any) {
    this.results.push({
      passed,
      message: `${passed ? "✅" : "❌"} ${check}`,
      details
    });
  }

  /**
   * Check if a contract is deployed
   */
  private async isDeployed(address: string): Promise<boolean> {
    if (!address || address === ethers.ZeroAddress) return false;

    try {
      const code = await ethers.provider.getCode(address);
      return code !== "0x";
    } catch {
      return false;
    }
  }

  /**
   * Verify base chain deployment
   */
  async verifyBaseChain() {
    console.log("\n=== Verifying Base Chain Deployment ===\n");

    try {
      // Load deployment addresses
      const fs = await import("fs");
      const path = await import("path");
      const addressesPath = path.join(process.cwd(), "deployments", `${this.networkName}-addresses.json`);

      if (!fs.existsSync(addressesPath)) {
        this.addResult("Deployment addresses file exists", false, { 
          message: `File not found: ${addressesPath}` 
        });
        return;
      }

      const addressesData = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
      
      if (!addressesData.BaseProtocol) {
        this.addResult("BaseProtocol addresses found", false);
        return;
      }

      // 1. Check core contracts deployment
      console.log("Checking contract deployments...");

      const contracts = {
        creditScore: addressesData.BaseProtocol.CreditScore,
        priceOracle: addressesData.BaseProtocol.PriceOracle,
        feeBasedLimits: addressesData.BaseProtocol.FeeBasedLimits,
        protocolCore: addressesData.BaseProtocol.ProtocolCore,
        liquidationManager: addressesData.BaseProtocol.LiquidationManager,
        crossChainCoordinator: addressesData.BaseProtocol.CrossChainCoordinator
      };

      for (const [name, address] of Object.entries(contracts)) {
        const isDeployed = await this.isDeployed(address as string);
        this.addResult(`${name} deployed`, isDeployed, { address });
      }

      // 2. Verify ContinuousCreditScore configuration
      if (contracts.creditScore) {
        console.log("\nVerifying CreditScore configuration...");
        const creditScore = await ethers.getContractAt("ContinuousCreditScore", contracts.creditScore);

        // Check authorized updaters
        const isProtocolCoreAuthorized = await creditScore.authorizedUpdaters(contracts.protocolCore);
        this.addResult("ProtocolCore authorized in CreditScore", isProtocolCoreAuthorized);

        const isLiquidationManagerAuthorized = await creditScore.authorizedUpdaters(contracts.liquidationManager);
        this.addResult("LiquidationManager authorized in CreditScore", isLiquidationManagerAuthorized);
      }

      // 3. Verify PriceOracle configuration
      if (contracts.priceOracle) {
        console.log("\nVerifying PriceOracle configuration...");
        const priceOracle = await ethers.getContractAt("PriceOracle", contracts.priceOracle);

        // Check Pyth integration
        const pythAddress = await priceOracle.pyth();
        const pythDeployed = await this.isDeployed(pythAddress);
        this.addResult("Pyth contract configured", pythDeployed, { pythAddress });

        // Check price age settings
        const maxPriceAge = await priceOracle.maxPriceAge();
        this.addResult("Max price age configured", maxPriceAge > 0, { maxPriceAge: maxPriceAge.toString() });

        // Check confidence settings
        const maxConfidence = await priceOracle.maxConfidenceRatio();
        this.addResult("Max confidence ratio configured", maxConfidence > 0, { maxConfidence: maxConfidence.toString() });
      }

      // 4. Verify ProtocolCore configuration
      if (contracts.protocolCore) {
        console.log("\nVerifying ProtocolCore configuration...");
        const protocolCore = await ethers.getContractAt("ProtocolCore", contracts.protocolCore);

        // Check coordinator
        const coordinator = await protocolCore.coordinator();
        const hasCoordinator = coordinator !== ethers.ZeroAddress;
        this.addResult("CrossChainCoordinator set", hasCoordinator && coordinator === contracts.crossChainCoordinator, { coordinator });

        // Check liquidation manager
        const liquidationManager = await protocolCore.liquidationManager();
        const hasLiquidationManager = liquidationManager !== ethers.ZeroAddress;
        this.addResult("LiquidationManager set", hasLiquidationManager && liquidationManager === contracts.liquidationManager, { liquidationManager });

        // Check fee collector
        const feeCollector = await protocolCore.feeCollector();
        const hasFeeCollector = feeCollector !== ethers.ZeroAddress;
        this.addResult("Fee collector set", hasFeeCollector, { feeCollector });

        // Check lending token
        const lendingToken = await protocolCore.lendingToken();
        const lendingTokenDeployed = await this.isDeployed(lendingToken);
        this.addResult("USDC token configured", lendingTokenDeployed, { lendingToken });
      }

      // 5. Verify LiquidationManager configuration
      if (contracts.liquidationManager) {
        console.log("\nVerifying LiquidationManager configuration...");
        const liquidationManager = await ethers.getContractAt("LiquidationManager", contracts.liquidationManager);

        // Check lending pool
        const lendingPool = await liquidationManager.lendingPool();
        const hasLendingPool = lendingPool === contracts.protocolCore;
        this.addResult("Lending pool set in LiquidationManager", hasLendingPool, { lendingPool });
      }

      // 6. Verify CrossChainCoordinator configuration
      if (contracts.crossChainCoordinator) {
        console.log("\nVerifying CrossChainCoordinator configuration...");
        const coordinator = await ethers.getContractAt("CrossChainCoordinator", contracts.crossChainCoordinator);

        // Check lending pool
        const lendingPool = await coordinator.lendingPool();
        const hasLendingPool = lendingPool === contracts.protocolCore;
        this.addResult("Lending pool set in Coordinator", hasLendingPool, { lendingPool });

        // Check LayerZero endpoint
        const endpoint = await coordinator.endpoint();
        const endpointDeployed = await this.isDeployed(endpoint);
        this.addResult("LayerZero endpoint configured", endpointDeployed, { endpoint });

        // Check authorized senders
        const isProtocolCoreAuthorized = await coordinator.authorizedSenders(contracts.protocolCore);
        this.addResult("ProtocolCore authorized in Coordinator", isProtocolCoreAuthorized);
      }

    } catch (error) {
      console.log("❌ Failed to load deployment artifacts:", error);
      this.addResult("Deployment artifacts accessible", false, { error: error.message });
    }
  }

  /**
   * Verify satellite chain deployment
   */
  async verifySatelliteChain() {
    console.log("\n=== Verifying Satellite Chain Deployment ===\n");

    try {
      // Load deployment addresses
      const fs = await import("fs");
      const path = await import("path");
      const addressesPath = path.join(process.cwd(), "deployments", `${this.networkName}-addresses.json`);

      if (!fs.existsSync(addressesPath)) {
        this.addResult("Deployment addresses file exists", false, { 
          message: `File not found: ${addressesPath}` 
        });
        return;
      }

      const addressesData = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
      
      if (!addressesData.CrossChain) {
        this.addResult("CrossChain addresses found", false);
        return;
      }

      // Check CollateralVault deployment
      if (addressesData.CrossChain.CollateralVault) {
        const vaultAddress = addressesData.CrossChain.CollateralVault;
        const isDeployed = await this.isDeployed(vaultAddress);
        this.addResult("CollateralVault deployed", isDeployed, { address: vaultAddress });

        if (isDeployed) {
          console.log("\nVerifying CollateralVault configuration...");
          const vault = await ethers.getContractAt("CollateralVault", vaultAddress);

          // Check coordinator EID
          const coordinatorEid = await vault.coordinatorEid();
          const hasCoordinatorEid = coordinatorEid > 0;
          this.addResult("Coordinator EID configured", hasCoordinatorEid, { coordinatorEid: coordinatorEid.toString() });

          // Check LayerZero endpoint
          const endpoint = await vault.endpoint();
          const endpointDeployed = await this.isDeployed(endpoint);
          this.addResult("LayerZero endpoint configured", endpointDeployed, { endpoint });
        }
      }

      // Check USDCOFTAdapter deployment (Ethereum)
      if (addressesData.CrossChain.USDCOFTAdapter) {
        const adapterAddress = addressesData.CrossChain.USDCOFTAdapter;
        const isDeployed = await this.isDeployed(adapterAddress);
        this.addResult("USDCOFTAdapter deployed", isDeployed, { address: adapterAddress });

        if (isDeployed) {
          const adapter = await ethers.getContractAt("USDCOFTAdapter", adapterAddress);

          // Check token
          const token = await adapter.token();
          const tokenDeployed = await this.isDeployed(token);
          this.addResult("USDC token configured in adapter", tokenDeployed, { token });
        }
      }

      // Check USDCOmnitoken deployment (non-USDC chains)
      if (addressesData.CrossChain.USDCOmnitoken) {
        const tokenAddress = addressesData.CrossChain.USDCOmnitoken;
        const isDeployed = await this.isDeployed(tokenAddress);
        this.addResult("USDCOmnitoken deployed", isDeployed, { address: tokenAddress });
      }

    } catch (error) {
      console.log("❌ Failed to load deployment artifacts:", error);
      this.addResult("Deployment artifacts accessible", false, { error: error.message });
    }
  }

  /**
   * Verify cross-chain connectivity
   */
  async verifyCrossChainSetup() {
    console.log("\n=== Verifying Cross-Chain Setup ===\n");

    // Check LayerZero endpoint configuration
    if (this.config.lzEndpoint) {
      const endpointDeployed = await this.isDeployed(this.config.lzEndpoint);
      this.addResult("LayerZero endpoint exists", endpointDeployed, { endpoint: this.config.lzEndpoint });
    } else {
      this.addResult("LayerZero endpoint configured", false, { message: "Endpoint not configured in network config" });
    }

    // Check endpoint ID configuration
    const hasEndpointId = this.config.lzEndpointId && this.config.lzEndpointId > 0;
    this.addResult("LayerZero endpoint ID configured", hasEndpointId, { endpointId: this.config.lzEndpointId });
  }

  /**
   * Generate verification report
   */
  generateReport() {
    console.log("\n" + "=".repeat(60));
    console.log("VERIFICATION SUMMARY");
    console.log("=".repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log(`\nNetwork: ${this.networkName}`);
    console.log(`Chain ID: ${this.config.chainId}`);
    console.log(`Type: ${this.config.isBaseChain ? "Base Chain (Hub)" : "Satellite Chain"}`);
    console.log(`Environment: ${this.config.isTestnet ? "Testnet" : "Mainnet"}`);

    console.log(`\nResults: ${passed}/${total} checks passed`);

    if (failed > 0) {
      console.log(`\n⚠️  Failed Checks (${failed}):`);
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`  ${r.message}`);
        if (r.details) {
          console.log(`    Details:`, r.details);
        }
      });
    }

    console.log(`\n✅ Passed Checks (${passed}):`);
    this.results.filter(r => r.passed).forEach(r => {
      console.log(`  ${r.message}`);
    });

    const allPassed = failed === 0;
    console.log("\n" + "=".repeat(60));
    if (allPassed) {
      console.log("🎉 VERIFICATION PASSED - All checks successful!");
    } else {
      console.log("⚠️  VERIFICATION INCOMPLETE - Some checks failed");
      console.log("\nNext steps:");
      console.log("1. Review failed checks above");
      console.log("2. Run configuration script: npx hardhat run scripts/configure.ts --network " + this.networkName);
      console.log("3. Re-run verification after fixes");
    }
    console.log("=".repeat(60) + "\n");
  }
}

/**
 * Main verification function
 */
async function main() {
  // Get network from Hardhat
  const hre = await import("hardhat");
  const network = await ethers.provider.getNetwork();
  const networkName = hre.network.name;

  console.log(`\n🔍 Verifying OmniCredit Protocol Deployment`);
  console.log(`   Network: ${networkName}`);
  console.log(`   Chain ID: ${network.chainId}`);

  const verifier = new DeploymentVerifier(networkName);
  const config = getNetworkConfig(networkName);

  // Run appropriate verification based on chain type
  if (config.isBaseChain) {
    await verifier.verifyBaseChain();
  } else {
    await verifier.verifySatelliteChain();
  }

  // Always verify cross-chain setup
  await verifier.verifyCrossChainSetup();

  // Generate report
  verifier.generateReport();
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });