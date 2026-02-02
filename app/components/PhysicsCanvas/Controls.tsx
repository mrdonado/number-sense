"use client";

import { useState } from "react";
import { Plus, Share2, Trash2, ChevronRight, ChevronDown } from "lucide-react";
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
