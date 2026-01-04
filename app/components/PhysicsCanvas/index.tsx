"use client";

import { useRef, forwardRef, useImperativeHandle } from "react";
import { ZOOM_INDICATOR_HEIGHT } from "./constants";
import { usePhysicsEngine } from "./hooks/usePhysicsEngine";
import type { PhysicsCanvasHandle } from "./types";

export type { PhysicsCanvasHandle } from "./types";

const PhysicsCanvas = forwardRef<PhysicsCanvasHandle>(function PhysicsCanvas(
  _props,
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { zoomLevel, spawnBall } = usePhysicsEngine({
    containerRef,
    canvasRef,
  });

  useImperativeHandle(ref, () => ({
    spawnBall,
  }));

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
      <canvas ref={canvasRef} className="flex-1" />
    </div>
  );
});

export default PhysicsCanvas;
