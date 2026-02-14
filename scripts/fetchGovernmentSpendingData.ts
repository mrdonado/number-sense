/**
 * Data source to fetch government spending by function from the World Bank and IMF APIs.
 *
 * Usage: npx tsx scripts/fetchGovernmentSpendingData.ts
 * Or add to package.json scripts and run: npm run fetch-spending
 */

import * as fs from "fs";
import * as path from "path";
import { DataSource } from "./types";

interface SpendingByFunction {
  country: string;
  countryCode: string;
  name: string;
  value: number;
  year: number;
  unit: string;
}

interface GovernmentSpendingDataset {
  metadata: {
    source: string;
    description: string;
    units: string;
    fetchedAt: string;
    totalEntries: number;
  };
  data: SpendingByFunction[];
}

const WORLD_BANK_API_BASE = "https://api.worldbank.org/v2";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "government-spending.json");

// Selected countries for comparison
const COUNTRIES = [
  "US",
  "CN",
  "BR",
  "JP",
  "ES",
  "DE",
  "GB",
  "FR",
  "IN",
  "CA",
  "AU",
  "MX",
];

// World Bank indicators for government spending by function (% of GDP)
const SPENDING_INDICATORS = {
  "GC.XPN.TOTL.GD.ZS": "Total Government Expenditure",
  "SE.XPD.TOTL.GD.ZS": "Education Expenditure",
  "SH.XPD.GHED.GD.ZS": "Health Expenditure",
  "MS.MIL.XPND.GD.ZS": "Military Expenditure",
  "GC.XPN.COMP.ZS": "Compensation of Employees (Public Sector Wages)",
  "GC.XPN.INTP.ZS": "Interest Payments on Debt",
  "GC.XPN.GSRV.ZS": "Goods and Services Expenditure",
  "per_si_allsi.cov_pop_tot": "Social Protection Coverage",
};

async function fetchWorldBankData(
  indicator: string,
  countries: string[],
): Promise<any[]> {
  const countryList = countries.join(";");
  const url = `${WORLD_BANK_API_BASE}/country/${countryList}/indicator/${indicator}?format=json&per_page=1000&date=2015:2023`;

  try {
    console.log(`Fetching ${indicator} from World Bank API...`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    // World Bank returns [metadata, data]
    return json[1] || [];
  } catch (error) {
    console.error(`Error fetching ${indicator}:`, error);
    return [];
  }
}

async function fetchGdpData(countries: string[]): Promise<Map<string, number>> {
  const gdpMap = new Map<string, number>();
  const countryList = countries.join(";");
  const url = `${WORLD_BANK_API_BASE}/country/${countryList}/indicator/NY.GDP.MKTP.CD?format=json&per_page=1000&date=2015:2023`;

  try {
    console.log("Fetching GDP data for conversion...");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    const data = json[1] || [];

    // Get most recent GDP for each country
    for (const item of data) {
      if (
        item.value &&
        (!gdpMap.has(item.countryiso3code) ||
          parseInt(item.date) >
            parseInt(gdpMap.get(item.countryiso3code)?.toString() || "0"))
      ) {
        gdpMap.set(item.countryiso3code, item.value);
      }
    }
  } catch (error) {
    console.error("Error fetching GDP data:", error);
  }

  return gdpMap;
}

async function fetchGovernmentSpending(): Promise<GovernmentSpendingDataset> {
  const allSpending: SpendingByFunction[] = [];

  // First fetch GDP data for conversion
  const gdpData = await fetchGdpData(COUNTRIES);

  // Fetch data for each indicator
  for (const [indicator, description] of Object.entries(SPENDING_INDICATORS)) {
    const data = await fetchWorldBankData(indicator, COUNTRIES);

    // Process and get most recent data for each country
    const countryLatest = new Map<string, any>();

    for (const item of data) {
      if (item.value !== null) {
        const existing = countryLatest.get(item.countryiso3code);
        if (!existing || parseInt(item.date) > parseInt(existing.date)) {
          countryLatest.set(item.countryiso3code, item);
        }
      }
    }

    // Convert to spending data with USD amounts
    for (const [countryCode, item] of countryLatest) {
      const gdp = gdpData.get(countryCode);
      if (gdp) {
        // Convert % of GDP to USD billions
        const spendingUSD = (gdp * item.value) / 100;

        allSpending.push({
          country: item.country.value,
          countryCode: countryCode,
          name: `${item.country.value} - ${description} (${item.date})`,
          value: spendingUSD,
          year: parseInt(item.date),
          unit: "USD",
        });
      }
    }

    // Add delay to respect API rate limits
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return {
    metadata: {
      source: "World Bank Open Data API",
      description:
        "Government spending by function for selected countries converted to USD",
      units: "USD",
      fetchedAt: new Date().toISOString(),
      totalEntries: allSpending.length,
    },
    data: allSpending.sort((a, b) => b.value - a.value),
  };
}

async function saveData(dataset: GovernmentSpendingDataset): Promise<void> {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write data to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(dataset, null, 2));
  console.log(`✅ Government spending data saved to ${OUTPUT_FILE}`);
  console.log(`   Total entries: ${dataset.data.length}`);
}

// Main execution
const governmentSpendingDataSource: DataSource = {
  name: "Government Spending Data",
  units: "USD",
  fetch: async () => {
    console.log("🌍 Fetching government spending data...");
    const dataset = await fetchGovernmentSpending();
    await saveData(dataset);
  },
};

// Run if executed directly
if (require.main === module) {
  governmentSpendingDataSource
    .fetch()
    .then(() => {
      console.log("✨ Government spending data fetch complete!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Error fetching government spending data:", error);
      process.exit(1);
    });
}

export default governmentSpendingDataSource;
