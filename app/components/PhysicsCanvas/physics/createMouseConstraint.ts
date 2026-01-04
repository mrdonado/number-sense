import Matter from "matter-js";
import { MOUSE_STIFFNESS } from "../constants";

/**
 * Create mouse and mouse constraint for dragging balls
 */
export function createMouseConstraint(
  engine: Matter.Engine,
  canvas: HTMLCanvasElement
): { mouse: Matter.Mouse; mouseConstraint: Matter.MouseConstraint } {
  const mouse = Matter.Mouse.create(canvas);

  const mouseConstraint = Matter.MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: MOUSE_STIFFNESS,
      render: { visible: false },
    },
  });

  return { mouse, mouseConstraint };
}
