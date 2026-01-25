/**
 * Central registry of all data sources.
 * Add new data sources here - they will be automatically included in fetch-all and index generation.
 */

import gdpDataSource from "./fetchGdpData";
import billionairesDataSource from "./fetchBillionairesData";
import marketCapDataSource from "./fetchMarketCapData";
import populationDataSource from "./fetchPopulationData";
import { DataSourceConfig, DataSource } from "./types";

// Static data source for time-since-events (no fetching required)
const timeSinceEventsDataSource: DataSource = {
  name: "Time Since Events",
  units: "Years",
  fetch: async () => {
    console.log(
      "ℹ️  Time Since Events is a static data source (no fetch needed)"
    );
  },
};

// Static data source for distances (no fetching required)
const distancesDataSource: DataSource = {
  name: "Distance Data",
  units: "Meters",
  fetch: async () => {
    console.log("ℹ️  Distances is a static data source (no fetch needed)");
  },
};

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
  {
    id: "population",
    source: populationDataSource,
    file: "population-by-country.json",
  },
  {
    id: "time-since-events",
    source: timeSinceEventsDataSource,
    file: "time-since-events.json",
  },
  {
    id: "distances",
    source: distancesDataSource,
    file: "distances.json",
  },
];
