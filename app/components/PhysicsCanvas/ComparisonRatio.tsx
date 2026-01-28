"use client";

import { useMemo } from "react";
import type { BallInfo, ComparisonType } from "./types";
import styles from "./PhysicsCanvas.module.css";

interface ComparisonRatioProps {
  balls: BallInfo[];
  hoveredBallId: number | null;
  hiddenBallIds: Set<number>;
  comparisonType: ComparisonType;
}

/**
 * Displays the size comparison ratio between the largest ball and the currently hovered ball
 * Shows either area or linear (diameter) comparison based on comparisonType
 */
export function ComparisonRatio({
  balls,
  hoveredBallId,
  hiddenBallIds,
  comparisonType,
}: ComparisonRatioProps) {
  const comparisonText = useMemo(() => {
    if (hoveredBallId === null) return null;

    // Get visible balls only
    const visibleBalls = balls.filter((b) => !hiddenBallIds.has(b.id));
    if (visibleBalls.length < 2) return null;

    // Find the largest ball by original radius (which represents the actual size)
    const largestBall = visibleBalls.reduce((max, ball) =>
      ball.originalRadius > max.originalRadius ? ball : max
    );

    // Find the hovered ball
    const hoveredBall = visibleBalls.find((b) => b.id === hoveredBallId);
    if (!hoveredBall) return null;

    // Don't show if the largest ball is hovered
    if (hoveredBall.id === largestBall.id) return null;

    // Calculate the ratio based on comparison type
    let ratio: number;
    if (comparisonType === "area") {
      // Area comparison: ratio of areas (π * r²)
      const largestArea = Math.PI * largestBall.originalRadius ** 2;
      const hoveredArea = Math.PI * hoveredBall.originalRadius ** 2;
      ratio = largestArea / hoveredArea;
    } else {
      // Linear comparison: ratio of diameters (2 * r)
      const largestDiameter = 2 * largestBall.originalRadius;
      const hoveredDiameter = 2 * hoveredBall.originalRadius;
      ratio = largestDiameter / hoveredDiameter;
    }

    return {
      largestName: largestBall.name,
      hoveredName: hoveredBall.name,
      ratio: ratio.toFixed(1),
    };
  }, [balls, hoveredBallId, hiddenBallIds, comparisonType]);

  if (!comparisonText) return null;

  return (
    <div className={styles.comparisonRatio}>
      <span className={styles.comparisonRatioText}>
        {comparisonText.largestName} = {comparisonText.ratio} ×{" "}
        {comparisonText.hoveredName}
      </span>
    </div>
  );
}
