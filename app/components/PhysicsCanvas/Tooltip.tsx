import { formatValue } from "@/app/utils/formatValue";
import type { BallInfo } from "./types";
import styles from "./PhysicsCanvas.module.css";

interface TooltipProps {
  ball: BallInfo;
  x: number;
  y: number;
}

export function Tooltip({ ball, x, y }: TooltipProps) {
  const formattedValue = formatValue(ball.value, ball.units);

  return (
    <div
      className={styles.tooltip}
      style={{
        left: x,
        top: y,
      }}
    >
      <span
        className={styles.tooltipIndicator}
        style={{ backgroundColor: ball.color }}
      />
      <span className={styles.tooltipName}>{ball.name}</span>
      <span className={styles.tooltipValue}>{formattedValue}</span>
    </div>
  );
}
