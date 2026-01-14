/**
 * Data source to fetch market capitalization data for the largest companies.
 *
 * Usage: npx tsx scripts/fetchMarketCapData.ts
 * Or add to package.json scripts and run: npm run fetch-marketcap
 */

import * as fs from "fs";
import * as path from "path";
import { DataSource } from "./types";

interface CompaniesMarketCapEntry {
  rank: number;
  name: string;
  symbol: string;
  marketcap: number;
  country: string;
}

interface CompanyEntry {
  rank: number;
  name: string;
  value: number;
  symbol: string;
  country: string;
}

interface MarketCapDataset {
  metadata: {
    source: string;
    indicator: string;
    indicatorName: string;
    description: string;
    units: string;
    fetchedAt: string;
    totalCompanies: number;
    year: number;
  };
  data: CompanyEntry[];
}

const API_BASE_URL = "https://companiesmarketcap.com";
const OUTPUT_DIR = path.join(__dirname, "..", "data");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "companies-market-cap.json");
const MAX_PAGES = 10; // Fetch top 1000 companies (100 per page)

async function fetchPage(page: number): Promise<string> {
  const url = page === 1 ? `${API_BASE_URL}/` : `${API_BASE_URL}/page/${page}/`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.text();
}

async function parseMarketCapFromHtml(
  html: string
): Promise<CompaniesMarketCapEntry[]> {
  const companies: CompaniesMarketCapEntry[] = [];

  // Match table rows with company data - look for rows with rank data
  const rowRegex =
    /<tr>[\s\S]*?<td class="rank-td[^"]*"[^>]*data-sort="(\d+)"[^>]*>[\s\S]*?<\/tr>/gi;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[0];
    const rank = parseInt(match[1], 10);

    // Extract company name
    const nameMatch = row.match(/<div class="company-name">([^<]+)<\/div>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();

    // Extract symbol
    const symbolMatch = row.match(
      /<div class="company-code">[^<]*<span[^>]*><\/span>([^<]+)<\/div>/
    );
    const symbol = symbolMatch ? symbolMatch[1].trim() : "";

    // Extract market cap from data-sort attribute on the market cap cell
    const marketCapMatch = row.match(
      /<td class="td-right"[^>]*data-sort="(\d+)">/
    );
    if (!marketCapMatch) continue;
    const marketcap = parseInt(marketCapMatch[1], 10);

    // Extract country from the responsive-hidden span
    const countryMatch = row.match(
      /<span class="responsive-hidden">([^<]+)<\/span><\/td>\s*<\/tr>/
    );
    const country = countryMatch ? countryMatch[1].trim() : "Unknown";

    companies.push({
      rank,
      name,
      symbol,
      marketcap,
      country,
    });
  }

  return companies;
}

async function fetchMarketCapData(): Promise<void> {
  console.log("Fetching market cap data from CompaniesMarketCap...\n");

  const allCompanies: CompaniesMarketCapEntry[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    console.log(`Fetching page ${page}...`);
    const html = await fetchPage(page);
    const pageData = await parseMarketCapFromHtml(html);

    if (pageData.length === 0) {
      console.log(`No more data on page ${page}, stopping.`);
      break;
    }

    allCompanies.push(...pageData);
  }

  if (allCompanies.length === 0) {
    throw new Error(
      "No company data found. The page structure may have changed."
    );
  }

  console.log(`\nReceived ${allCompanies.length} companies total\n`);

  const companiesArray: CompanyEntry[] = allCompanies
    .filter((company) => company.marketcap > 0)
    .map((company) => ({
      rank: company.rank,
      name: company.name,
      value: company.marketcap,
      symbol: company.symbol,
      country: company.country,
    }))
    .sort((a, b) => b.value - a.value)
    .map((company, index) => ({ ...company, rank: index + 1 }));

  const currentYear = new Date().getFullYear();

  const output: MarketCapDataset = {
    metadata: {
      source: "CompaniesMarketCap.com",
      indicator: "MARKET.CAP.COMPANIES",
      indicatorName: "Company Market Capitalization",
      description:
        "Market capitalization of publicly traded companies in US Dollars",
      units: "USD",
      fetchedAt: new Date().toISOString(),
      totalCompanies: companiesArray.length,
      year: currentYear,
    },
    data: companiesArray,
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log(`✅ Market cap data saved to ${OUTPUT_FILE}`);
  console.log(`   Total companies: ${companiesArray.length}`);
  console.log(`\n   Top 10 companies by market cap:`);

  companiesArray.slice(0, 10).forEach((company) => {
    const capInTrillions = (company.value / 1e12).toFixed(2);
    const capInBillions = (company.value / 1e9).toFixed(0);
    const display =
      company.value >= 1e12 ? `$${capInTrillions}T` : `$${capInBillions}B`;
    console.log(
      `   ${company.rank}. ${company.name} (${company.symbol}): ${display}`
    );
  });

  const totalMarketCap = companiesArray.reduce((sum, c) => sum + c.value, 0);
  const totalInTrillions = (totalMarketCap / 1e12).toFixed(2);
  console.log(`\n   Combined market cap: $${totalInTrillions}T`);
}

const dataSource: DataSource = {
  name: "Market Cap Data",
  units: "USD",
  fetch: fetchMarketCapData,
};

export default dataSource;

// Run directly if this is the main module
if (require.main === module) {
  dataSource.fetch().catch((error) => {
    console.error("Error fetching market cap data:", error);
    process.exit(1);
  });
}
