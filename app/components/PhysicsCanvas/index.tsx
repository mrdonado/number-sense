"use client";

import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
} from "react";
import { ZOOM_INDICATOR_HEIGHT } from "./constants";
import { usePhysicsEngine } from "./hooks/usePhysicsEngine";
import { Legend } from "./Legend";
import type { PhysicsCanvasHandle } from "./types";
import styles from "./PhysicsCanvas.module.css";

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
    }));

    // Handle mouse move on canvas to detect hover over balls
    const handleCanvasMouseMove = useCallback(
      (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ballId = getBallAtPoint(x, y);
        setHoveredBallId(ballId);
      },
      [getBallAtPoint, setHoveredBallId]
    );

    const handleCanvasMouseLeave = useCallback(() => {
      setHoveredBallId(null);
    }, [setHoveredBallId]);

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
        </div>
      </div>
    );
  }
);

export default PhysicsCanvas;
