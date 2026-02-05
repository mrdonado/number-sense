"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { formatValue } from "@/app/utils/formatValue";
import styles from "./AddDataDialog.module.css";

// Constants
const DATA_INDEX_PATH = "/data/index.json";

const UNIT_LABELS: Record<string, string> = {
  all: "All Units",
  USD: "Money (USD)",
  People: "Population",
  Meters: "Distance (Meters)",
  Years: "Time (Years)",
};

const UNIT_ICONS: Record<string, string> = {
  all: "📊",
  USD: "💵",
  People: "👥",
  Meters: "📏",
  Years: "⏳",
};

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
    sourceId?: string,
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
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customValue, setCustomValue] = useState("");

  // Track initialization to prevent cascading renders
  const hasInitialized = useRef(false);
  const previousCountRef = useRef(0);
  const [hasNewItem, setHasNewItem] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Detect when a new item is added and trigger animation
  useEffect(() => {
    if (
      excludedItems.length > previousCountRef.current &&
      previousCountRef.current > 0
    ) {
      setHasNewItem(true);
      setIsAddingItem(false); // Clear loading state when item is added
      const timer = setTimeout(() => setHasNewItem(false), 1000);
      return () => clearTimeout(timer);
    }
    previousCountRef.current = excludedItems.length;
  }, [excludedItems.length]);

  // Auto-preselect units and source if all existing balls share them

  useEffect(() => {
    // This effect initializes dialog state when it opens, which is a legitimate use case
    // The ref prevents cascading renders by ensuring this only runs once per dialog open
    if (isOpen && !hasInitialized.current && existingUnits.length > 0) {
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
        hasInitialized.current = true;
      }
    } else if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen, existingUnits, existingSourceIds]);

  // Load the data index on mount
  useEffect(() => {
    if (isOpen && !dataIndex) {
      fetch(DATA_INDEX_PATH)
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

    // eslint-disable-next-line react-hooks/set-state-in-effect
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
          s.description.toLowerCase().includes(term),
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
        item.name.toLowerCase().includes(term),
      );
    }

    // Exclude items whose name and sourceId match
    if (excludedItems && excludedItems.length > 0 && selectedSourceId) {
      const excludedSet = new Set(
        excludedItems
          .filter((ex) => ex.sourceId === selectedSourceId)
          .map((ex) => ex.name.toLowerCase()),
      );
      filtered = filtered.filter(
        (item) => !excludedSet.has(item.name.toLowerCase()),
      );
    }

    // Sort by value based on selected order
    return [...filtered].sort((a, b) =>
      sortOrder === "desc" ? b.value - a.value : a.value - b.value,
    );
  }, [sourceData, searchFilter, excludedItems, selectedSourceId, sortOrder]);

  const selectedSource = dataIndex?.sources.find(
    (s) => s.id === selectedSourceId,
  );

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
      setIsAddingItem(true);
      const units = sourceData?.metadata?.units || "";
      onSelect(item.name, item.value, units, selectedSourceId || undefined);
    },
    [onSelect, sourceData, selectedSourceId],
  );

  const handleBack = useCallback(() => {
    if (step === "values") {
      setSelectedSourceId(null);
      setSourceData(null);
      setSearchFilter("");
      setSortOrder("desc");
      setIsCustomMode(false);
      setCustomName("");
      setCustomValue("");
      setStep("source");
    } else if (step === "source") {
      setSelectedUnits(null);
      setSearchFilter("");
      setIsCustomMode(false);
      setCustomName("");
      setCustomValue("");
      setStep("units");
    }
  }, [step]);

  const toggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  }, []);

  const handleCustomSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const value = parseFloat(customValue);
      if (customName.trim() && !isNaN(value) && value > 0 && selectedUnits) {
        onSelect(customName.trim(), value, selectedUnits, "custom");
        setCustomName("");
        setCustomValue("");
        setIsCustomMode(false);
        setSearchFilter("");
      }
    },
    [customName, customValue, selectedUnits, onSelect],
  );

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setStep("units");
      setSelectedUnits(null);
      setSelectedSourceId(null);
      setSourceData(null);
      setSearchFilter("");
      setSortOrder("desc");
      setIsCustomMode(false);
      setCustomName("");
      setCustomValue("");
      hasInitialized.current = false;
    }, 200);
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handleClose();
      }
    },
    [handleClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    },
    [handleClose],
  );

  const getUnitsLabel = useCallback((units: string) => {
    return UNIT_LABELS[units] || units;
  }, []);

  const getUnitsIcon = useCallback((units: string) => {
    return UNIT_ICONS[units] || "📊";
  }, []);

  if (!isOpen) return null;

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
        <div className={styles.headerContainer}>
          <button
            onClick={handleClose}
            className={styles.backToSimulationButton}
            aria-label="Back to simulation"
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
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span>Back to Simulation</span>
          </button>

          <div
            className={`${styles.simulationInfo} ${hasNewItem ? styles.simulationInfoAnimate : ""}`}
            key={excludedItems.length}
          >
            {isAddingItem ? (
              <div className={styles.addingSpinner} />
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
              </svg>
            )}
            <span className={styles.simulationInfoText}>
              {isAddingItem ? (
                "Adding..."
              ) : (
                <>
                  {excludedItems.length}{" "}
                  {excludedItems.length === 1 ? "item" : "items"} in simulation
                </>
              )}
            </span>
            {hasNewItem && <span className={styles.successIndicator}>✓</span>}
          </div>
        </div>

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
                  <div className={styles.optionIcon}>{getUnitsIcon("all")}</div>
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
                      {getUnitsIcon(units)}
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
              />
              {!isCustomMode && (
                <button
                  onClick={() => setIsCustomMode(true)}
                  className={styles.customButton}
                >
                  <span className={styles.customButtonIcon}>✏️</span>
                  <span>Add custom value</span>
                </button>
              )}
              {isCustomMode && (
                <form
                  onSubmit={handleCustomSubmit}
                  className={styles.customForm}
                >
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Name (e.g., My Item)"
                    className={styles.customInput}
                    autoFocus
                    required
                  />
                  <input
                    type="number"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder={`Value in ${selectedUnits || "units"}`}
                    className={styles.customInput}
                    step="any"
                    min="0"
                    required
                  />
                  <div className={styles.customFormButtons}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomMode(false);
                        setCustomName("");
                        setCustomValue("");
                      }}
                      className={styles.customFormButtonCancel}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={styles.customFormButtonSubmit}
                      disabled={
                        !customName.trim() ||
                        !customValue ||
                        parseFloat(customValue) <= 0
                      }
                    >
                      Add
                    </button>
                  </div>
                </form>
              )}
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
              {!isCustomMode && (
                <button
                  onClick={() => setIsCustomMode(true)}
                  className={styles.customButton}
                >
                  <span className={styles.customButtonIcon}>✏️</span>
                  <span>Add custom value</span>
                </button>
              )}
              {isCustomMode && (
                <form
                  onSubmit={handleCustomSubmit}
                  className={styles.customForm}
                >
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Name (e.g., My Item)"
                    className={styles.customInput}
                    autoFocus
                    required
                  />
                  <input
                    type="number"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder={`Value in ${selectedUnits || "units"}`}
                    className={styles.customInput}
                    step="any"
                    min="0"
                    required
                  />
                  <div className={styles.customFormButtons}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomMode(false);
                        setCustomName("");
                        setCustomValue("");
                      }}
                      className={styles.customFormButtonCancel}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={styles.customFormButtonSubmit}
                      disabled={
                        !customName.trim() ||
                        !customValue ||
                        parseFloat(customValue) <= 0
                      }
                    >
                      Add
                    </button>
                  </div>
                </form>
              )}
              <div className={styles.valuesList}>
                {isLoading ? (
                  <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                  </div>
                ) : filteredData.length === 0 ? (
                  <div className={styles.emptyState}>No items found</div>
                ) : (
                  filteredData.map((item, index) => {
                    const formattedValue = formatValue(
                      item.value,
                      selectedSource?.units,
                    );

                    return (
                      <button
                        key={`${item.name}-${index}`}
                        onClick={() => handleSelectValue(item)}
                        className={styles.valueItem}
                      >
                        <span className={styles.valueName}>{item.name}</span>
                        <span className={styles.valueAmount}>
                          {formattedValue}
                        </span>
                      </button>
                    );
                  })
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
