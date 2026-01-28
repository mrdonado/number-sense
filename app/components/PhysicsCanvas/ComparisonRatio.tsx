"use client";

import { useMemo } from "react";
import type { BallInfo } from "./types";
import styles from "./PhysicsCanvas.module.css";

interface ComparisonRatioProps {
  balls: BallInfo[];
  hoveredBallId: number | null;
  hiddenBallIds: Set<number>;
}

/**
 * Displays the size comparison ratio between the largest ball and the currently hovered ball
 * Only shown in comparison mode when hovering over a ball that's not the largest
 */
export function ComparisonRatio({
  balls,
  hoveredBallId,
  hiddenBallIds,
}: ComparisonRatioProps) {
  const comparisonText = useMemo(() => {
    if (hoveredBallId === null) return null;

    // Get visible balls only
    const visibleBalls = balls.filter((b) => !hiddenBallIds.has(b.id));
    if (visibleBalls.length < 2) return null;

    // Find the largest ball by value
    const largestBall = visibleBalls.reduce((max, ball) =>
      ball.value > max.value ? ball : max
    );

    // Find the hovered ball
    const hoveredBall = visibleBalls.find((b) => b.id === hoveredBallId);
    if (!hoveredBall) return null;

    // Don't show if the largest ball is hovered
    if (hoveredBall.id === largestBall.id) return null;

    // Calculate the ratio
    const ratio = largestBall.value / hoveredBall.value;

    return {
      largestName: largestBall.name,
      hoveredName: hoveredBall.name,
      ratio: ratio.toFixed(1),
    };
  }, [balls, hoveredBallId, hiddenBallIds]);

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
