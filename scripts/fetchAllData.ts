/**
 * Script to fetch all data from all data sources at once.
 *
 * Usage: npx tsx scripts/fetchAllData.ts
 * Or add to package.json scripts and run: npm run fetch-all
 */

import generateDataIndex from "./generateDataIndex";
import { DataSource } from "./types";
import { DATA_SOURCES } from "./dataSources";

// Run index generation after all data is fetched
const POST_FETCH: DataSource[] = [generateDataIndex];

async function fetchAllData(): Promise<void> {
  console.log("🚀 Fetching all data sources...\n");
  console.log("=".repeat(50));

  const startTime = Date.now();
  const results: { name: string; success: boolean; error?: string }[] = [];

  for (const { source } of DATA_SOURCES) {
    console.log(`\n📊 Fetching ${source.name}...`);
    console.log("-".repeat(50));

    try {
      await source.fetch();
      results.push({ name: source.name, success: true });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      results.push({
        name: source.name,
        success: false,
        error: errorMessage,
      });
      console.error(`❌ Failed to fetch ${source.name}: ${errorMessage}`);
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

  // Run post-fetch tasks (like generating index)
  if (failed === 0 && POST_FETCH.length > 0) {
    console.log("\n" + "=".repeat(50));
    console.log("📝 Running post-fetch tasks...\n");

    for (const task of POST_FETCH) {
      try {
        await task.fetch();
      } catch (error) {
        console.error(`❌ Failed to run ${task.name}:`, error);
      }
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

fetchAllData().catch((error) => {
  console.error("Error running fetch all:", error);
  process.exit(1);
});
