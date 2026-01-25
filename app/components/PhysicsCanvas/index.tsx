"use client";

import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from "react";
import { ZOOM_INDICATOR_HEIGHT } from "./constants";
import { usePhysicsEngine } from "./hooks/usePhysicsEngine";
import { Legend } from "./Legend";
import type { PhysicsCanvasHandle, BallInfo } from "./types";
import styles from "./PhysicsCanvas.module.css";

/**
 * Format a number with appropriate units based on the data type
 */
function formatValue(value: number, units?: string): string {
  // Special formatting for distance measurements in meters
  if (units === "Meters") {
    // Extremely large: use light years
    if (value >= 9.461e15) {
      const lightYears = value / 9.461e15;
      if (lightYears >= 1e9) {
        return `${(lightYears / 1e9).toFixed(2)}B ly`;
      }
      if (lightYears >= 1e6) {
        return `${(lightYears / 1e6).toFixed(2)}M ly`;
      }
      if (lightYears >= 1000) {
        return `${(lightYears / 1000).toFixed(2)}K ly`;
      }
      return `${lightYears.toFixed(2)} ly`;
    }
    // Very large: use scientific notation with meters
    if (value >= 1e15) {
      return `${value.toExponential(2)} m`;
    }
    // Large distances: kilometers
    if (value >= 1000) {
      const km = value / 1000;
      if (km >= 1e9) {
        return `${(km / 1e9).toFixed(1)}B km`;
      }
      if (km >= 1e6) {
        return `${(km / 1e6).toFixed(1)}M km`;
      }
      if (km >= 1000) {
        return `${(km / 1000).toFixed(1)}K km`;
      }
      return `${km.toFixed(1)} km`;
    }
    // Medium distances: meters
    if (value >= 1) {
      return `${value.toFixed(2)} m`;
    }
    // Centimeters
    if (value >= 0.01) {
      return `${(value * 100).toFixed(2)} cm`;
    }
    // Millimeters
    if (value >= 0.001) {
      return `${(value * 1000).toFixed(2)} mm`;
    }
    // Micrometers
    if (value >= 1e-6) {
      return `${(value * 1e6).toFixed(2)} μm`;
    }
    // Nanometers
    if (value >= 1e-9) {
      return `${(value * 1e9).toFixed(2)} nm`;
    }
    // Picometers and smaller: use scientific notation with meters
    return `${value.toExponential(2)} m`;
  }

  // Standard formatting for other unit types (USD, People, Years, etc.)
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

interface TooltipProps {
  ball: BallInfo;
  x: number;
  y: number;
}

function Tooltip({ ball, x, y }: TooltipProps) {
  const formattedValue = formatValue(ball.value, ball.units);
  // Only append units if they're not "Meters" (since formatValue handles meter conversions)
  const shouldAppendUnits = ball.units && ball.units !== "Meters";

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
      <span className={styles.tooltipValue}>
        {formattedValue}
        {shouldAppendUnits && ` ${ball.units}`}
      </span>
    </div>
  );
}

export type { PhysicsCanvasHandle } from "./types";

interface PhysicsCanvasProps {
  onBallCountChange?: (count: number) => void;
  onComparisonModeChange?: (isComparisonMode: boolean) => void;
}

const PhysicsCanvas = forwardRef<PhysicsCanvasHandle, PhysicsCanvasProps>(
  function PhysicsCanvas(props, ref) {
    const { onBallCountChange, onComparisonModeChange } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
      null
    );

    const {
      zoomLevel,
      spawnBall,
      clearBalls,
      removeBall,
      toggleBallVisibility,
      balls,
      hiddenBallIds,
      hoveredBallId,
      setHoveredBallId,
      updateMousePosition,
      getBallAtPoint,
      isComparisonMode,
      enterComparisonMode,
      exitComparisonMode,
      zoomOnBall,
    } = usePhysicsEngine({
      containerRef,
      canvasRef,
    });

    // Calculate visible ball count and notify parent
    const visibleBallCount = balls.filter(
      (b) => !hiddenBallIds.has(b.id)
    ).length;

    useEffect(() => {
      onBallCountChange?.(visibleBallCount);
    }, [visibleBallCount, onBallCountChange]);

    useEffect(() => {
      onComparisonModeChange?.(isComparisonMode);
    }, [isComparisonMode, onComparisonModeChange]);

    // Calculate if comparison mode can be entered (need at least 2 visible balls)
    const canEnterComparisonMode = visibleBallCount >= 2;

    useImperativeHandle(ref, () => ({
      spawnBall,
      clearBalls,
      isComparisonMode,
      canEnterComparisonMode,
      enterComparisonMode,
      exitComparisonMode,
      getBallNames: () => balls.map((b) => b.name),
      getBalls: () =>
        balls.map((b) => ({
          name: b.name,
          sourceId: b.sourceId || "",
          units: b.units,
        })),
    }));

    // Handle mouse move on canvas to detect hover over balls (only for devices with hover capability)
    const handleCanvasMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        // Skip hover effects for touch events (pointerType check)
        if ((e.nativeEvent as PointerEvent).pointerType === "touch") return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Update mouse position for continuous hover detection
        updateMousePosition(x, y);

        const ballId = getBallAtPoint(x, y);
        setHoveredBallId(ballId);

        // Track mouse position for tooltip (relative to canvas wrapper)
        if (ballId !== null) {
          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        } else {
          setMousePos(null);
        }
      },
      [getBallAtPoint, setHoveredBallId, updateMousePosition]
    );

    const handleCanvasMouseLeave = useCallback(() => {
      setHoveredBallId(null);
      updateMousePosition(null, null);
      setMousePos(null);
    }, [setHoveredBallId, updateMousePosition]);

    // Handle touch on canvas to activate legend item
    const handleCanvasTouchEnd = useCallback(
      (e: React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const touch = e.changedTouches[0];
        if (!touch) return;

        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        const ballId = getBallAtPoint(x, y);

        // Set the hovered state: activate if tapping a ball, deactivate if tapping background
        setHoveredBallId(ballId);
      },
      [getBallAtPoint, setHoveredBallId]
    );

    // Clear tooltip position when hover state is cleared (e.g., when ball moves away from cursor)
    useEffect(() => {
      if (hoveredBallId === null) {
        setMousePos(null);
      }
    }, [hoveredBallId]);

    // Find the hovered ball info for tooltip
    const hoveredBall = useMemo(() => {
      if (hoveredBallId === null) return null;
      return balls.find((b) => b.id === hoveredBallId) ?? null;
    }, [balls, hoveredBallId]);

    return (
      <div ref={containerRef} className={styles.container}>
        {/* Zoom indicator */}
        <div
          className={styles.zoomIndicator}
          style={{ height: ZOOM_INDICATOR_HEIGHT }}
        >
          <div
            className={styles.zoomIndicatorBar}
            style={{
              height: "100%",
              width: `${zoomLevel * 100}%`,
              transition: "width 0.1s ease-out",
            }}
          />
        </div>
        <div className={styles.canvasWrapper}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            onTouchEnd={handleCanvasTouchEnd}
          />
          <Legend
            balls={balls}
            hoveredBallId={hoveredBallId}
            hiddenBallIds={hiddenBallIds}
            onHover={setHoveredBallId}
            onRemove={removeBall}
            onToggleVisibility={toggleBallVisibility}
            onZoom={zoomOnBall}
          />
          {/* Zoom mode indicator */}
          {zoomLevel < 1.0 && !isComparisonMode && (
            <div className={styles.modeIndicator}>
              <span className={styles.zoomModeText}>Zoom Mode</span>
            </div>
          )}
          {/* Comparison mode indicator */}
          {isComparisonMode && (
            <div className={styles.modeIndicator}>
              <span className={styles.comparisonModeText}>Comparison Mode</span>
            </div>
          )}
          {/* Ball tooltip */}
          {hoveredBall && mousePos && (
            <Tooltip ball={hoveredBall} x={mousePos.x} y={mousePos.y} />
          )}
        </div>
      </div>
    );
  }
);

export default PhysicsCanvas;
