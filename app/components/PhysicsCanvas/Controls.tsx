"use client";

import { useState } from "react";
import { Plus, Share2, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import styles from "./PhysicsCanvas.module.css";

interface ControlsProps {
  comparisonTypeDisplay: string;
  modeText: string;
  modeTextClass: string;
  isModeClickable?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
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
  collapsed,
  onCollapsedChange,
  onAddData,
  onClear,
  onToggleComparisonMode,
  onComparisonTypeChange,
  onShare,
}: ControlsProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  // Use external collapsed state if provided, otherwise use internal state
  const isCollapsed = collapsed !== undefined ? collapsed : internalCollapsed;

  const handleToggleCollapsed = () => {
    const newCollapsed = !isCollapsed;
    if (onCollapsedChange) {
      onCollapsedChange(newCollapsed);
    } else {
      setInternalCollapsed(newCollapsed);
    }
  };

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
          handleToggleCollapsed();
        }}
        title={isCollapsed ? "Expand controls" : "Collapse controls"}
      >
        <span className={styles.controlsTitle}>Controls</span>
        {isCollapsed ? (
          <ChevronRight size={16} className={styles.controlsToggle} />
        ) : (
          <ChevronDown size={16} className={styles.controlsToggle} />
        )}
      </button>
      {!isCollapsed && (
        <div className={styles.controlsGrid}>
          {/* Mode button */}
          <button
            className={
              !isModeClickable
                ? styles.controlButtonDisabled
                : modeText === "Start Comparison"
                  ? styles.startComparisonButton
                  : styles.controlButton
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
            <span
              className={
                modeText === "Start Comparison"
                  ? styles.startComparisonText
                  : modeTextClass
              }
            >
              {modeText}
            </span>
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
            className={styles.controlButtonSmall}
            onClick={(e) => {
              e.stopPropagation();
              onAddData?.();
            }}
            title="Add Data"
          >
            <Plus size={18} className={styles.actionIcon} />
          </button>

          {/* Share button */}
          <button
            className={styles.controlButtonSmall}
            onClick={(e) => {
              e.stopPropagation();
              onShare?.();
            }}
            title="Share"
          >
            <Share2 size={18} className={styles.actionIcon} />
          </button>

          {/* Clear button */}
          <button
            className={styles.controlButtonSmall}
            onClick={(e) => {
              e.stopPropagation();
              onClear?.();
            }}
            title="Clear All"
          >
            <Trash2 size={18} className={styles.actionIcon} />
          </button>
        </div>
      )}
    </div>
  );
}
