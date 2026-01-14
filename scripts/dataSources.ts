/**
 * Central registry of all data sources.
 * Add new data sources here - they will be automatically included in fetch-all and index generation.
 */

import gdpDataSource from "./fetchGdpData";
import billionairesDataSource from "./fetchBillionairesData";
import marketCapDataSource from "./fetchMarketCapData";
import { DataSourceConfig } from "./types";

export const DATA_SOURCES: DataSourceConfig[] = [
  { id: "gdp", source: gdpDataSource, file: "gdp-by-country.json" },
  {
    id: "billionaires",
    source: billionairesDataSource,
    file: "billionaires-net-worth.json",
  },
  {
    id: "market-cap",
    source: marketCapDataSource,
    file: "companies-market-cap.json",
  },
];
