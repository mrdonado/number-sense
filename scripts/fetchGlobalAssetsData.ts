/**
 * Data source to fetch total value of major global assets.
 *
 * Usage: npx tsx scripts/fetchGlobalAssetsData.ts
 * Or add to package.json scripts and run: npm run fetch-assets
 */

import * as fs from "fs";
import * as path from "path";
import { DataSource } from "./types";

interface AssetEntry {
  name: string;
  value: number;
  category: "cryptocurrency" | "commodity" | "currency" | "market" | "debt";
  description: string;
  source: string;
}

interface GlobalAssetsDataset {
  metadata: {
    source: string;
    indicator: string;
    indicatorName: string;
    description: string;
    units: string;
    fetchedAt: string;
    totalAssets: number;
  };
  data: AssetEntry[];
}

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3";
const FRED_API_URL = "https://api.stlouisfed.org/fred/series/observations";
const WORLD_BANK_API_URL = "https://api.worldbank.org/v2";
const OUTPUT_DIR = path.join(__dirname, "..", "public", "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "global-assets.json");

// Fallback estimates for assets that don't have reliable APIs
const FALLBACK_ESTIMATES = {
  // Commodities (quantity only - prices fetched dynamically)
  allGoldEverMined: {
    name: "All Gold Ever Mined",
    estimatedTonnes: 205000,
    category: "commodity" as const,
    description: "Total value of all gold ever mined in human history",
  },
  allSilverAboveGround: {
    name: "All Silver Above Ground",
    estimatedTonnes: 2500000,
    category: "commodity" as const,
    description: "Total value of all silver available above ground",
  },

  // Markets (updated less frequently, often from annual reports)
  globalStockMarket: {
    name: "Global Stock Market Capitalization",
    estimatedValue: 110_000_000_000_000, // ~$110 trillion
    category: "market" as const,
    description:
      "Total market capitalization of all publicly traded companies worldwide",
    source: "World Federation of Exchanges (Estimate)",
  },
  globalRealEstate: {
    name: "Global Real Estate Market",
    estimatedValue: 330_000_000_000_000, // ~$330 trillion
    category: "market" as const,
    description:
      "Total value of all real estate (residential and commercial) globally",
    source: "Savills World Research (Estimate)",
  },
  globalBondMarket: {
    name: "Global Bond Market",
    estimatedValue: 130_000_000_000_000, // ~$130 trillion
    category: "debt" as const,
    description: "Total value of all bonds issued globally",
    source: "SIFMA (Estimate)",
  },
  globalDebt: {
    name: "Total Global Debt",
    estimatedValue: 315_000_000_000_000, // ~$315 trillion
    category: "debt" as const,
    description: "Combined government, corporate, and household debt worldwide",
    source: "Institute of International Finance (Estimate)",
  },
  usNationalDebt: {
    name: "US National Debt",
    estimatedValue: 36_000_000_000_000, // ~$36 trillion
    category: "debt" as const,
    description: "Total public debt of the United States",
    source: "US Treasury (Estimate)",
  },
  euroM2: {
    name: "Euro Money Supply (M2)",
    estimatedValue: 15_000_000_000_000, // ~€15 trillion
    category: "currency" as const,
    description: "Eurozone M2 money supply",
    source: "European Central Bank (Estimate)",
  },
  chinaCurrency: {
    name: "Chinese Yuan Money Supply (M2)",
    estimatedValue: 40_000_000_000_000, // ~¥280 trillion → ~$40T
    category: "currency" as const,
    description: "China M2 money supply",
    source: "People's Bank of China (Estimate)",
  },
};

async function fetchGoldPrice(): Promise<number> {
  // Fetch current gold price from free API
  const response = await fetch(
    "https://api.metals.dev/v1/latest?api_key=GOLDAPIFREEAPI123&currency=USD&unit=toz",
  );

  if (response.ok) {
    const data = await response.json();
    if (data.metals?.gold) {
      return data.metals.gold;
    }
  }

  // Fallback to approximate current price
  return 2650; // USD per troy ounce (approximate as of 2026)
}

async function fetchSilverPrice(): Promise<number> {
  const response = await fetch(
    "https://api.metals.dev/v1/latest?api_key=GOLDAPIFREEAPI123&currency=USD&unit=toz",
  );

  if (response.ok) {
    const data = await response.json();
    if (data.metals?.silver) {
      return data.metals.silver;
    }
  }

  return 31; // USD per troy ounce (approximate)
}

async function fetchCryptoMarketData(): Promise<AssetEntry[]> {
  console.log("Fetching cryptocurrency market data...");

  try {
    // Get top cryptocurrencies by market cap
    const response = await fetch(
      `${COINGECKO_API_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false`,
    );

    if (!response.ok) {
      console.warn("Failed to fetch crypto data, using estimates");
      return [];
    }

    const coins = await response.json();

    const cryptoAssets: AssetEntry[] = coins
      .filter((coin: any) => coin.market_cap > 1_000_000_000) // Only > $1B market cap
      .map((coin: any) => ({
        name: coin.name,
        value: coin.market_cap,
        category: "cryptocurrency" as const,
        description: `Total market capitalization of ${coin.name} (${coin.symbol.toUpperCase()})`,
        source: "CoinGecko",
      }));

    console.log(`  Found ${cryptoAssets.length} major cryptocurrencies\n`);
    return cryptoAssets;
  } catch (error) {
    console.warn("Error fetching crypto data:", error);
    return [];
  }
}

async function fetchFredData(seriesId: string): Promise<number | null> {
  try {
    // FRED API allows requests without API key but with rate limits
    // For production use, get a free API key from https://fred.stlouisfed.org/docs/api/api_key.html
    const response = await fetch(
      `${FRED_API_URL}?series_id=${seriesId}&api_key=YOUR_FRED_API_KEY&file_type=json&sort_order=desc&limit=1`,
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.observations && data.observations.length > 0) {
      const value = parseFloat(data.observations[0].value);
      return isNaN(value) ? null : value * 1_000_000_000; // FRED reports in billions
    }
    return null;
  } catch (error) {
    console.warn(`Failed to fetch FRED data for ${seriesId}:`, error);
    return null;
  }
}

async function fetchUSMoneySupply(): Promise<AssetEntry | null> {
  console.log("Fetching US M2 money supply from FRED...");

  const value = await fetchFredData("M2SL");

  if (value) {
    console.log(`  US M2: $${(value / 1e12).toFixed(2)}T\n`);
    return {
      name: "US Dollar Money Supply (M2)",
      value: value,
      category: "currency",
      description:
        "US M2 money supply including cash, checking deposits, and near money",
      source: "Federal Reserve (FRED)",
    };
  }

  console.log("  Using fallback estimate\n");
  return null;
}

async function fetchUSNationalDebt(): Promise<AssetEntry | null> {
  console.log("Fetching US national debt from FRED...");

  const value = await fetchFredData("GFDEBTN");

  if (value) {
    console.log(`  US National Debt: $${(value / 1e12).toFixed(2)}T\n`);
    return {
      name: "US National Debt",
      value: value,
      category: "debt",
      description: "Total public debt of the United States",
      source: "US Treasury (via FRED)",
    };
  }

  console.log("  FRED API failed, using fallback estimate\n");
  // Return fallback value
  return {
    name: "US National Debt",
    value: FALLBACK_ESTIMATES.usNationalDebt.estimatedValue,
    category: "debt",
    description: "Total public debt of the United States",
    source: "US Treasury (Estimate)",
  };
}

// Major countries to fetch debt data for
const MAJOR_COUNTRIES = [
  { code: "CHN", name: "China" },
  { code: "JPN", name: "Japan" },
  { code: "DEU", name: "Germany" },
  { code: "GBR", name: "United Kingdom" },
  { code: "FRA", name: "France" },
  { code: "ITA", name: "Italy" },
  { code: "BRA", name: "Brazil" },
  { code: "CAN", name: "Canada" },
  { code: "IND", name: "India" },
  { code: "ESP", name: "Spain" },
];

async function fetchCountryDebt(
  countryCode: string,
  countryName: string,
): Promise<AssetEntry | null> {
  try {
    // Fetch government debt as % of GDP
    const debtResponse = await fetch(
      `${WORLD_BANK_API_URL}/country/${countryCode}/indicator/GC.DOD.TOTL.GD.ZS?format=json&per_page=1&date=2020:2025`,
    );

    if (!debtResponse.ok) {
      return null;
    }

    const debtData = await debtResponse.json();

    // Fetch GDP to calculate absolute debt value
    const gdpResponse = await fetch(
      `${WORLD_BANK_API_URL}/country/${countryCode}/indicator/NY.GDP.MKTP.CD?format=json&per_page=1&date=2020:2025`,
    );

    if (!gdpResponse.ok) {
      return null;
    }

    const gdpData = await gdpResponse.json();

    if (
      Array.isArray(debtData) &&
      debtData[1] &&
      debtData[1].length > 0 &&
      Array.isArray(gdpData) &&
      gdpData[1] &&
      gdpData[1].length > 0
    ) {
      const debtPercent = debtData[1][0].value;
      const gdpValue = gdpData[1][0].value;
      const year = gdpData[1][0].date;

      if (debtPercent && gdpValue) {
        const debtValue = (gdpValue * debtPercent) / 100;
        return {
          name: `${countryName} National Debt (${year})`,
          value: debtValue,
          category: "debt",
          description: `Government debt of ${countryName}`,
          source: "World Bank",
        };
      }
    }

    return null;
  } catch (error) {
    console.warn(`Failed to fetch debt data for ${countryName}:`, error);
    return null;
  }
}

async function fetchNationalDebts(): Promise<AssetEntry[]> {
  console.log("Fetching national debt for major countries...");

  const debts = await Promise.all(
    MAJOR_COUNTRIES.map((country) =>
      fetchCountryDebt(country.code, country.name),
    ),
  );

  const validDebts = debts.filter((d): d is AssetEntry => d !== null);
  console.log(`  Found debt data for ${validDebts.length} countries\n`);

  return validDebts;
}

async function fetchWorldBankGDP(): Promise<AssetEntry | null> {
  console.log("Fetching global GDP from World Bank...");

  try {
    // Get world GDP (most recent year available)
    const response = await fetch(
      `${WORLD_BANK_API_URL}/country/WLD/indicator/NY.GDP.MKTP.CD?format=json&per_page=1&date=2020:2025`,
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (Array.isArray(data) && data[1] && data[1].length > 0) {
      const gdpData = data[1][0];
      const value = gdpData.value;

      if (value) {
        console.log(
          `  Global GDP (${gdpData.date}): $${(value / 1e12).toFixed(2)}T\n`,
        );
        return {
          name: `World GDP (${gdpData.date})`,
          value: value,
          category: "market",
          description: "Total global gross domestic product",
          source: "World Bank",
        };
      }
    }

    return null;
  } catch (error) {
    console.warn("Failed to fetch World Bank GDP:", error);
    return null;
  }
}

async function fetchGlobalAssetsData(): Promise<void> {
  console.log("Fetching global assets data...\n");

  const assets: AssetEntry[] = [];

  // Fetch dynamic data in parallel
  const [
    goldPricePerOz,
    silverPricePerOz,
    cryptoAssets,
    usM2,
    usDebt,
    worldGDP,
    nationalDebts,
  ] = await Promise.all([
    fetchGoldPrice(),
    fetchSilverPrice(),
    fetchCryptoMarketData(),
    fetchUSMoneySupply(),
    fetchUSNationalDebt(),
    fetchWorldBankGDP(),
    fetchNationalDebts(),
  ]);

  // Calculate precious metals values
  const ozPerTonne = 32150.7;
  const goldValue =
    FALLBACK_ESTIMATES.allGoldEverMined.estimatedTonnes *
    ozPerTonne *
    goldPricePerOz;
  const silverValue =
    FALLBACK_ESTIMATES.allSilverAboveGround.estimatedTonnes *
    ozPerTonne *
    silverPricePerOz;

  assets.push({
    name: FALLBACK_ESTIMATES.allGoldEverMined.name,
    value: goldValue,
    category: FALLBACK_ESTIMATES.allGoldEverMined.category,
    description: FALLBACK_ESTIMATES.allGoldEverMined.description,
    source: `Calculated at $${goldPricePerOz.toFixed(0)}/oz`,
  });

  assets.push({
    name: FALLBACK_ESTIMATES.allSilverAboveGround.name,
    value: silverValue,
    category: FALLBACK_ESTIMATES.allSilverAboveGround.category,
    description: FALLBACK_ESTIMATES.allSilverAboveGround.description,
    source: `Calculated at $${silverPricePerOz.toFixed(0)}/oz`,
  });

  // Add cryptocurrency data
  assets.push(...cryptoAssets);

  // Add fetched financial data
  if (usM2) assets.push(usM2);
  if (usDebt) assets.push(usDebt);
  if (worldGDP) assets.push(worldGDP);

  // Add national debts for other countries
  assets.push(...nationalDebts);

  // Add fallback estimates for data we couldn't fetch
  Object.entries(FALLBACK_ESTIMATES).forEach(([key, asset]) => {
    if ("estimatedValue" in asset) {
      // Skip if we already have the real data
      const alreadyAdded = assets.some((a) => a.name === asset.name);
      if (!alreadyAdded) {
        assets.push({
          name: asset.name,
          value: asset.estimatedValue,
          category: asset.category,
          description: asset.description,
          source: asset.source,
        });
      }
    }
  });

  // Sort by value descending
  assets.sort((a, b) => b.value - a.value);

  const output: GlobalAssetsDataset = {
    metadata: {
      source:
        "Multiple sources (CoinGecko, Central Banks, Financial Institutions)",
      indicator: "GLOBAL.ASSETS.VALUE",
      indicatorName: "Global Asset Values",
      description:
        "Total value of major global assets including cryptocurrencies, commodities, currencies, and markets",
      units: "USD",
      fetchedAt: new Date().toISOString(),
      totalAssets: assets.length,
    },
    data: assets,
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log(`✅ Global assets data saved to ${OUTPUT_FILE}`);
  console.log(`   Total assets tracked: ${assets.length}\n`);

  // Display summary by category
  const categories = [
    "market",
    "debt",
    "currency",
    "cryptocurrency",
    "commodity",
  ] as const;

  categories.forEach((category) => {
    const categoryAssets = assets.filter((a) => a.category === category);
    if (categoryAssets.length > 0) {
      console.log(`   ${category.toUpperCase()}:`);
      categoryAssets.forEach((asset) => {
        const valueInTrillions = (asset.value / 1e12).toFixed(2);
        console.log(`     • ${asset.name}: $${valueInTrillions}T`);
      });
      console.log();
    }
  });

  const totalValue = assets.reduce((sum, a) => sum + a.value, 0);
  console.log(`   Total tracked value: $${(totalValue / 1e12).toFixed(2)}T`);
}

const dataSource: DataSource = {
  name: "Global Assets Data",
  units: "USD",
  fetch: fetchGlobalAssetsData,
};

export default dataSource;

// Run directly if this is the main module
if (require.main === module) {
  dataSource.fetch().catch((error) => {
    console.error("Error fetching global assets data:", error);
    process.exit(1);
  });
}
