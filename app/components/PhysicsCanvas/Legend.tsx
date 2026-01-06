"use client";

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

export function Legend({
  balls,
  hoveredBallId,
  hiddenBallIds,
  onHover,
  onRemove,
  onToggleVisibility,
  onZoom,
}: LegendProps) {
  if (balls.length === 0) {
    return null;
  }

  return (
    <div className={styles.legend}>
      <ul className={styles.legendList}>
        {balls.map((ball) => {
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
    </div>
  );
}
