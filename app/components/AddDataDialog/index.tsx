"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import styles from "./AddDataDialog.module.css";

interface DataSource {
  id: string;
  name: string;
  description: string;
  units: string;
  file: string;
  recordCount: number;
  fetchedAt: string;
}

interface DataIndex {
  generatedAt: string;
  totalSources: number;
  sources: DataSource[];
}

interface DataItem {
  name: string;
  value: number;
  [key: string]: unknown;
}

interface DataFile {
  metadata: {
    source: string;
    indicator: string;
    indicatorName: string;
    description: string;
    units: string;
    fetchedAt: string;
  };
  data: DataItem[];
}

interface AddDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (name: string, value: number) => void;
}

type FilterComparison = "any" | "greater" | "less";

export function AddDataDialog({
  isOpen,
  onClose,
  onSelect,
}: AddDataDialogProps) {
  const [dataIndex, setDataIndex] = useState<DataIndex | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourceData, setSourceData] = useState<DataFile | null>(null);
  const [nameFilter, setNameFilter] = useState("");
  const [valueFilter, setValueFilter] = useState("");
  const [valueComparison, setValueComparison] =
    useState<FilterComparison>("any");
  const [isLoading, setIsLoading] = useState(false);

  // Load the data index on mount
  useEffect(() => {
    if (isOpen && !dataIndex) {
      fetch("/data/index.json")
        .then((res) => res.json())
        .then((data: DataIndex) => {
          setDataIndex(data);
          if (data.sources.length > 0) {
            setSelectedSourceId(data.sources[0].id);
          }
        })
        .catch(console.error);
    }
  }, [isOpen, dataIndex]);

  // Load source data when source changes
  useEffect(() => {
    if (!selectedSourceId || !dataIndex) return;

    const source = dataIndex.sources.find((s) => s.id === selectedSourceId);
    if (!source) return;

    setIsLoading(true);
    fetch(`/data/${source.file}`)
      .then((res) => res.json())
      .then((data: DataFile) => {
        setSourceData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });
  }, [selectedSourceId, dataIndex]);

  // Filter data based on user inputs
  const filteredData = useMemo(() => {
    if (!sourceData) return [];

    let filtered = sourceData.data;

    // Filter by name
    if (nameFilter.trim()) {
      const searchTerm = nameFilter.toLowerCase();
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by value
    if (valueFilter && valueComparison !== "any") {
      const filterValue = parseFloat(valueFilter);
      if (!isNaN(filterValue)) {
        filtered = filtered.filter((item) => {
          if (valueComparison === "greater") {
            return item.value > filterValue;
          } else {
            return item.value < filterValue;
          }
        });
      }
    }

    return filtered;
  }, [sourceData, nameFilter, valueFilter, valueComparison]);

  const formatValue = useCallback((value: number): string => {
    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(2)}T`;
    } else if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  }, []);

  const handleSelect = useCallback(
    (item: DataItem) => {
      onSelect(item.name, item.value);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  // Reset filters when source changes
  useEffect(() => {
    setNameFilter("");
    setValueFilter("");
    setValueComparison("any");
  }, [selectedSourceId]);

  if (!isOpen) return null;

  const selectedSource = dataIndex?.sources.find(
    (s) => s.id === selectedSourceId
  );

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      tabIndex={-1}
    >
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2 id="dialog-title" className={styles.title}>
            Add Data
          </h2>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close dialog"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {/* Source selector */}
          <div className={styles.sourceSelector}>
            <label className={styles.label}>Data Source</label>
            <div className={styles.sourceTabs}>
              {dataIndex?.sources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => setSelectedSourceId(source.id)}
                  className={`${styles.sourceTab} ${
                    selectedSourceId === source.id ? styles.sourceTabActive : ""
                  }`}
                >
                  {source.name}
                </button>
              ))}
            </div>
            {selectedSource && (
              <p className={styles.sourceDescription}>
                {selectedSource.description}
              </p>
            )}
          </div>

          {/* Filters */}
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label className={styles.label} htmlFor="name-filter">
                Search by name
              </label>
              <input
                id="name-filter"
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Type to search..."
                className={styles.filterInput}
              />
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.label}>Filter by value</label>
              <div className={styles.valueFilterRow}>
                <select
                  value={valueComparison}
                  onChange={(e) =>
                    setValueComparison(e.target.value as FilterComparison)
                  }
                  className={styles.filterSelect}
                >
                  <option value="any">Any value</option>
                  <option value="greater">Greater than</option>
                  <option value="less">Less than</option>
                </select>
                {valueComparison !== "any" && (
                  <input
                    type="number"
                    value={valueFilter}
                    onChange={(e) => setValueFilter(e.target.value)}
                    placeholder="Enter value..."
                    className={styles.filterInput}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className={styles.results}>
            <div className={styles.resultsHeader}>
              <span className={styles.resultsCount}>
                {isLoading ? "Loading..." : `${filteredData.length} results`}
              </span>
            </div>
            <div className={styles.resultsList}>
              {isLoading ? (
                <div className={styles.loadingState}>
                  <div className={styles.spinner} />
                  <span>Loading data...</span>
                </div>
              ) : filteredData.length === 0 ? (
                <div className={styles.emptyState}>
                  No results found. Try adjusting your filters.
                </div>
              ) : (
                filteredData.map((item, index) => (
                  <button
                    key={`${item.name}-${index}`}
                    onClick={() => handleSelect(item)}
                    className={styles.resultItem}
                  >
                    <span className={styles.resultName}>{item.name}</span>
                    <span className={styles.resultValue}>
                      {formatValue(item.value)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AddDataDialog;
