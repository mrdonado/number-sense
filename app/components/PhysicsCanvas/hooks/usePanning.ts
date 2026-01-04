import { useRef, useCallback } from "react";
import type { Bounds, Dimensions } from "../types";

interface UsePanningOptions {
  dimensions: Dimensions;
  render: Matter.Render;
  canvas: HTMLCanvasElement;
  isZoomedRef: React.MutableRefObject<boolean>;
  zoomTargetRef: React.MutableRefObject<Bounds | null>;
  isPanningRef: React.MutableRefObject<boolean>;
}

interface UsePanningReturn {
  handleMouseDown: (e: MouseEvent) => void;
  handleMouseMove: (e: MouseEvent) => void;
  handleMouseUp: (e: MouseEvent) => void;
  handleContextMenu: (e: MouseEvent) => void;
}

export function usePanning(options: UsePanningOptions): UsePanningReturn {
  const {
    dimensions,
    render,
    canvas,
    isZoomedRef,
    zoomTargetRef,
    isPanningRef,
  } = options;
  const { width, height } = dimensions;

  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panBoundsStartRef = useRef<{ minX: number; minY: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      // Middle button is button 1
      if (e.button === 1 && isZoomedRef.current) {
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panBoundsStartRef.current = {
          minX: render.bounds.min.x,
          minY: render.bounds.min.y,
        };
        canvas.style.cursor = "grabbing";
      }
    },
    [render, canvas, isZoomedRef, isPanningRef]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (
        !isPanningRef.current ||
        !panStartRef.current ||
        !panBoundsStartRef.current
      )
        return;

      // Calculate delta in screen coordinates
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;

      // Convert screen delta to world delta based on current zoom
      const currentWidth = render.bounds.max.x - render.bounds.min.x;
      const currentHeight = render.bounds.max.y - render.bounds.min.y;
      const worldDeltaX = -(deltaX / width) * currentWidth;
      const worldDeltaY = -(deltaY / height) * currentHeight;

      // Apply new bounds (pan in opposite direction of mouse movement)
      let newMinX = panBoundsStartRef.current.minX + worldDeltaX;
      let newMinY = panBoundsStartRef.current.minY + worldDeltaY;

      // Allow panning up to 1.5x the scene size (0.5 extra on each side)
      const extraWidth = width * 0.5;
      const extraHeight = height * 0.5;

      // Clamp bounds to stay within extended scene area
      newMinX = Math.max(-extraWidth, newMinX);
      newMinY = Math.max(-extraHeight, newMinY);
      newMinX = Math.min(width + extraWidth - currentWidth, newMinX);
      newMinY = Math.min(height + extraHeight - currentHeight, newMinY);

      render.bounds.min.x = newMinX;
      render.bounds.min.y = newMinY;
      render.bounds.max.x = newMinX + currentWidth;
      render.bounds.max.y = newMinY + currentHeight;

      // Update zoom target to match current pan position
      if (zoomTargetRef.current) {
        zoomTargetRef.current = {
          minX: render.bounds.min.x,
          minY: render.bounds.min.y,
          maxX: render.bounds.max.x,
          maxY: render.bounds.max.y,
        };
      }
    },
    [render, width, height, isPanningRef, zoomTargetRef]
  );

  const handleMouseUp = useCallback(
    (e: MouseEvent) => {
      if (e.button === 1 && isPanningRef.current) {
        isPanningRef.current = false;
        panStartRef.current = null;
        panBoundsStartRef.current = null;
        canvas.style.cursor = "default";
      }
    },
    [canvas, isPanningRef]
  );

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      if (isPanningRef.current) {
        e.preventDefault();
      }
    },
    [isPanningRef]
  );

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
  };
}
