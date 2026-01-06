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
      <div
        ref={containerRef}
        className="w-full flex-1 rounded-lg overflow-hidden bg-physics-canvas-bg relative flex flex-col"
      >
        {/* Zoom indicator */}
        <div
          className="w-full shrink-0 bg-zinc-700"
          style={{
            height: ZOOM_INDICATOR_HEIGHT,
          }}
        >
          <div
            className="bg-zinc-400"
            style={{
              height: "100%",
              width: `${zoomLevel * 100}%`,
              transition: "width 0.1s ease-out",
            }}
          />
        </div>
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
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
            <div className="absolute left-2 top-8 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2">
              <span className="text-green-400 text-sm font-medium">
                Zoom Mode
              </span>
            </div>
          )}
          {/* Comparison mode indicator and controls */}
          {isComparisonMode && (
            <div className="absolute left-2 top-8 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 flex flex-col gap-2">
              <span className="text-amber-400 text-sm font-medium">
                Comparison Mode
              </span>
              <button
                onClick={exitComparisonMode}
                className="text-xs bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded transition-colors"
              >
                Exit
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

export default PhysicsCanvas;
