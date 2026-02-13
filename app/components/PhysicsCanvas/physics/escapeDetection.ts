import Matter from "matter-js";
import { SPEED_REDUCTION } from "../../../constants";
import type { BallBody, Dimensions } from "../types";

/**
 * Creates a handler that checks for escaped balls and wraps them to the opposite side
 */
export function createEscapeDetectionHandler(
  engine: Matter.Engine,
  dimensions: Dimensions,
): () => void {
  const { width, height } = dimensions;

  return () => {
    const bodies = Matter.Composite.allBodies(engine.world);

    bodies.forEach((body) => {
      if (body.isStatic) return;

      const { x, y } = body.position;
      const radius = (body as BallBody).circleRadius || 20;
      let newX = x;
      let newY = y;
      let escaped = false;

      // Check if ball escaped through left
      if (x < -radius * 2) {
        newX = width + radius;
        escaped = true;
      }
      // Check if ball escaped through right
      else if (x > width + radius * 2) {
        newX = -radius;
        escaped = true;
      }

      // Check if ball escaped through top
      if (y < -radius * 2) {
        newY = height + radius;
        escaped = true;
      }
      // Check if ball escaped through bottom
      else if (y > height + radius * 2) {
        newY = -radius;
        escaped = true;
      }

      if (escaped) {
        // Teleport to opposite side with reduced velocity
        Matter.Body.setPosition(body, { x: newX, y: newY });
        Matter.Body.setVelocity(body, {
          x: body.velocity.x * SPEED_REDUCTION,
          y: body.velocity.y * SPEED_REDUCTION,
        });
      }
    });
  };
}
