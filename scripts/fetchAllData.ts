/**
 * Script to fetch all data from all data sources at once.
 *
 * Usage: npx tsx scripts/fetchAllData.ts
 * Or add to package.json scripts and run: npm run fetch-all
 */

import gdpDataSource from "./fetchGdpData";
import billionairesDataSource from "./fetchBillionairesData";
import { DataSource } from "./types";

const DATA_SOURCES: DataSource[] = [gdpDataSource, billionairesDataSource];

async function fetchAllData(): Promise<void> {
  console.log("🚀 Fetching all data sources...\n");
  console.log("=".repeat(50));

  const startTime = Date.now();
  const results: { name: string; success: boolean; error?: string }[] = [];

  for (const dataSource of DATA_SOURCES) {
    console.log(`\n📊 Fetching ${dataSource.name}...`);
    console.log("-".repeat(50));

    try {
      await dataSource.fetch();
      results.push({ name: dataSource.name, success: true });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      results.push({
        name: dataSource.name,
        success: false,
        error: errorMessage,
      });
      console.error(`❌ Failed to fetch ${dataSource.name}: ${errorMessage}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "=".repeat(50));
  console.log("📋 Summary:");
  console.log("-".repeat(50));

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  results.forEach((r) => {
    const status = r.success ? "✅" : "❌";
    console.log(`   ${status} ${r.name}`);
  });

  console.log("-".repeat(50));
  console.log(
    `   Total: ${successful} succeeded, ${failed} failed (${elapsed}s)`
  );

  if (failed > 0) {
    process.exit(1);
  }
}

fetchAllData().catch((error) => {
  console.error("Error running fetch all:", error);
  process.exit(1);
});
