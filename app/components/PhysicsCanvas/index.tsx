"use client";

import {
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
  useState,
  useMemo,
  useSyncExternalStore,
} from "react";
import { ZOOM_INDICATOR_HEIGHT } from "./constants";
import { usePhysicsEngine } from "./hooks/usePhysicsEngine";
import { Legend } from "./Legend";
import { ComparisonRatio } from "./ComparisonRatio";
import { Controls } from "./Controls";
import { Tooltip } from "./Tooltip";
import type { PhysicsCanvasHandle, BallInfo, ComparisonType } from "./types";
import styles from "./PhysicsCanvas.module.css";

export type { PhysicsCanvasHandle } from "./types";

interface PhysicsCanvasProps {
  onBallCountChange?: (count: number) => void;
  onComparisonModeChange?: (isComparisonMode: boolean) => void;
  comparisonType?: ComparisonType;
  onComparisonTypeChange?: () => void;
  onAddData?: () => void;
  onClear?: () => void;
  onToggleComparisonMode?: () => void;
  onShare?: () => void;
}

const PhysicsCanvas = forwardRef<PhysicsCanvasHandle, PhysicsCanvasProps>(
  function PhysicsCanvas(props, ref) {
    const {
      onBallCountChange,
      onComparisonModeChange,
      comparisonType = "area",
      onComparisonTypeChange,
      onAddData,
      onClear,
      onToggleComparisonMode,
      onShare,
    } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
      null
    );
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    // Use useSyncExternalStore to handle server/client hydration for comparison type display
    const comparisonTypeDisplay = useSyncExternalStore(
      () => () => {}, // subscribe (no-op since comparisonType is controlled by parent)
      () =>
        comparisonType === "area" ? "Comparing Area" : "Comparing Diameter", // client snapshot
      () => "Comparing Area" // server snapshot
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
      wasPinching,
    } = usePhysicsEngine({
      containerRef,
      canvasRef,
      comparisonType,
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

    useImperativeHandle(ref, () => ({
      spawnBall,
      clearBalls,
      isComparisonMode,
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
        // Don't select balls if we were just pinching to zoom
        if (wasPinching()) {
          return;
        }

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
      [getBallAtPoint, setHoveredBallId, wasPinching]
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
          {/* Controls and Legend container */}
          <div
            className={styles.rightPanel}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {mounted && (
              <Controls
                comparisonTypeDisplay={comparisonTypeDisplay}
                modeText={
                  zoomLevel < 1.0 && !isComparisonMode
                    ? "Zoom Mode"
                    : isComparisonMode
                    ? "Comparison Mode"
                    : "Normal Mode"
                }
                modeTextClass={
                  zoomLevel < 1.0 && !isComparisonMode
                    ? styles.zoomModeText
                    : isComparisonMode
                    ? styles.comparisonModeText
                    : styles.normalModeText
                }
                onAddData={onAddData}
                onClear={onClear}
                onToggleComparisonMode={onToggleComparisonMode}
                onShare={onShare}
                onComparisonTypeChange={onComparisonTypeChange}
              />
            )}
            <Legend
              balls={balls}
              hoveredBallId={hoveredBallId}
              hiddenBallIds={hiddenBallIds}
              onHover={setHoveredBallId}
              onRemove={removeBall}
              onToggleVisibility={toggleBallVisibility}
              onZoom={zoomOnBall}
              isComparisonMode={isComparisonMode}
            />
          </div>
          {/* Comparison ratio display */}
          <ComparisonRatio
            balls={balls}
            hoveredBallId={hoveredBallId}
            hiddenBallIds={hiddenBallIds}
            comparisonType={comparisonType}
          />
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
