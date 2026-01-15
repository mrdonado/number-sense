/**
 * Data source to fetch population data for all countries from the World Bank API.
 *
 * Usage: npx tsx scripts/fetchPopulationData.ts
 * Or add to package.json scripts and run: npm run fetch-population
 */

import * as fs from "fs";
import * as path from "path";
import { DataSource } from "./types";

interface WorldBankDataPoint {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
  unit: string;
  obs_status: string;
  decimal: number;
}

interface CountryPopulation {
  countryCode: string;
  name: string;
  value: number;
  year: number;
}

interface PopulationDataset {
  metadata: {
    source: string;
    indicator: string;
    indicatorName: string;
    description: string;
    units: string;
    fetchedAt: string;
    totalCountries: number;
    latestYear: number;
  };
  data: CountryPopulation[];
}

const WORLD_BANK_API_BASE = "https://api.worldbank.org/v2";
const POPULATION_INDICATOR = "SP.POP.TOTL";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "population-by-country.json");

async function fetchAllPages<T>(baseUrl: string): Promise<T[]> {
  const allData: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${baseUrl}&page=${page}`;
    console.log(`Fetching page ${page}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();

    if (Array.isArray(json) && json.length === 2) {
      const [metadata, data] = json;
      totalPages = metadata.pages || 1;

      if (Array.isArray(data)) {
        allData.push(...data);
      }
    }

    page++;
  }

  return allData;
}

async function fetchPopulationData(): Promise<void> {
  console.log("Fetching population data from World Bank API...\n");

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 5;

  const url = `${WORLD_BANK_API_BASE}/country/all/indicator/${POPULATION_INDICATOR}?format=json&per_page=500&date=${startYear}:${currentYear}`;

  const rawData = await fetchAllPages<WorldBankDataPoint>(url);

  console.log(`Received ${rawData.length} data points\n`);

  const countryLatestPopulation = new Map<string, CountryPopulation>();

  // Aggregate codes to exclude (regions, income groups, etc.)
  const aggregateCodes = [
    "WLD",
    "LIC",
    "MIC",
    "HIC",
    "LMC",
    "UMC",
    "LMY",
    "MNA",
    "SSF",
    "EAS",
    "ECS",
    "LCN",
    "NAC",
    "SAS",
    "SSA",
    "EAP",
    "ECA",
    "LAC",
    "MEA",
    "OED",
    "PST",
    "TSS",
    "EMU",
    "EUU",
    "ARB",
    "CSS",
    "OSS",
    "PSS",
    "TEA",
    "TEC",
    "TLA",
    "TMN",
    "TSA",
    "CEB",
    "FCS",
    "HPC",
    "IBD",
    "IBT",
    "IDA",
    "IDB",
    "IDX",
    "LDC",
    "PRE",
    "INX",
    "LTE",
    "EAR",
    "SST",
    "AFE",
    "AFW",
    "XZN",
  ];

  for (const item of rawData) {
    if (
      item.value === null ||
      !item.countryiso3code ||
      item.countryiso3code.length !== 3
    ) {
      continue;
    }

    if (aggregateCodes.includes(item.countryiso3code)) {
      continue;
    }

    const year = parseInt(item.date, 10);
    const existing = countryLatestPopulation.get(item.countryiso3code);

    if (!existing || year > existing.year) {
      countryLatestPopulation.set(item.countryiso3code, {
        countryCode: item.countryiso3code,
        name: item.country.value,
        value: item.value,
        year: year,
      });
    }
  }

  const populationArray = Array.from(countryLatestPopulation.values()).sort(
    (a, b) => b.value - a.value
  );

  const yearCounts = new Map<number, number>();
  for (const item of populationArray) {
    yearCounts.set(item.year, (yearCounts.get(item.year) || 0) + 1);
  }
  const latestYear = Array.from(yearCounts.entries()).sort(
    (a, b) => b[0] - a[0]
  )[0]?.[0];

  const output: PopulationDataset = {
    metadata: {
      source: "World Bank Open Data",
      indicator: POPULATION_INDICATOR,
      indicatorName: "Population, total",
      description: "Total population of countries",
      units: "People",
      fetchedAt: new Date().toISOString(),
      totalCountries: populationArray.length,
      latestYear: latestYear || currentYear,
    },
    data: populationArray,
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log(`✅ Population data saved to ${OUTPUT_FILE}`);
  console.log(`   Total countries: ${populationArray.length}`);
  console.log(`   Latest year: ${latestYear}`);
  console.log(`\n   Top 5 countries by population:`);

  populationArray.slice(0, 5).forEach((country, index) => {
    const popFormatted = formatPopulation(country.value);
    console.log(
      `   ${index + 1}. ${country.name}: ${popFormatted} (${country.year})`
    );
  });
}

function formatPopulation(value: number): string {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`;
  }
  return value.toString();
}

const dataSource: DataSource = {
  name: "Population Data",
  units: "People",
  fetch: fetchPopulationData,
};

export default dataSource;

// Run directly if this is the main module
if (require.main === module) {
  dataSource.fetch().catch((error) => {
    console.error("Error fetching population data:", error);
    process.exit(1);
  });
}
