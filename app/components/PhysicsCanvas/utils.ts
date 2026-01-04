import Matter from "matter-js";
import type { Bounds, Dimensions } from "./types";

/**
 * Get CSS variable value from document root
 */
export function getCSSVariable(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

/**
 * Convert screen coordinates to world coordinates based on current view bounds
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  canvasRect: DOMRect,
  bounds: Bounds,
  dimensions: Dimensions
): { x: number; y: number } {
  const scaleX = (bounds.maxX - bounds.minX) / dimensions.width;
  const scaleY = (bounds.maxY - bounds.minY) / dimensions.height;

  return {
    x: bounds.minX + (screenX - canvasRect.left) * scaleX,
    y: bounds.minY + (screenY - canvasRect.top) * scaleY,
  };
}

/**
 * Find the closest dynamic body to a given point
 */
export function findClosestBody(
  bodies: Matter.Body[],
  point: { x: number; y: number }
): Matter.Body | null {
  const dynamicBodies = bodies.filter((b) => !b.isStatic);
  if (dynamicBodies.length === 0) return null;

  let closest = dynamicBodies[0];
  let closestDist = Infinity;

  dynamicBodies.forEach((body) => {
    const dist = Math.hypot(
      body.position.x - point.x,
      body.position.y - point.y
    );
    if (dist < closestDist) {
      closestDist = dist;
      closest = body;
    }
  });

  return closest;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
