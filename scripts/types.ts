/**
 * Common interface for all data source fetchers.
 */
export interface DataSource {
  /** Human-readable name of the data source */
  name: string;
  /** Unit of measurement for the values (e.g., "USD", "people", "km²") */
  units: string;
  /** Fetch data from the source and save to file */
  fetch: () => Promise<void>;
}

/**
 * Configuration for a data source including metadata for indexing.
 */
export interface DataSourceConfig {
  /** Unique identifier for the data source */
  id: string;
  /** The data source module */
  source: DataSource;
  /** Output filename in the data directory */
  file: string;
}
