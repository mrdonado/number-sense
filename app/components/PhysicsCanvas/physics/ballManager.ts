import Matter from "matter-js";
import {
  TARGET_BALL_RATIO,
  BALL_RESTITUTION,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  BALL_COLORS,
} from "../constants";
import type { BallBody, BallInfo, Dimensions, PersistedBall } from "../types";

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
    name?: string,
    units?: string,
    sourceId?: string
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

    // Store the original radius, name, color, and units for future reference
    ball.originalRadius = radius;
    ball.ballName = name;
    ball.ballColor = ballColor;
    ball.ballUnits = units;
    ball.ballSourceId = sourceId;

    Matter.Composite.add(engine.world, [ball]);

    // Return ball info for the legend
    // Calculate value as area = π × radius²
    const value = Math.PI * radius * radius;
    return {
      id: ball.id,
      name: name || `Ball ${ball.id}`,
      color: ballColor,
      originalRadius: radius,
      value,
      units,
      sourceId,
    };
  }

  /**
   * Restore a ball from persisted data (with specific color)
   * Used when loading balls from localStorage
   */
  restoreBall(
    engine: Matter.Engine,
    persistedBall: PersistedBall,
    dimensions: Dimensions
  ): BallInfo {
    const { width, height } = dimensions;
    const minDimension = Math.min(width, height);
    const { originalRadius, name, color, units } = persistedBall;

    // Target display radius
    const targetDisplayRadius = (minDimension * TARGET_BALL_RATIO) / 2;

    // Get all existing dynamic bodies (balls)
    const bodies = Matter.Composite.allBodies(engine.world);
    const balls = bodies.filter((b) => !b.isStatic) as BallBody[];

    // Find the largest original radius among all balls (including the new one)
    let maxOriginalRadius = originalRadius;
    balls.forEach((ball) => {
      if (ball.originalRadius && ball.originalRadius > maxOriginalRadius) {
        maxOriginalRadius = ball.originalRadius;
      }
    });

    // Calculate scale factor
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
    const displayRadius = originalRadius * this.scaleFactor;

    const x = Math.random() * (width - displayRadius * 2) + displayRadius;

    // Create a ball with the persisted color
    const ball = Matter.Bodies.circle(x, displayRadius + 10, displayRadius, {
      restitution: BALL_RESTITUTION,
      friction: BALL_FRICTION,
      frictionAir: BALL_FRICTION_AIR,
      render: {
        fillStyle: color,
      },
    }) as BallBody;

    // Store the original radius, name, color, and units
    ball.originalRadius = originalRadius;
    ball.ballName = name;
    ball.ballColor = color;
    ball.ballUnits = units;

    Matter.Composite.add(engine.world, [ball]);

    // Calculate value as area = π × radius²
    const value = Math.PI * originalRadius * originalRadius;
    return {
      id: ball.id,
      name,
      color,
      originalRadius,
      value,
      units,
    };
  }

  /**
   * Spawn a ball at the current scale factor without recalculating
   * Used when adding a ball that shouldn't trigger rescaling (e.g., unhiding a ball)
   */
  spawnBallAtCurrentScale(
    engine: Matter.Engine,
    persistedBall: PersistedBall,
    dimensions: Dimensions
  ): BallInfo {
    const { width } = dimensions;
    const { originalRadius, name, color, units } = persistedBall;

    // Calculate the display radius using current scale factor
    const displayRadius = originalRadius * this.scaleFactor;

    const x = Math.random() * (width - displayRadius * 2) + displayRadius;

    // Create a ball with the persisted color
    const ball = Matter.Bodies.circle(x, displayRadius + 10, displayRadius, {
      restitution: BALL_RESTITUTION,
      friction: BALL_FRICTION,
      frictionAir: BALL_FRICTION_AIR,
      render: {
        fillStyle: color,
      },
    }) as BallBody;

    // Store the original radius, name, color, and units
    ball.originalRadius = originalRadius;
    ball.ballName = name;
    ball.ballColor = color;
    ball.ballUnits = units;

    Matter.Composite.add(engine.world, [ball]);

    // Calculate value as area = π × radius²
    const value = Math.PI * originalRadius * originalRadius;
    return {
      id: ball.id,
      name,
      color,
      originalRadius,
      value,
      units,
    };
  }

  /**
   * Reset the scale factor (useful when clearing all balls)
   */
  resetScale(): void {
    this.scaleFactor = 1.0;
  }

  /**
   * Get the current scale factor
   */
  getScaleFactor(): number {
    return this.scaleFactor;
  }

  /**
   * Calculate what the scale factor would be for the given visible balls
   * Used to determine if a repaint is needed
   */
  calculateScaleFactorForBalls(
    visibleBalls: BallInfo[],
    dimensions: Dimensions
  ): number {
    if (visibleBalls.length === 0) {
      return 1.0;
    }

    const minDimension = Math.min(dimensions.width, dimensions.height);
    const targetDisplayRadius = (minDimension * TARGET_BALL_RATIO) / 2;

    // Find the largest original radius among visible balls
    let maxOriginalRadius = 0;
    visibleBalls.forEach((ball) => {
      if (ball.originalRadius > maxOriginalRadius) {
        maxOriginalRadius = ball.originalRadius;
      }
    });

    if (maxOriginalRadius === 0) return 1.0;

    return targetDisplayRadius / maxOriginalRadius;
  }

  /**
   * Recalculate scale factor after removing or hiding a ball
   * Resizes all remaining visible balls so the largest fills TARGET_BALL_RATIO of the canvas
   * @param excludeIds - Set of ball IDs to exclude from scaling calculations (e.g., hidden balls)
   */
  recalculateScale(
    engine: Matter.Engine,
    dimensions: Dimensions,
    excludeIds?: Set<number>
  ): void {
    const { width, height } = dimensions;
    const minDimension = Math.min(width, height);
    const targetDisplayRadius = (minDimension * TARGET_BALL_RATIO) / 2;

    // Get all remaining dynamic bodies (balls), excluding hidden ones
    const bodies = Matter.Composite.allBodies(engine.world);
    const balls = bodies.filter(
      (b) => !b.isStatic && (!excludeIds || !excludeIds.has(b.id))
    ) as BallBody[];

    if (balls.length === 0) {
      this.scaleFactor = 1.0;
      return;
    }

    // Find the largest original radius among remaining visible balls
    let maxOriginalRadius = 0;
    balls.forEach((ball) => {
      if (ball.originalRadius && ball.originalRadius > maxOriginalRadius) {
        maxOriginalRadius = ball.originalRadius;
      }
    });

    if (maxOriginalRadius === 0) return;

    // Calculate new scale factor
    const newScaleFactor = targetDisplayRadius / maxOriginalRadius;

    // If scale factor changed, resize all balls (including hidden ones to maintain consistency)
    if (newScaleFactor !== this.scaleFactor) {
      const scaleRatio = newScaleFactor / this.scaleFactor;

      // Scale ALL balls, not just visible ones, to maintain consistency
      const allBalls = bodies.filter((b) => !b.isStatic) as BallBody[];
      allBalls.forEach((ball) => {
        if (ball.originalRadius) {
          const newRadius = ball.originalRadius * newScaleFactor;
          Matter.Body.scale(ball, scaleRatio, scaleRatio);
          ball.circleRadius = newRadius;
        }
      });

      this.scaleFactor = newScaleFactor;
    }
  }

  /**
   * Repaint all balls by removing them and respawning fresh
   * This ensures consistent sizing and positioning after visibility changes
   * @param excludeIds - Set of ball IDs to exclude from scaling calculations (hidden balls)
   * @returns New ball info array with updated IDs (preserving original order)
   */
  repaintBalls(
    engine: Matter.Engine,
    dimensions: Dimensions,
    currentBalls: BallInfo[],
    excludeIds: Set<number>
  ): { newBalls: BallInfo[]; idMapping: Map<number, number> } {
    const { width, height } = dimensions;
    const minDimension = Math.min(width, height);
    const targetDisplayRadius = (minDimension * TARGET_BALL_RATIO) / 2;

    // Get all current ball bodies
    const bodies = Matter.Composite.allBodies(engine.world);
    const ballBodies = bodies.filter((b) => !b.isStatic) as BallBody[];

    // Remove all ball bodies from the world
    ballBodies.forEach((ball) => {
      Matter.Composite.remove(engine.world, ball);
    });

    // Separate visible and hidden balls from currentBalls (preserving references)
    const visibleBallInfos = currentBalls.filter((b) => !excludeIds.has(b.id));
    const hiddenBallInfos = currentBalls.filter((b) => excludeIds.has(b.id));

    // Calculate scale factor based on visible balls only
    let maxOriginalRadius = 0;
    visibleBallInfos.forEach((ball) => {
      if (ball.originalRadius > maxOriginalRadius) {
        maxOriginalRadius = ball.originalRadius;
      }
    });

    // Set scale factor (default to 1.0 if no visible balls)
    if (maxOriginalRadius > 0) {
      this.scaleFactor = targetDisplayRadius / maxOriginalRadius;
    } else {
      this.scaleFactor = 1.0;
    }

    const idMapping = new Map<number, number>();
    const newBallInfoMap = new Map<number, BallInfo>();

    // Spawn all visible balls at the correct scale
    for (const ballInfo of visibleBallInfos) {
      const newBallInfo = this.spawnBallAtCurrentScale(
        engine,
        {
          name: ballInfo.name,
          color: ballInfo.color,
          originalRadius: ballInfo.originalRadius,
          units: ballInfo.units,
        },
        dimensions
      );
      idMapping.set(ballInfo.id, newBallInfo.id);
      newBallInfoMap.set(ballInfo.id, newBallInfo);
    }

    // Hidden balls are NOT spawned in the physics world - they're completely removed
    // We just preserve their info for the legend, using a new unique ID
    for (const ballInfo of hiddenBallInfos) {
      // Generate a new unique ID for the hidden ball (negative to avoid collision with Matter.js IDs)
      const newId = -Date.now() - Math.random();
      // Calculate value as area = π × radius²
      const value = Math.PI * ballInfo.originalRadius * ballInfo.originalRadius;
      const newBallInfo: BallInfo = {
        id: newId,
        name: ballInfo.name,
        color: ballInfo.color,
        originalRadius: ballInfo.originalRadius,
        value,
        units: ballInfo.units,
      };
      idMapping.set(ballInfo.id, newId);
      newBallInfoMap.set(ballInfo.id, newBallInfo);
    }

    // Reconstruct newBalls array in the original order
    const newBalls: BallInfo[] = currentBalls.map(
      (ball) => newBallInfoMap.get(ball.id)!
    );

    return { newBalls, idMapping };
  }
}
