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

interface ExcludedItem {
  name: string;
  sourceId: string;
}

interface AddDataDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (
    name: string,
    value: number,
    units: string,
    sourceId?: string
  ) => void;
  excludedItems?: ExcludedItem[]; // Items to exclude from selection
  existingUnits?: string[]; // Units of existing balls in the simulation
  existingSourceIds?: string[]; // Source IDs of existing balls in the simulation
}

type Step = "units" | "source" | "values";

export function AddDataDialog({
  isOpen,
  onClose,
  onSelect,
  excludedItems = [],
  existingUnits = [],
  existingSourceIds = [],
}: AddDataDialogProps) {
  const [dataIndex, setDataIndex] = useState<DataIndex | null>(null);
  const [step, setStep] = useState<Step>("units");
  const [selectedUnits, setSelectedUnits] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourceData, setSourceData] = useState<DataFile | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Auto-preselect units and source if all existing balls share them
  useEffect(() => {
    if (isOpen && existingUnits.length > 0) {
      const uniqueUnits = new Set(existingUnits.filter((u) => u)); // Filter out undefined/empty
      if (uniqueUnits.size === 1) {
        const commonUnits = Array.from(uniqueUnits)[0];
        setSelectedUnits(commonUnits);

        // Check if all balls also share the same source
        const uniqueSourceIds = new Set(existingSourceIds.filter((s) => s));
        if (uniqueSourceIds.size === 1) {
          const commonSourceId = Array.from(uniqueSourceIds)[0];
          setSelectedSourceId(commonSourceId);
          setStep("values");
        } else {
          setStep("source");
        }
      }
    }
  }, [isOpen, existingUnits, existingSourceIds]);

  // Load the data index on mount
  useEffect(() => {
    if (isOpen && !dataIndex) {
      fetch("/data/index.json")
        .then((res) => res.json())
        .then((data: DataIndex) => {
          setDataIndex(data);
        })
        .catch(console.error);
    }
  }, [isOpen, dataIndex]);

  // Load source data when source is selected
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

  // Get unique units from data sources
  const availableUnits = useMemo(() => {
    if (!dataIndex) return [];
    const units = new Set(dataIndex.sources.map((s) => s.units));
    return Array.from(units);
  }, [dataIndex]);

  // Filter sources by selected units
  const filteredSources = useMemo(() => {
    if (!dataIndex) return [];
    let sources = dataIndex.sources;

    if (selectedUnits && selectedUnits !== "all") {
      sources = sources.filter((s) => s.units === selectedUnits);
    }

    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      sources = sources.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.description.toLowerCase().includes(term)
      );
    }

    return sources;
  }, [dataIndex, selectedUnits, searchFilter]);

  // Filter data items, excluding already present ones (by name and sourceId)
  const filteredData = useMemo(() => {
    if (!sourceData) return [];

    let filtered = sourceData.data;

    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(term)
      );
    }

    // Exclude items whose name and sourceId match
    if (excludedItems && excludedItems.length > 0 && selectedSourceId) {
      const excludedSet = new Set(
        excludedItems
          .filter((ex) => ex.sourceId === selectedSourceId)
          .map((ex) => ex.name.toLowerCase())
      );
      filtered = filtered.filter(
        (item) => !excludedSet.has(item.name.toLowerCase())
      );
    }

    // Sort by value based on selected order
    return [...filtered].sort((a, b) =>
      sortOrder === "desc" ? b.value - a.value : a.value - b.value
    );
  }, [sourceData, searchFilter, excludedItems, selectedSourceId, sortOrder]);

  const selectedSource = dataIndex?.sources.find(
    (s) => s.id === selectedSourceId
  );

  const formatValue = useCallback((value: number, units?: string): string => {
    const isUSD = units === "USD";
    const prefix = isUSD ? "$" : "";

    if (value >= 1e12) {
      return `${prefix}${(value / 1e12).toFixed(2)}T`;
    } else if (value >= 1e9) {
      return `${prefix}${(value / 1e9).toFixed(2)}B`;
    } else if (value >= 1e6) {
      return `${prefix}${(value / 1e6).toFixed(2)}M`;
    } else if (value >= 1e3) {
      return `${prefix}${(value / 1e3).toFixed(2)}K`;
    }
    return `${prefix}${value.toFixed(0)}`;
  }, []);

  const handleSelectUnits = useCallback((units: string) => {
    setSelectedUnits(units);
    setSearchFilter("");
    setStep("source");
  }, []);

  const handleSelectSource = useCallback((sourceId: string) => {
    setSelectedSourceId(sourceId);
    setSearchFilter("");
    setStep("values");
  }, []);

  const handleSelectValue = useCallback(
    (item: DataItem) => {
      const units = sourceData?.metadata?.units || "";
      onSelect(item.name, item.value, units, selectedSourceId || undefined);
    },
    [onSelect, sourceData, selectedSourceId]
  );

  const handleBack = useCallback(() => {
    if (step === "values") {
      setSelectedSourceId(null);
      setSourceData(null);
      setSearchFilter("");
      setSortOrder("desc");
      setStep("source");
    } else if (step === "source") {
      setSelectedUnits(null);
      setSearchFilter("");
      setStep("units");
    }
  }, [step]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setStep("units");
      setSelectedUnits(null);
      setSelectedSourceId(null);
      setSourceData(null);
      setSearchFilter("");
      setSortOrder("desc");
    }, 200);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    },
    [handleClose]
  );

  if (!isOpen) return null;

  const getUnitsLabel = (units: string) => {
    if (units === "all") return "All Units";
    if (units === "USD") return "US Dollars";
    if (units === "People") return "Population";
    return units;
  };

  return (
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      <div className={styles.dialog}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {step !== "units" && (
              <button
                onClick={handleBack}
                className={styles.backButton}
                aria-label="Go back"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}
            <div className={styles.breadcrumb}>
              {step === "units" && (
                <span className={styles.breadcrumbActive}>Select Units</span>
              )}
              {step === "source" && (
                <>
                  <span className={styles.breadcrumbItem}>
                    {getUnitsLabel(selectedUnits || "")}
                  </span>
                  <span className={styles.breadcrumbSeparator}>›</span>
                  <span className={styles.breadcrumbActive}>Select Source</span>
                </>
              )}
              {step === "values" && (
                <>
                  <span className={styles.breadcrumbItem}>
                    {getUnitsLabel(selectedUnits || "")}
                  </span>
                  <span className={styles.breadcrumbSeparator}>›</span>
                  <span className={styles.breadcrumbItem}>
                    {selectedSource?.name}
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
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
          {step === "units" && (
            <div className={styles.stepContent}>
              <p className={styles.stepDescription}>
                Choose the type of data you want to explore
              </p>
              <div className={styles.optionsList}>
                <button
                  onClick={() => handleSelectUnits("all")}
                  className={styles.optionItem}
                >
                  <div className={styles.optionIcon}>📊</div>
                  <div className={styles.optionInfo}>
                    <span className={styles.optionName}>All Units</span>
                    <span className={styles.optionDescription}>
                      Browse all {dataIndex?.sources.length || 0} data sources
                    </span>
                  </div>
                  <svg
                    className={styles.optionArrow}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
                {availableUnits.map((units) => (
                  <button
                    key={units}
                    onClick={() => handleSelectUnits(units)}
                    className={styles.optionItem}
                  >
                    <div className={styles.optionIcon}>
                      {units === "USD" ? "💵" : "👥"}
                    </div>
                    <div className={styles.optionInfo}>
                      <span className={styles.optionName}>
                        {getUnitsLabel(units)}
                      </span>
                      <span className={styles.optionDescription}>
                        {
                          dataIndex?.sources.filter((s) => s.units === units)
                            .length
                        }{" "}
                        data source
                        {dataIndex?.sources.filter((s) => s.units === units)
                          .length !== 1
                          ? "s"
                          : ""}
                      </span>
                    </div>
                    <svg
                      className={styles.optionArrow}
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === "source" && (
            <div className={styles.stepContent}>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search data sources..."
                className={styles.searchInput}
                autoFocus
              />
              <div className={styles.optionsList}>
                {filteredSources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => handleSelectSource(source.id)}
                    className={styles.optionItem}
                  >
                    <div className={styles.optionInfo}>
                      <span className={styles.optionName}>{source.name}</span>
                      <span className={styles.optionDescription}>
                        {source.description}
                      </span>
                    </div>
                    <div className={styles.optionMeta}>
                      <span className={styles.optionCount}>
                        {source.recordCount.toLocaleString()}
                      </span>
                      <svg
                        className={styles.optionArrow}
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </div>
                  </button>
                ))}
                {filteredSources.length === 0 && (
                  <div className={styles.emptyState}>No data sources found</div>
                )}
              </div>
            </div>
          )}

          {step === "values" && (
            <div className={styles.stepContent}>
              <div className={styles.searchRow}>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={`Search in ${selectedSource?.name}...`}
                  className={styles.searchInput}
                  autoFocus
                />
                <button
                  onClick={toggleSortOrder}
                  className={styles.sortButton}
                  title={
                    sortOrder === "desc" ? "Sort ascending" : "Sort descending"
                  }
                  aria-label={
                    sortOrder === "desc" ? "Sort ascending" : "Sort descending"
                  }
                >
                  {sortOrder === "desc" ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 6h18M7 12h10M11 18h2" />
                      <path d="M17 20l3-3-3-3" />
                    </svg>
                  ) : (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M11 6h2M7 12h10M3 18h18" />
                      <path d="M17 4l3 3-3 3" />
                    </svg>
                  )}
                </button>
              </div>
              <div className={styles.resultsInfo}>
                {isLoading
                  ? "Loading..."
                  : `${filteredData.length.toLocaleString()} items`}
              </div>
              <div className={styles.valuesList}>
                {isLoading ? (
                  <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className={styles.emptyState}>No items found</div>
                ) : (
                  filteredData.map((item, index) => (
                    <button
                      key={`${item.name}-${index}`}
                      onClick={() => handleSelectValue(item)}
                      className={styles.valueItem}
                    >
                      <span className={styles.valueName}>{item.name}</span>
                      <span className={styles.valueAmount}>
                        {formatValue(item.value, selectedSource?.units)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddDataDialog;
