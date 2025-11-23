import { readFileSync, existsSync } from "fs";
import path from "path";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  BytesLike,
  EventLog,
} from "ethers";

import PriceOracleArtifact from "../../artifacts/contracts/base/PriceOracle.sol/PriceOracle.json" assert { type: "json" };
import ProtocolCoreArtifact from "../../artifacts/contracts/base/ProtocolCore.sol/ProtocolCore.json" assert { type: "json" };
import LiquidationManagerArtifact from "../../artifacts/contracts/base/LiquidationManager.sol/LiquidationManager.json" assert { type: "json" };

interface MonitorConfig {
  rpcUrl: string;
  privateKey: string;
  priceOracleAddress: string;
  protocolCoreAddress: string;
  liquidationManagerAddress: string;
  hermesUrl: string;
  priceFeedIds: string[];
  borrowerScanLookbackBlocks: number;
  healthFactorThresholdBps: number;
  pollIntervalMs: number;
  autoExecuteLiquidation: boolean;
  startBlock?: number;
}

const DEFAULT_CONFIG_PATH = path.join(
  process.cwd(),
  "monitor",
  "config.json"
);

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

class LiquidationMonitor {
  private readonly provider: JsonRpcProvider;
  private readonly wallet: Wallet;
  private readonly priceOracle: Contract;
  private readonly protocolCore: Contract;
  private readonly liquidationManager: Contract;

  constructor(private readonly config: MonitorConfig) {
    this.provider = new JsonRpcProvider(this.config.rpcUrl);
    this.wallet = new Wallet(this.config.privateKey, this.provider);

    this.priceOracle = new Contract(
      this.config.priceOracleAddress,
      PriceOracleArtifact.abi,
      this.wallet
    );

    this.protocolCore = new Contract(
      this.config.protocolCoreAddress,
      ProtocolCoreArtifact.abi,
      this.wallet
    );

    this.liquidationManager = new Contract(
      this.config.liquidationManagerAddress,
      LiquidationManagerArtifact.abi,
      this.wallet
    );
  }

  async run(): Promise<void> {
    console.log(
      `[monitor] starting liquidation monitor against ${this.config.rpcUrl}`
    );
    console.log(`[monitor] tracking ${this.config.priceFeedIds.length} Pyth feeds`);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await this.tick();
      } catch (error) {
        console.error("[monitor] tick failed:", error);
      }

      await sleep(this.config.pollIntervalMs);
    }
  }

  private async tick(): Promise<void> {
    await this.pushLatestPythPrices();
    const borrowers = await this.discoverActiveBorrowers();

    if (!borrowers.size) {
      console.log("[monitor] no borrowers discovered in the current window");
      return;
    }

    console.log(`[monitor] evaluating ${borrowers.size} borrowers...`);
    for (const borrower of borrowers) {
      await this.evaluateBorrower(borrower);
    }
  }

  private async pushLatestPythPrices(): Promise<void> {
    const updateData = await fetchLatestPriceUpdate(
      this.config.priceFeedIds,
      this.config.hermesUrl
    );
    if (!updateData.length) {
      console.warn("[monitor] Hermes did not return any price update payloads");
      return;
    }

    const fee = await this.priceOracle.getUpdateFee(updateData);
    const tx = await this.priceOracle.updatePriceFeeds(updateData, {
      value: fee,
    });
    await tx.wait();
    console.log(
      `[monitor] pushed ${updateData.length} Pyth update(s) (tx: ${tx.hash})`
    );
  }

  private async discoverActiveBorrowers(): Promise<Set<string>> {
    const latestBlock = await this.provider.getBlockNumber();
    const fromBlock = Math.max(
      this.config.startBlock ?? 0,
      latestBlock - this.config.borrowerScanLookbackBlocks
    );

    const borrowFilter = this.protocolCore.filters.Borrowed?.();
    if (!borrowFilter) {
      throw new Error("Borrowed event not found on ProtocolCore ABI");
    }

    const events = (await this.protocolCore.queryFilter(
      borrowFilter,
      fromBlock,
      latestBlock
    )) as EventLog[];

    const borrowers = new Set<string>();
    for (const event of events) {
      const borrower = event.args?.[0] as string | undefined;
      if (borrower) {
        borrowers.add(borrower);
      }
    }

    return borrowers;
  }

  private async evaluateBorrower(borrower: string): Promise<void> {
    try {
      const healthFactor: bigint =
        await this.protocolCore.getHealthFactor(borrower);

      if (healthFactor >= BigInt(this.config.healthFactorThresholdBps)) {
        console.log(
          `[monitor] borrower ${borrower} is healthy (hf=${healthFactor})`
        );
        return;
      }

      console.warn(
        `[monitor] borrower ${borrower} is unhealthy (hf=${healthFactor})`
      );
      await this.triggerLiquidation(borrower);
    } catch (error) {
      console.error(
        `[monitor] failed to evaluate borrower ${borrower}:`,
        error
      );
    }
  }

  private async triggerLiquidation(borrower: string): Promise<void> {
    try {
      const auctionId: BytesLike =
        await this.liquidationManager.startAuction.staticCall(borrower);
      const tx = await this.liquidationManager.startAuction(borrower);
      await tx.wait();
      console.log(
        `[monitor] started liquidation auction for ${borrower} (id=${auctionId}, tx=${tx.hash})`
      );

      if (this.config.autoExecuteLiquidation) {
        const execTx = await this.liquidationManager.executeLiquidation(
          auctionId
        );
        await execTx.wait();
        console.log(
          `[monitor] executed liquidation for ${borrower} (tx=${execTx.hash})`
        );
      }
    } catch (error) {
      console.error(
        `[monitor] liquidation attempt failed for ${borrower}:`,
        error
      );
    }
  }
}

async function fetchLatestPriceUpdate(
  feedIds: string[],
  hermesUrl: string
): Promise<string[]> {
  if (!feedIds.length) return [];

  const params = new URLSearchParams({ encoding: "hex" });
  for (const id of feedIds) {
    params.append("ids[]", id);
  }

  const url = `${hermesUrl}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Hermes request failed with status ${response.status}: ${response.statusText}`
    );
  }

  const body = (await response.json()) as {
    binary?: { data: string[] };
  };

  return body.binary?.data ?? [];
}

function loadConfig(): MonitorConfig {
  const configPath = process.env.MONITOR_CONFIG_PATH ?? DEFAULT_CONFIG_PATH;

  if (!existsSync(configPath)) {
    throw new Error(
      `Configuration file not found at ${configPath}. Please create it based on monitor/config.example.json`
    );
  }

  const raw = readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as MonitorConfig;

  return {
    ...parsed,
    pollIntervalMs: parsed.pollIntervalMs ?? 60_000,
    borrowerScanLookbackBlocks:
      parsed.borrowerScanLookbackBlocks ?? 50_000,
    healthFactorThresholdBps:
      parsed.healthFactorThresholdBps ?? 10_000,
    hermesUrl:
      parsed.hermesUrl ??
      "https://hermes.pyth.network/v2/updates/price/latest",
  };
}

async function main() {
  const config = loadConfig();
  const monitor = new LiquidationMonitor(config);
  await monitor.run();
}

main().catch((error) => {
  console.error("[monitor] fatal error:", error);
  process.exit(1);
});


