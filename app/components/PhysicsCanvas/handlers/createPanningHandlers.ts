import Matter from "matter-js";
import type { PanningHandlerOptions, PanningHandlerResult } from "./types";

// Minimum distance in pixels to move before considering it a drag vs a click
const DRAG_THRESHOLD = 5;

/**
 * Creates handlers for mouse panning when zoomed in.
 * Supports both middle-button and left-button dragging.
 * Left-button distinguishes between clicks (for zooming on balls) and drags (for panning).
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
  let panButton: number | null = null;
  let isDragging = false; // True once we've exceeded the drag threshold
  let pendingPan = false; // True when left button is down but we haven't exceeded threshold yet

  const handleMouseDown = (e: MouseEvent) => {
    if (!isZoomedRef.current) return;

    // Middle button always starts panning immediately
    if (e.button === 1) {
      e.preventDefault();
      isPanningRef.current = true;
      isDragging = true;
      // Clear zoom target so updateZoomedView won't snap back to the ball after panning
      zoomTargetRef.current = null;
      panButton = 1;
      panStart = { x: e.clientX, y: e.clientY };
      panBoundsStart = {
        minX: render.bounds.min.x,
        minY: render.bounds.min.y,
      };
      canvas.style.cursor = "grabbing";
      return;
    }

    // Left button: prepare for potential panning, but wait for drag threshold
    if (e.button === 0) {
      pendingPan = true;
      panButton = 0;
      panStart = { x: e.clientX, y: e.clientY };
      panBoundsStart = {
        minX: render.bounds.min.x,
        minY: render.bounds.min.y,
      };
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!panStart || !panBoundsStart) return;

    const deltaX = e.clientX - panStart.x;
    const deltaY = e.clientY - panStart.y;

    // Check if we should start dragging (exceeded threshold)
    if (pendingPan && !isDragging) {
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (distance >= DRAG_THRESHOLD) {
        isDragging = true;
        isPanningRef.current = true;
        // Clear zoom target so updateZoomedView won't snap back to the ball after panning
        zoomTargetRef.current = null;
        canvas.style.cursor = "grabbing";
      } else {
        return; // Haven't exceeded threshold yet
      }
    }

    if (!isPanningRef.current) return;

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
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (e.button === panButton) {
      isPanningRef.current = false;
      panStart = null;
      panBoundsStart = null;
      panButton = null;
      pendingPan = false;
      isDragging = false;
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
