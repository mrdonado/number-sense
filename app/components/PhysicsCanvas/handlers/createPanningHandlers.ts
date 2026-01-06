import type Matter from "matter-js";
import type { PanningHandlerOptions, PanningHandlerResult } from "./types";

/**
 * Creates handlers for mouse middle-button panning when zoomed in.
 */
export function createPanningHandlers(
  options: PanningHandlerOptions
): PanningHandlerResult {
  const {
    dimensions,
    render,
    canvas,
    isZoomedRef,
    zoomTargetRef,
    isPanningRef,
  } = options;
  const { width, height } = dimensions;

  let panStart: { x: number; y: number } | null = null;
  let panBoundsStart: { minX: number; minY: number } | null = null;

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button === 1 && isZoomedRef.current) {
      e.preventDefault();
      isPanningRef.current = true;
      panStart = { x: e.clientX, y: e.clientY };
      panBoundsStart = {
        minX: render.bounds.min.x,
        minY: render.bounds.min.y,
      };
      canvas.style.cursor = "grabbing";
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isPanningRef.current || !panStart || !panBoundsStart) return;

    const deltaX = e.clientX - panStart.x;
    const deltaY = e.clientY - panStart.y;

    const currentWidth = render.bounds.max.x - render.bounds.min.x;
    const currentHeight = render.bounds.max.y - render.bounds.min.y;
    const worldDeltaX = -(deltaX / width) * currentWidth;
    const worldDeltaY = -(deltaY / height) * currentHeight;

    let newMinX = panBoundsStart.minX + worldDeltaX;
    let newMinY = panBoundsStart.minY + worldDeltaY;

    const extraWidth = width * 0.5;
    const extraHeight = height * 0.5;

    newMinX = Math.max(-extraWidth, newMinX);
    newMinY = Math.max(-extraHeight, newMinY);
    newMinX = Math.min(width + extraWidth - currentWidth, newMinX);
    newMinY = Math.min(height + extraHeight - currentHeight, newMinY);

    render.bounds.min.x = newMinX;
    render.bounds.min.y = newMinY;
    render.bounds.max.x = newMinX + currentWidth;
    render.bounds.max.y = newMinY + currentHeight;

    if (zoomTargetRef.current) {
      zoomTargetRef.current = {
        minX: render.bounds.min.x,
        minY: render.bounds.min.y,
        maxX: render.bounds.max.x,
        maxY: render.bounds.max.y,
      };
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (e.button === 1 && isPanningRef.current) {
      isPanningRef.current = false;
      panStart = null;
      panBoundsStart = null;
      canvas.style.cursor = "default";
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    if (isPanningRef.current) {
      e.preventDefault();
    }
  };

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
  };
}
