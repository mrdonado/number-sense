"use client";

import { useState } from "react";
import styles from "./PhysicsCanvas.module.css";

interface ControlsProps {
  comparisonTypeDisplay: string;
  modeText: string;
  modeTextClass: string;
  isModeClickable?: boolean;
  onAddData?: () => void;
  onClear?: () => void;
  onToggleComparisonMode?: () => void;
  onComparisonTypeChange?: () => void;
  onShare?: () => void;
}

export function Controls({
  comparisonTypeDisplay,
  modeText,
  modeTextClass,
  isModeClickable = true,
  onAddData,
  onClear,
  onToggleComparisonMode,
  onComparisonTypeChange,
  onShare,
}: ControlsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={styles.controls}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <button
        className={styles.controlsHeader}
        onClick={(e) => {
          e.stopPropagation();
          setIsCollapsed(!isCollapsed);
        }}
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

          {/* Share button */}
          <button
            className={styles.controlButton}
            onClick={(e) => {
              e.stopPropagation();
              onShare?.();
            }}
            title="Share"
          >
            <span className={styles.actionText}>Share</span>
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
