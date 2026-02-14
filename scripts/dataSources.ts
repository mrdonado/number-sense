// Static data source for stellar diameters (no fetching required)
const stellarDiametersDataSource: DataSource = {
  name: "Stellar Diameters Data",
  units: "Meters",
  fetch: async () => {
    console.log(
      "ℹ️  Stellar Diameters is a static data source (no fetch needed)",
    );
  },
};

// Static data source for energy waste and emissions (no fetching required)
const energyWasteEmissionsDataSource: DataSource = {
  name: "Energy Waste & Emissions Data",
  units: "Kg",
  fetch: async () => {
    console.log(
      "ℹ️  Energy Waste & Emissions is a static data source (no fetch needed)",
    );
  },
};

// Static data source for general weights (no fetching required)
const generalWeightsDataSource: DataSource = {
  name: "General Weights Data",
  units: "Kg",
  fetch: async () => {
    console.log(
      "ℹ️  General Weights is a static data source (no fetch needed)",
    );
  },
};

// Static data source for energy consumption (no fetching required)
const energyConsumptionDataSource: DataSource = {
  name: "Energy Consumption Data",
  units: "kWh",
  fetch: async () => {
    console.log(
      "ℹ️  Energy Consumption is a static data source (no fetch needed)",
    );
  },
};
// Static data source for rich non-billionaires (no fetching required)
const richNonBillionairesDataSource: DataSource = {
  name: "Rich Non-Billionaires Data",
  units: "USD",
  fetch: async () => {
    console.log(
      "ℹ️  Rich Non-Billionaires is a static data source (no fetch needed)",
    );
  },
};
/**
 * Central registry of all data sources.
 * Add new data sources here - they will be automatically included in fetch-all and index generation.
 */

import gdpDataSource from "./fetchGdpData";
import billionairesDataSource from "./fetchBillionairesData";
import marketCapDataSource from "./fetchMarketCapData";
import populationDataSource from "./fetchPopulationData";
import globalAssetsDataSource from "./fetchGlobalAssetsData";
import { DataSourceConfig, DataSource } from "./types";

// Static data source for time-since-events (no fetching required)
const timeSinceEventsDataSource: DataSource = {
  name: "Time Since Events",
  units: "Years",
  fetch: async () => {
    console.log(
      "ℹ️  Time Since Events is a static data source (no fetch needed)",
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

// Static data source for price/income (no fetching required)
const priceIncomeDataSource: DataSource = {
  name: "Price & Income Data",
  units: "USD",
  fetch: async () => {
    console.log("ℹ️  Price & Income is a static data source (no fetch needed)");
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
    id: "global-assets",
    source: globalAssetsDataSource,
    file: "global-assets.json",
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
  {
    id: "price-income",
    source: priceIncomeDataSource,
    file: "price-income.json",
  },
  {
    id: "rich-nonbillionaires",
    source: richNonBillionairesDataSource,
    file: "rich-nonbillionaires.json",
  },
  {
    id: "stellar-diameters",
    source: stellarDiametersDataSource,
    file: "stellar-diameters.json",
  },
  {
    id: "energy-waste-emissions",
    source: energyWasteEmissionsDataSource,
    file: "energy-waste-emissions.json",
  },
  {
    id: "general-weights",
    source: generalWeightsDataSource,
    file: "general-weights.json",
  },
  {
    id: "energy-consumption",
    source: energyConsumptionDataSource,
    file: "energy-consumption.json",
  },
];
