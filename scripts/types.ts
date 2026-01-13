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
