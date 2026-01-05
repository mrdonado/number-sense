"use client";

import { useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { ZOOM_INDICATOR_HEIGHT } from "./constants";
import { usePhysicsEngine } from "./hooks/usePhysicsEngine";
import { Legend } from "./Legend";
import type { PhysicsCanvasHandle } from "./types";

export type { PhysicsCanvasHandle } from "./types";

const PhysicsCanvas = forwardRef<PhysicsCanvasHandle>(function PhysicsCanvas(
  _props,
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    zoomLevel,
    spawnBall,
    clearBalls,
    removeBall,
    balls,
    hoveredBallId,
    setHoveredBallId,
    getBallAtPoint,
  } = usePhysicsEngine({
    containerRef,
    canvasRef,
  });

  useImperativeHandle(ref, () => ({
    spawnBall,
    clearBalls,
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
          onHover={setHoveredBallId}
          onRemove={removeBall}
        />
      </div>
    </div>
  );
});

export default PhysicsCanvas;
