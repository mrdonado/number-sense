/**
 * Data source to fetch billionaire net worth data from Forbes.
 *
 * Usage: npx tsx scripts/fetchBillionairesData.ts
 * Or add to package.json scripts and run: npm run fetch-billionaires
 */

import * as fs from "fs";
import * as path from "path";
import { DataSource } from "./types";

interface ForbesBillionaire {
  personName: string;
  finalWorth: number;
  country: string;
  city: string;
  source: string;
  industries: string[];
  countryOfCitizenship: string;
  rank: number;
  uri: string;
}

interface BillionaireEntry {
  rank: number;
  name: string;
  value: number;
  country: string;
  source: string;
}

interface BillionairesDataset {
  metadata: {
    source: string;
    indicator: string;
    indicatorName: string;
    description: string;
    units: string;
    fetchedAt: string;
    totalBillionaires: number;
    year: number;
  };
  data: BillionaireEntry[];
}

const FORBES_API_URL =
  "https://www.forbes.com/forbesapi/person/rtb/0/position/true.json";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "billionaires-net-worth.json");

async function fetchBillionairesData(): Promise<void> {
  console.log("Fetching billionaires data from Forbes...\n");

  const response = await fetch(FORBES_API_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const json = await response.json();

  if (!json.personList || !json.personList.personsLists) {
    throw new Error("Unexpected API response structure");
  }

  const rawData: ForbesBillionaire[] = json.personList.personsLists;

  console.log(`Received ${rawData.length} billionaires\n`);

  const billionairesArray: BillionaireEntry[] = rawData
    .filter((person) => person.finalWorth && person.finalWorth > 0)
    .map((person) => ({
      rank: person.rank,
      name: person.personName,
      value: person.finalWorth * 1_000_000,
      country: person.countryOfCitizenship || person.country,
      source: person.source,
    }))
    .sort((a, b) => a.rank - b.rank);

  const currentYear = new Date().getFullYear();

  const output: BillionairesDataset = {
    metadata: {
      source: "Forbes Real-Time Billionaires",
      indicator: "NET.WORTH.BILLIONAIRES",
      indicatorName: "Billionaire Net Worth",
      description: "Net worth of the world's billionaires in US Dollars",
      units: "USD",
      fetchedAt: new Date().toISOString(),
      totalBillionaires: billionairesArray.length,
      year: currentYear,
    },
    data: billionairesArray,
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log(`✅ Billionaires data saved to ${OUTPUT_FILE}`);
  console.log(`   Total billionaires: ${billionairesArray.length}`);
  console.log(`\n   Top 10 richest individuals:`);

  billionairesArray.slice(0, 10).forEach((person) => {
    const worthInBillions = (person.value / 1e9).toFixed(1);
    console.log(
      `   ${person.rank}. ${person.name}: $${worthInBillions}B (${person.source})`
    );
  });

  const totalWealth = billionairesArray.reduce((sum, p) => sum + p.value, 0);
  const totalInTrillions = (totalWealth / 1e12).toFixed(2);
  console.log(`\n   Combined net worth: $${totalInTrillions}T`);
}

const dataSource: DataSource = {
  name: "Billionaires Data",
  units: "USD",
  fetch: fetchBillionairesData,
};

export default dataSource;

// Run directly if this is the main module
if (require.main === module) {
  dataSource.fetch().catch((error) => {
    console.error("Error fetching billionaires data:", error);
    process.exit(1);
  });
}
