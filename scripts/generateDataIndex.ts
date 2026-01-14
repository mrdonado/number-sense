/**
 * Script to generate an index of all available data sources.
 * This index can be used by the frontend to lazy-load data files.
 *
 * Usage: npx tsx scripts/generateDataIndex.ts
 * Or add to package.json scripts and run: npm run generate-index
 */

import * as fs from "fs";
import * as path from "path";
import { DataSource } from "./types";
import { DATA_SOURCES } from "./dataSources";

interface DataSourceIndexEntry {
  id: string;
  name: string;
  description: string;
  units: string;
  file: string;
  recordCount: number;
  fetchedAt: string;
}

interface DataSourceIndex {
  generatedAt: string;
  totalSources: number;
  sources: DataSourceIndexEntry[];
}

const DATA_DIR = path.join(__dirname, "..", "data");
const OUTPUT_FILE = path.join(DATA_DIR, "index.json");

async function generateDataIndex(): Promise<void> {
  console.log("Generating data source index...\n");

  const sources: DataSourceIndexEntry[] = [];

  for (const { source, file, id } of DATA_SOURCES) {
    const filePath = path.join(DATA_DIR, file);

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${source.name}: file not found (${file})`);
      continue;
    }

    try {
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const metadata = content.metadata || {};
      const data = content.data || [];

      sources.push({
        id,
        name: source.name,
        description: metadata.description || "",
        units: source.units,
        file,
        recordCount: data.length,
        fetchedAt: metadata.fetchedAt || "",
      });

      console.log(`✓ ${source.name}: ${data.length} records`);
    } catch (error) {
      console.error(`❌ Error reading ${file}:`, error);
    }
  }

  const index: DataSourceIndex = {
    generatedAt: new Date().toISOString(),
    totalSources: sources.length,
    sources,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2));

  console.log(`\n✅ Index saved to ${OUTPUT_FILE}`);
  console.log(`   Total sources: ${sources.length}`);
}

const dataSource: DataSource = {
  name: "Data Index",
  units: "N/A",
  fetch: generateDataIndex,
};

export default dataSource;

// Run directly if this is the main module
if (require.main === module) {
  dataSource.fetch().catch((error) => {
    console.error("Error generating index:", error);
    process.exit(1);
  });
}
