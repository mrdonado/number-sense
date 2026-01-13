/**
 * Script to fetch billionaire net worth data from Forbes
 * and generate a JSON file with the same structure as other datasets.
 *
 * Usage: npx tsx scripts/fetchBillionairesData.ts
 * Or add to package.json scripts and run: npm run fetch-billionaires
 */

import * as fs from "fs";
import * as path from "path";

interface ForbesBillionaire {
  personName: string;
  finalWorth: number; // in millions USD
  country: string;
  city: string;
  source: string; // source of wealth (company/industry)
  industries: string[];
  countryOfCitizenship: string;
  rank: number;
  uri: string;
}

interface BillionaireEntry {
  rank: number;
  name: string;
  value: number; // net worth in USD
  country: string;
  source: string; // source of wealth
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
const OUTPUT_DIR = path.join(__dirname, "..", "data");
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

  // Transform to our standard format
  const billionairesArray: BillionaireEntry[] = rawData
    .filter((person) => person.finalWorth && person.finalWorth > 0)
    .map((person) => ({
      rank: person.rank,
      name: person.personName,
      value: person.finalWorth * 1_000_000, // Convert from millions to absolute USD
      country: person.countryOfCitizenship || person.country,
      source: person.source,
    }))
    .sort((a, b) => a.rank - b.rank);

  const currentYear = new Date().getFullYear();

  // Build the output structure
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

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write to file
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

  // Calculate total wealth of all billionaires
  const totalWealth = billionairesArray.reduce((sum, p) => sum + p.value, 0);
  const totalInTrillions = (totalWealth / 1e12).toFixed(2);
  console.log(`\n   Combined net worth: $${totalInTrillions}T`);
}

// Run the script
fetchBillionairesData().catch((error) => {
  console.error("Error fetching billionaires data:", error);
  process.exit(1);
});
