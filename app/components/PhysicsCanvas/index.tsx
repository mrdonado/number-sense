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
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ZOOM_INDICATOR_HEIGHT } from "./constants";
import { usePhysicsEngine } from "./hooks/usePhysicsEngine";
import { Legend } from "./Legend";
import { ComparisonRatio } from "./ComparisonRatio";
import { Controls } from "./Controls";
import { Tooltip } from "./Tooltip";
import { ComparisonTooltip } from "./ComparisonTooltip";
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
      () => (comparisonType === "area" ? "Area Mode" : "Diameter Mode"), // client snapshot
      () => "Area Mode" // server snapshot
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
      getBallScreenPosition,
      focusedBallIndex,
      setFocusedBallIndex,
      isNavigating,
      setIsNavigating,
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

    // Sort balls by value (smallest to largest) for navigation
    const sortedBalls = useMemo(() => {
      return [...balls]
        .filter((b) => !hiddenBallIds.has(b.id))
        .sort((a, b) => a.value - b.value);
    }, [balls, hiddenBallIds]);

    // Navigation handlers for comparison mode
    const handleNavigateNext = useCallback(() => {
      if (sortedBalls.length === 0) return;

      const nextIndex = (focusedBallIndex + 1) % sortedBalls.length;
      setFocusedBallIndex(nextIndex);
      setIsNavigating(true);
      const nextBall = sortedBalls[nextIndex];
      zoomOnBall(nextBall.id);
      // Clear hover state to show comparison tooltips
      setHoveredBallId(null);
    }, [
      focusedBallIndex,
      sortedBalls,
      zoomOnBall,
      setHoveredBallId,
      setFocusedBallIndex,
      setIsNavigating,
    ]);

    const handleNavigatePrev = useCallback(() => {
      if (sortedBalls.length === 0) return;

      const prevIndex =
        focusedBallIndex <= 0 ? sortedBalls.length - 1 : focusedBallIndex - 1;
      setFocusedBallIndex(prevIndex);
      setIsNavigating(true);
      const prevBall = sortedBalls[prevIndex];
      zoomOnBall(prevBall.id);
      // Clear hover state to show comparison tooltips
      setHoveredBallId(null);
    }, [
      focusedBallIndex,
      sortedBalls,
      zoomOnBall,
      setHoveredBallId,
      setFocusedBallIndex,
      setIsNavigating,
    ]);

    // Reset navigation state when exiting comparison mode
    useEffect(() => {
      if (!isComparisonMode) {
        setFocusedBallIndex(-1);
        setIsNavigating(false);
      }
    }, [isComparisonMode, setFocusedBallIndex, setIsNavigating]);

    // Calculate comparison tooltips data (current, left, right)
    const comparisonTooltips = useMemo(() => {
      // Only show tooltips during active navigation
      if (!isComparisonMode || !isNavigating || focusedBallIndex === -1) {
        return null;
      }

      const currentBall = sortedBalls[focusedBallIndex];
      if (!currentBall) return null;

      // Don't show comparison tooltips if hovering over a different ball
      if (hoveredBallId !== null && hoveredBallId !== currentBall.id) {
        return null;
      }

      // Get canvas dimensions for centering
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      const tooltips: Array<{
        ball: BallInfo;
        x?: number;
        y?: number;
        ratio?: number;
        isSmaller?: boolean;
        position: "center" | "left" | "right";
      }> = [
        {
          ball: currentBall,
          x: centerX,
          y: centerY,
          position: "center",
        },
      ];

      // Add left (smaller) ball tooltip - positioned below left navigation arrow
      if (focusedBallIndex > 0) {
        const leftBall = sortedBalls[focusedBallIndex - 1];
        const ratio = currentBall.value / leftBall.value;
        tooltips.push({
          ball: leftBall,
          ratio,
          isSmaller: true,
          position: "left",
        });
      }

      // Add right (larger) ball tooltip - positioned below right navigation arrow
      if (focusedBallIndex < sortedBalls.length - 1) {
        const rightBall = sortedBalls[focusedBallIndex + 1];
        const ratio = rightBall.value / currentBall.value;
        tooltips.push({
          ball: rightBall,
          ratio,
          isSmaller: false,
          position: "right",
        });
      }

      return tooltips;
    }, [
      isComparisonMode,
      isNavigating,
      focusedBallIndex,
      hoveredBallId,
      sortedBalls,
      canvasRef,
    ]);

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
                    : "Start Comparison"
                }
                modeTextClass={
                  zoomLevel < 1.0 && !isComparisonMode
                    ? styles.zoomModeText
                    : isComparisonMode
                    ? styles.comparisonModeText
                    : styles.normalModeText
                }
                isModeClickable={balls.length > 0}
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
          {/* Comparison tooltips */}
          {comparisonTooltips &&
            comparisonTooltips.map((tooltip) => (
              <ComparisonTooltip
                key={tooltip.ball.id}
                ball={tooltip.ball}
                x={tooltip.x}
                y={tooltip.y}
                ratio={tooltip.ratio}
                isSmaller={tooltip.isSmaller}
                position={tooltip.position}
              />
            ))}
          {/* Navigation arrows for comparison mode */}
          {isComparisonMode && sortedBalls.length > 1 && (
            <>
              <button
                className={styles.navArrowLeft}
                onClick={handleNavigatePrev}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleNavigatePrev();
                }}
                title="Previous ball (smaller)"
                aria-label="Navigate to previous ball"
              >
                <ChevronLeft size={32} />
              </button>
              <button
                className={styles.navArrowRight}
                onClick={handleNavigateNext}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleNavigateNext();
                }}
                title="Next ball (larger)"
                aria-label="Navigate to next ball"
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  }
);

export default PhysicsCanvas;
