"use client";

import { useState } from "react";
import styles from "./PhysicsCanvas.module.css";

interface ControlsProps {
  comparisonTypeDisplay: string;
  modeText: string;
  modeTextClass: string;
  canEnterComparison: boolean;
  isModeClickable: boolean;
  onAddData?: () => void;
  onClear?: () => void;
  onToggleComparisonMode?: () => void;
  onComparisonTypeChange?: () => void;
}

export function Controls({
  comparisonTypeDisplay,
  modeText,
  modeTextClass,
  canEnterComparison,
  isModeClickable,
  onAddData,
  onClear,
  onToggleComparisonMode,
  onComparisonTypeChange,
}: ControlsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={styles.controls}>
      <button
        className={styles.controlsHeader}
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expand controls" : "Collapse controls"}
      >
        <span className={styles.controlsTitle}>Controls</span>
        <span className={styles.controlsToggle}>{isCollapsed ? "▶" : "▼"}</span>
      </button>
      {!isCollapsed && (
        <div className={styles.controlsGrid}>
          {/* Mode button */}
          <button
            className={
              isModeClickable
                ? styles.controlButton
                : styles.controlButtonDisabled
            }
            onClick={(e) => {
              if (isModeClickable) {
                e.stopPropagation();
                onToggleComparisonMode?.();
              }
            }}
            disabled={!isModeClickable}
            title={modeText}
          >
            <span className={modeTextClass}>{modeText}</span>
          </button>

          {/* Comparison type button */}
          <button
            className={styles.controlButton}
            onClick={(e) => {
              e.stopPropagation();
              onComparisonTypeChange?.();
            }}
            title={comparisonTypeDisplay}
          >
            <span className={styles.comparisonTypeText}>
              {comparisonTypeDisplay}
            </span>
          </button>

          {/* Add data button */}
          <button
            className={styles.controlButton}
            onClick={(e) => {
              e.stopPropagation();
              onAddData?.();
            }}
            title="Add Data"
          >
            <span className={styles.actionText}>+</span>
          </button>

          {/* Clear button */}
          <button
            className={styles.controlButton}
            onClick={(e) => {
              e.stopPropagation();
              onClear?.();
            }}
            title="Clear All"
          >
            <span className={styles.actionText}>Clear</span>
          </button>
        </div>
      )}
    </div>
  );
}
