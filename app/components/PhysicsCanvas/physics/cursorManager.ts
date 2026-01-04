import Matter from "matter-js";

/**
 * Creates a handler that updates cursor when hovering over bodies
 */
export function createCursorUpdateHandler(
  engine: Matter.Engine,
  mouse: Matter.Mouse,
  canvas: HTMLCanvasElement
): () => void {
  return () => {
    const bodies = Matter.Composite.allBodies(engine.world);
    const hoveredBodies = Matter.Query.point(bodies, mouse.position);
    // Filter out static bodies (walls, ground)
    const hoveredDynamicBodies = hoveredBodies.filter((b) => !b.isStatic);
    canvas.style.cursor =
      hoveredDynamicBodies.length > 0 ? "pointer" : "default";
  };
}
