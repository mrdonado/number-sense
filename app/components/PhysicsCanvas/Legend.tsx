"use client";

import { useState, useMemo } from "react";
import type { BallInfo } from "./types";
import styles from "./PhysicsCanvas.module.css";

interface LegendProps {
  balls: BallInfo[];
  hoveredBallId: number | null;
  hiddenBallIds: Set<number>;
  onHover: (id: number | null) => void;
  onRemove: (id: number) => void;
  onToggleVisibility: (id: number) => void;
  onZoom: (id: number) => void;
}

/**
 * Format a number with abbreviated suffix (K, M, B, T)
 */
function formatValue(value: number): string {
  if (value >= 1e12) {
    return `${(value / 1e12).toFixed(1)}T`;
  }
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

/**
 * Calculate units display from visible balls
 */
function calculateUnitsDisplay(
  balls: BallInfo[],
  hiddenBallIds: Set<number>
): { units: string | null; isMixed: boolean } {
  // Only consider visible balls
  const visibleBalls = balls.filter((b) => !hiddenBallIds.has(b.id));

  // Get unique units from visible balls (excluding undefined/empty)
  const uniqueUnits = new Set(
    visibleBalls.map((b) => b.units).filter((u): u is string => !!u)
  );

  if (uniqueUnits.size === 0) {
    return { units: null, isMixed: false };
  }

  if (uniqueUnits.size === 1) {
    return { units: Array.from(uniqueUnits)[0], isMixed: false };
  }

  // Multiple different units
  return { units: null, isMixed: true };
}

export function Legend({
  balls,
  hoveredBallId,
  hiddenBallIds,
  onHover,
  onRemove,
  onToggleVisibility,
  onZoom,
}: LegendProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Calculate units from visible balls
  const { units, isMixed } = useMemo(
    () => calculateUnitsDisplay(balls, hiddenBallIds),
    [balls, hiddenBallIds]
  );

  if (balls.length === 0) {
    return null;
  }

  // Sort balls by value in descending order
  const sortedBalls = [...balls].sort((a, b) => b.value - a.value);

  // When collapsed, show only the hovered ball (if any)
  const ballsToShow =
    isCollapsed && hoveredBallId !== null
      ? sortedBalls.filter((ball) => ball.id === hoveredBallId)
      : sortedBalls;

  // Format units for display
  const unitsContent = isMixed ? (
    <span style={{ color: "#ef4444" }}> · mixed</span>
  ) : units ? (
    ` · ${units}`
  ) : null;

  return (
    <div className={styles.legend}>
      <button
        className={styles.legendHeader}
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expand legend" : "Collapse legend"}
      >
        <span className={styles.legendTitle}>
          Legend ({balls.length}){unitsContent}
        </span>
        <span className={styles.legendToggle}>{isCollapsed ? "▶" : "▼"}</span>
      </button>
      {(!isCollapsed || (isCollapsed && hoveredBallId !== null)) && (
        <ul className={styles.legendList}>
          {ballsToShow.map((ball) => {
            const isHidden = hiddenBallIds.has(ball.id);
            return (
              <li
                key={ball.id}
                className={styles.legendItem}
                style={{
                  backgroundColor:
                    hoveredBallId === ball.id
                      ? "rgba(255, 255, 255, 0.2)"
                      : "transparent",
                  boxShadow:
                    hoveredBallId === ball.id
                      ? `0 0 0 2px ${ball.color}`
                      : "none",
                  opacity: isHidden ? 0.4 : 1,
                }}
                onPointerEnter={(e) => {
                  if (e.pointerType !== "touch") onHover(ball.id);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType !== "touch") onHover(null);
                }}
                onClick={() => !isHidden && onZoom(ball.id)}
              >
                <span
                  className={styles.ballIndicator}
                  style={{
                    backgroundColor: ball.color,
                    filter: isHidden ? "grayscale(100%)" : "none",
                  }}
                />
                <span
                  className={styles.ballName}
                  style={{
                    color: isHidden ? "rgba(255, 255, 255, 0.5)" : "white",
                  }}
                >
                  {ball.name}
                </span>
                <span
                  className={styles.ballValue}
                  style={{
                    color: isHidden
                      ? "rgba(255, 255, 255, 0.4)"
                      : "rgba(255, 255, 255, 0.7)",
                  }}
                >
                  {formatValue(ball.value)}
                </span>
                <input
                  type="checkbox"
                  checked={!isHidden}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(ball.id);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={styles.checkbox}
                  title={isHidden ? "Show ball" : "Hide ball"}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(ball.id);
                  }}
                  className={styles.removeButton}
                  title="Remove ball"
                >
                  🗑️
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
