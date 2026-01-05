import Matter from "matter-js";
import {
  TARGET_BALL_RATIO,
  BALL_RESTITUTION,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_COLORS,
} from "../constants";
import type { BallBody, BallInfo, Dimensions } from "../types";

/**
 * Manages ball spawning and scaling
 */
export class BallManager {
  private scaleFactor = 1.0;

  /**
   * Spawn a new ball with the given radius
   * Handles automatic scaling so the largest ball always fills TARGET_BALL_RATIO of the canvas
   * Returns the ball info for tracking in the legend
   */
  spawnBall(
    engine: Matter.Engine,
    radius: number,
    dimensions: Dimensions,
    name?: string
  ): BallInfo {
    const { width, height } = dimensions;
    const minDimension = Math.min(width, height);

    // Target display radius: largest ball's diameter should be TARGET_BALL_RATIO of canvas
    const targetDisplayRadius = (minDimension * TARGET_BALL_RATIO) / 2;

    // Get all existing dynamic bodies (balls)
    const bodies = Matter.Composite.allBodies(engine.world);
    const balls = bodies.filter((b) => !b.isStatic) as BallBody[];

    // Find the largest original radius among all balls (including the new one)
    let maxOriginalRadius = radius;
    balls.forEach((ball) => {
      if (ball.originalRadius && ball.originalRadius > maxOriginalRadius) {
        maxOriginalRadius = ball.originalRadius;
      }
    });

    // Calculate scale factor so the largest ball fits the target size
    const newScaleFactor = targetDisplayRadius / maxOriginalRadius;

    // If scale factor changed, resize all existing balls
    if (newScaleFactor !== this.scaleFactor) {
      const scaleRatio = newScaleFactor / this.scaleFactor;

      balls.forEach((ball) => {
        if (ball.originalRadius) {
          const newRadius = ball.originalRadius * newScaleFactor;
          Matter.Body.scale(ball, scaleRatio, scaleRatio);
          ball.circleRadius = newRadius;
        }
      });

      this.scaleFactor = newScaleFactor;
    }

    // Calculate the display radius for the new ball
    const displayRadius = radius * this.scaleFactor;

    const x = Math.random() * (width - displayRadius * 2) + displayRadius;

    // Pick a color that hasn't been used yet, or random if all colors are in use
    const usedColors = new Set(balls.map((b) => b.ballColor).filter(Boolean));
    const availableColors = BALL_COLORS.filter((c) => !usedColors.has(c));
    const colorPool =
      availableColors.length > 0 ? availableColors : BALL_COLORS;
    const ballColor = colorPool[Math.floor(Math.random() * colorPool.length)];

    // Create a ball at a random x position, near the top
    const ball = Matter.Bodies.circle(x, displayRadius + 10, displayRadius, {
      restitution: BALL_RESTITUTION,
      friction: BALL_FRICTION,
      frictionAir: BALL_FRICTION_AIR,
      render: {
        fillStyle: ballColor,
      },
    }) as BallBody;

    // Store the original radius, name, and color for future reference
    ball.originalRadius = radius;
    ball.ballName = name;
    ball.ballColor = ballColor;

    Matter.Composite.add(engine.world, [ball]);

    // Return ball info for the legend
    return {
      id: ball.id,
      name: name || `Ball ${ball.id}`,
      color: ballColor,
      originalRadius: radius,
    };
  }

  /**
   * Reset the scale factor (useful when clearing all balls)
   */
  resetScale(): void {
    this.scaleFactor = 1.0;
  }
}
