import Matter from "matter-js";
import {
  MAX_BALL_RATIO,
  BALL_RESTITUTION,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
} from "../constants";
import { getCSSVariable } from "../utils";
import type { BallBody, Dimensions } from "../types";

/**
 * Manages ball spawning and scaling
 */
export class BallManager {
  private scaleFactor = 1.0;

  /**
   * Spawn a new ball with the given radius
   * Handles automatic scaling when balls exceed canvas size
   */
  spawnBall(
    engine: Matter.Engine,
    radius: number,
    dimensions: Dimensions
  ): void {
    const { width, height } = dimensions;
    const minDimension = Math.min(width, height);

    // Maximum allowed displayed radius based on canvas size
    const maxDisplayRadius = (minDimension * MAX_BALL_RATIO) / 2;

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

    // Calculate the required scale factor to fit the largest ball
    let newScaleFactor = 1.0;
    if (maxOriginalRadius > maxDisplayRadius) {
      newScaleFactor = maxDisplayRadius / maxOriginalRadius;
    }

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

    // Get ball color from CSS variable
    const ballColor = getCSSVariable("--physics-ball");

    // Create a ball at a random x position, near the top
    const ball = Matter.Bodies.circle(x, displayRadius + 10, displayRadius, {
      restitution: BALL_RESTITUTION,
      friction: BALL_FRICTION,
      frictionAir: BALL_FRICTION_AIR,
      render: {
        fillStyle: ballColor,
      },
    }) as BallBody;

    // Store the original radius for future scaling calculations
    ball.originalRadius = radius;

    Matter.Composite.add(engine.world, [ball]);
  }

  /**
   * Reset the scale factor (useful when clearing all balls)
   */
  resetScale(): void {
    this.scaleFactor = 1.0;
  }
}
