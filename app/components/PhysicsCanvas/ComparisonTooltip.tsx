import { formatValue } from "@/app/utils/formatValue";
import type { BallInfo } from "./types";
import styles from "./PhysicsCanvas.module.css";

interface ComparisonTooltipProps {
  ball: BallInfo;
  x?: number;
  y?: number;
  ratio?: number;
  isSmaller?: boolean;
  position?: "center" | "left" | "right";
}

export function ComparisonTooltip({
  ball,
  x,
  y,
  ratio,
  isSmaller,
  position = "center",
}: ComparisonTooltipProps) {
  const formattedValue = formatValue(ball.value, ball.units);

  // Format ratio as "3.2× smaller" or "5.1× larger"
  const ratioText = ratio
    ? `${ratio.toFixed(1)}× ${isSmaller ? "smaller" : "larger"}`
    : null;

  // Position based on type
  const style: React.CSSProperties = {};

  if (position === "center" && x !== undefined && y !== undefined) {
    // Center tooltip above the focused ball
    style.left = x;
    style.top = y;
    style.transform = "translate(-50%, calc(-100% - 12px))";
  } else if (position === "left") {
    // Left tooltip below the left navigation arrow
    style.left = "4rem"; // Same as navArrowLeft left position
    style.top = "50%";
    style.transform = "translateY(3rem)"; // Below the arrow
  } else if (position === "right") {
    // Right tooltip below the right navigation arrow
    style.right = "4rem"; // Same as navArrowRight right position
    style.top = "50%";
    style.transform = "translateY(3rem)"; // Below the arrow
  } else {
    // Fallback - hide if position is invalid
    style.display = "none";
  }

  return (
    <div className={styles.comparisonTooltip} style={style}>
      <span
        className={styles.tooltipIndicator}
        style={{ backgroundColor: ball.color }}
      />
      <span className={styles.tooltipName}>{ball.name}</span>
      <span className={styles.tooltipValue}>{formattedValue}</span>
      {ratioText && <span className={styles.tooltipRatio}>{ratioText}</span>}
    </div>
  );
}
