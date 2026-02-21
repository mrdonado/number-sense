import { useRef, useLayoutEffect, useState } from "react";
import { formatValue } from "@/app/utils/formatValue";
import type { BallInfo } from "./types";
import styles from "./PhysicsCanvas.module.css";

interface TooltipProps {
  ball: BallInfo;
  x: number;
  y: number;
  canvasRect?: DOMRect | null;
}

/**
 * Tooltip rendered with position:fixed so it is never clipped by
 * ancestor overflow-hidden containers.  Coordinates are converted
 * from canvas-relative (x, y) to viewport-relative using the
 * supplied canvasRect, then clamped so the tooltip stays on-screen.
 */
export function Tooltip({ ball, x, y, canvasRect }: TooltipProps) {
  const formattedValue = formatValue(ball.value, ball.units);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el || !canvasRect) return;

    const tooltipW = el.offsetWidth;
    const tooltipH = el.offsetHeight;
    const gap = 12; // px gap above the cursor

    // Convert canvas-relative position to viewport-relative
    let left = canvasRect.left + x - tooltipW / 2;
    let top = canvasRect.top + y - tooltipH - gap;

    // Clamp horizontally so it never leaves the viewport
    const margin = 4;
    left = Math.max(
      margin,
      Math.min(left, window.innerWidth - tooltipW - margin),
    );
    // If tooltip would go above the viewport, flip below the cursor
    if (top < margin) {
      top = canvasRect.top + y + gap;
    }

    setPos({ left, top });
  }, [x, y, canvasRect]);

  return (
    <div
      ref={tooltipRef}
      className={styles.tooltip}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        transform: "none",
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
