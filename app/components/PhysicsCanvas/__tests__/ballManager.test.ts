import { describe, it, expect, vi, beforeEach } from "vitest";
import Matter from "matter-js";
import { BallManager } from "../physics/ballManager";
import { TARGET_BALL_RATIO, BALL_COLORS } from "../constants";
import type { BallBody } from "../types";

// Mock Matter.js
vi.mock("matter-js", () => ({
  default: {
    Bodies: {
      circle: vi.fn(
        (x: number, y: number, radius: number, options?: object) => ({
          id: Math.random(),
          position: { x, y },
          circleRadius: radius,
          isStatic: false,
          ...options,
        })
      ),
    },
    Body: {
      scale: vi.fn(),
    },
    Composite: {
      add: vi.fn(),
      allBodies: vi.fn(() => []),
    },
  },
}));

describe("BallManager", () => {
  let ballManager: BallManager;
  let mockEngine: Matter.Engine;
  const dimensions = { width: 800, height: 600 };
  // Target radius = (600 * 0.5) / 2 = 150
  const targetDisplayRadius =
    (Math.min(dimensions.width, dimensions.height) * TARGET_BALL_RATIO) / 2;

  beforeEach(() => {
    vi.clearAllMocks();
    ballManager = new BallManager();
    mockEngine = { world: { bodies: [] } } as unknown as Matter.Engine;
    // Reset allBodies mock to return empty array by default
    vi.mocked(Matter.Composite.allBodies).mockReturnValue([]);
  });

  describe("spawnBall", () => {
    it("creates a ball with Matter.Bodies.circle", () => {
      ballManager.spawnBall(mockEngine, 10, dimensions);

      expect(Matter.Bodies.circle).toHaveBeenCalled();
    });

    it("adds the ball to the physics world", () => {
      ballManager.spawnBall(mockEngine, 10, dimensions);

      expect(Matter.Composite.add).toHaveBeenCalledWith(
        mockEngine.world,
        expect.arrayContaining([expect.objectContaining({ isStatic: false })])
      );
    });

    it("scales first ball to fill TARGET_BALL_RATIO of canvas", () => {
      const originalRadius = 10;
      ballManager.spawnBall(mockEngine, originalRadius, dimensions);

      // First ball should be scaled up: displayRadius = targetDisplayRadius
      // scaleFactor = 150 / 10 = 15
      const expectedDisplayRadius = targetDisplayRadius;

      expect(Matter.Bodies.circle).toHaveBeenCalledWith(
        expect.any(Number), // random x
        expectedDisplayRadius + 10, // y position
        expectedDisplayRadius, // display radius
        expect.any(Object)
      );
    });

    it("stores original radius on the ball", () => {
      const originalRadius = 25;
      ballManager.spawnBall(mockEngine, originalRadius, dimensions);

      const addCall = vi.mocked(Matter.Composite.add).mock.calls[0];
      const addedBalls = addCall[1] as BallBody[];
      const addedBall = addedBalls[0];

      expect(addedBall.originalRadius).toBe(originalRadius);
    });

    it("stores name on the ball when provided", () => {
      ballManager.spawnBall(mockEngine, 10, dimensions, "Test Ball");

      const addCall = vi.mocked(Matter.Composite.add).mock.calls[0];
      const addedBalls = addCall[1] as BallBody[];
      const addedBall = addedBalls[0];

      expect(addedBall.ballName).toBe("Test Ball");
    });

    it("stores undefined name when not provided", () => {
      ballManager.spawnBall(mockEngine, 10, dimensions);

      const addCall = vi.mocked(Matter.Composite.add).mock.calls[0];
      const addedBalls = addCall[1] as BallBody[];
      const addedBall = addedBalls[0];

      expect(addedBall.ballName).toBeUndefined();
    });

    it("assigns a color from the palette", () => {
      ballManager.spawnBall(mockEngine, 10, dimensions);

      const addCall = vi.mocked(Matter.Composite.add).mock.calls[0];
      const addedBalls = addCall[1] as BallBody[];
      const addedBall = addedBalls[0];

      expect(BALL_COLORS).toContain(addedBall.ballColor);
    });

    it("avoids reusing colors when adding multiple balls", () => {
      const usedColors: string[] = [];

      // Spawn several balls and track their colors
      for (let i = 0; i < 5; i++) {
        // Set up mock to return existing balls with their colors
        const existingBalls = usedColors.map((color, idx) => ({
          id: idx,
          isStatic: false,
          originalRadius: 10,
          ballColor: color,
        })) as BallBody[];

        vi.mocked(Matter.Composite.allBodies).mockReturnValue(existingBalls);

        ballManager.spawnBall(mockEngine, 10, dimensions);

        const addCall = vi.mocked(Matter.Composite.add).mock.calls[i];
        const addedBalls = addCall[1] as BallBody[];
        const addedBall = addedBalls[0];

        // New color should not be in usedColors (until palette is exhausted)
        expect(usedColors).not.toContain(addedBall.ballColor);
        usedColors.push(addedBall.ballColor!);
      }
    });

    it("returns BallInfo with correct data", () => {
      const result = ballManager.spawnBall(
        mockEngine,
        25,
        dimensions,
        "Test Ball"
      );

      expect(result).toMatchObject({
        id: expect.any(Number),
        name: "Test Ball",
        color: expect.any(String),
        originalRadius: 25,
      });
      expect(BALL_COLORS).toContain(result.color);
    });

    it("returns BallInfo with default name when not provided", () => {
      const result = ballManager.spawnBall(mockEngine, 10, dimensions);

      // Default name is "Ball {id}" where id can be any number (including decimals from mock)
      expect(result.name).toMatch(/^Ball .+$/);
    });

    it("scales down existing balls when a larger ball is added", () => {
      // First, spawn a ball with radius 10 to set the internal scaleFactor
      ballManager.spawnBall(mockEngine, 10, dimensions);

      // Now set up the existing ball in the mock
      const existingBall = {
        id: 1,
        isStatic: false,
        originalRadius: 10,
        circleRadius: targetDisplayRadius, // currently at target size
      } as BallBody;

      vi.mocked(Matter.Composite.allBodies).mockReturnValue([existingBall]);
      vi.mocked(Matter.Body.scale).mockClear();

      // Add a larger ball with radius 20
      ballManager.spawnBall(mockEngine, 20, dimensions);

      // The existing ball should be scaled down
      // Old scaleFactor was 150/10 = 15, new is 150/20 = 7.5
      // scaleRatio = 7.5 / 15 = 0.5
      expect(Matter.Body.scale).toHaveBeenCalledWith(existingBall, 0.5, 0.5);
    });

    it("does not scale balls when adding smaller ball", () => {
      // Simulate that we already have the scale factor set by spawning a ball first
      ballManager.spawnBall(mockEngine, 20, dimensions);
      vi.mocked(Matter.Body.scale).mockClear();

      // Set up existing ball
      const existingBall = {
        id: 1,
        isStatic: false,
        originalRadius: 20,
        circleRadius: targetDisplayRadius,
      } as BallBody;

      vi.mocked(Matter.Composite.allBodies).mockReturnValue([existingBall]);

      // Add a smaller ball
      ballManager.spawnBall(mockEngine, 10, dimensions);

      // Existing ball should NOT be scaled (same scale factor)
      expect(Matter.Body.scale).not.toHaveBeenCalled();
    });

    it("maintains relative proportions between balls", () => {
      // First spawn a ball with radius 10
      ballManager.spawnBall(mockEngine, 10, dimensions);

      const firstBallDisplayRadius = targetDisplayRadius; // 150

      // Now simulate existing ball and add larger one
      const existingBall = {
        id: 1,
        isStatic: false,
        originalRadius: 10,
        circleRadius: firstBallDisplayRadius,
      } as BallBody;

      vi.mocked(Matter.Composite.allBodies).mockReturnValue([existingBall]);
      vi.mocked(Matter.Bodies.circle).mockClear();
      vi.mocked(Matter.Body.scale).mockClear();

      // Add ball with radius 20 (2x the first)
      ballManager.spawnBall(mockEngine, 20, dimensions);

      // New ball should be at target size (150)
      // Existing ball should be scaled to half (75)
      const secondBallCall = vi.mocked(Matter.Bodies.circle).mock.calls[0];
      const secondBallDisplayRadius = secondBallCall[2];

      expect(secondBallDisplayRadius).toBe(targetDisplayRadius);

      // Check that scale was called with ratio 0.5 (new scaleFactor / old scaleFactor)
      expect(Matter.Body.scale).toHaveBeenCalledWith(existingBall, 0.5, 0.5);
    });

    it("spawns ball at random x position within bounds", () => {
      const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0.5);

      ballManager.spawnBall(mockEngine, 10, dimensions);

      const call = vi.mocked(Matter.Bodies.circle).mock.calls[0];
      const x = call[0];
      const displayRadius = call[2];

      // x should be: 0.5 * (800 - displayRadius*2) + displayRadius
      const expectedX =
        0.5 * (dimensions.width - displayRadius * 2) + displayRadius;
      expect(x).toBeCloseTo(expectedX);

      mockRandom.mockRestore();
    });

    it("spawns ball near the top of canvas", () => {
      ballManager.spawnBall(mockEngine, 10, dimensions);

      const call = vi.mocked(Matter.Bodies.circle).mock.calls[0];
      const y = call[1];
      const displayRadius = call[2];

      expect(y).toBe(displayRadius + 10);
    });

    it("applies correct physics properties", () => {
      ballManager.spawnBall(mockEngine, 10, dimensions);

      expect(Matter.Bodies.circle).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.objectContaining({
          restitution: 0.7,
          friction: 0.001,
          frictionAir: 0.001,
        })
      );
    });
  });

  describe("resetScale", () => {
    it("resets the scale factor to 1.0", () => {
      // Spawn a ball to change the scale factor
      ballManager.spawnBall(mockEngine, 10, dimensions);

      // Reset
      ballManager.resetScale();

      // Spawn another ball - it should use scaleFactor 1.0 initially
      // But then recalculate based on target ratio
      vi.mocked(Matter.Composite.allBodies).mockReturnValue([]);
      vi.mocked(Matter.Bodies.circle).mockClear();

      ballManager.spawnBall(mockEngine, 10, dimensions);

      // The ball should still be scaled to target size
      const call = vi.mocked(Matter.Bodies.circle).mock.calls[0];
      const displayRadius = call[2];
      expect(displayRadius).toBe(targetDisplayRadius);
    });
  });

  describe("recalculateScale", () => {
    it("scales remaining balls up when largest ball is removed", () => {
      // First spawn two balls to establish scale factor
      ballManager.spawnBall(mockEngine, 10, dimensions);

      const existingSmallBall = {
        id: 1,
        isStatic: false,
        originalRadius: 10,
        circleRadius: targetDisplayRadius,
      } as BallBody;

      vi.mocked(Matter.Composite.allBodies).mockReturnValue([
        existingSmallBall,
      ]);

      // Add a larger ball - this will scale down the first one
      ballManager.spawnBall(mockEngine, 20, dimensions);

      // Now simulate that the large ball was removed, only small ball remains
      const remainingSmallBall = {
        id: 1,
        isStatic: false,
        originalRadius: 10,
        circleRadius: 75, // was scaled to half (150 * 0.5)
      } as BallBody;

      vi.mocked(Matter.Composite.allBodies).mockReturnValue([
        remainingSmallBall,
      ]);
      vi.mocked(Matter.Body.scale).mockClear();

      // Recalculate scale
      ballManager.recalculateScale(mockEngine, dimensions);

      // The small ball should be scaled up to fill target size
      // Old scaleFactor was 150/20 = 7.5, new is 150/10 = 15
      // scaleRatio = 15 / 7.5 = 2
      expect(Matter.Body.scale).toHaveBeenCalledWith(remainingSmallBall, 2, 2);
    });

    it("does not scale when scale factor remains the same", () => {
      // Spawn a ball
      ballManager.spawnBall(mockEngine, 10, dimensions);

      const existingBall = {
        id: 1,
        isStatic: false,
        originalRadius: 10,
        circleRadius: targetDisplayRadius,
      } as BallBody;

      vi.mocked(Matter.Composite.allBodies).mockReturnValue([existingBall]);
      vi.mocked(Matter.Body.scale).mockClear();

      // Recalculate - should not change anything since largest ball is still the same size
      ballManager.recalculateScale(mockEngine, dimensions);

      expect(Matter.Body.scale).not.toHaveBeenCalled();
    });

    it("resets scale factor to 1.0 when no balls remain", () => {
      // Spawn a ball to set scale factor
      ballManager.spawnBall(mockEngine, 10, dimensions);

      // Simulate all balls removed
      vi.mocked(Matter.Composite.allBodies).mockReturnValue([]);
      vi.mocked(Matter.Body.scale).mockClear();

      // Recalculate
      ballManager.recalculateScale(mockEngine, dimensions);

      // No scaling should happen
      expect(Matter.Body.scale).not.toHaveBeenCalled();

      // Verify scale factor was reset by spawning a new ball
      vi.mocked(Matter.Bodies.circle).mockClear();
      ballManager.spawnBall(mockEngine, 20, dimensions);

      // New ball should be at target size
      const call = vi.mocked(Matter.Bodies.circle).mock.calls[0];
      const displayRadius = call[2];
      expect(displayRadius).toBe(targetDisplayRadius);
    });

    it("scales all remaining balls proportionally", () => {
      // Spawn three balls: 10, 20, 40 (largest)
      ballManager.spawnBall(mockEngine, 10, dimensions);

      // Set up first ball
      const ball1 = {
        id: 1,
        isStatic: false,
        originalRadius: 10,
        circleRadius: targetDisplayRadius,
      } as BallBody;
      vi.mocked(Matter.Composite.allBodies).mockReturnValue([ball1]);

      ballManager.spawnBall(mockEngine, 20, dimensions);

      // Set up first two balls
      const ball1Scaled = {
        id: 1,
        isStatic: false,
        originalRadius: 10,
        circleRadius: 75, // scaled down
      } as BallBody;
      const ball2 = {
        id: 2,
        isStatic: false,
        originalRadius: 20,
        circleRadius: targetDisplayRadius,
      } as BallBody;
      vi.mocked(Matter.Composite.allBodies).mockReturnValue([
        ball1Scaled,
        ball2,
      ]);

      ballManager.spawnBall(mockEngine, 40, dimensions);

      // Now simulate largest ball (40) was removed
      // Remaining: ball1 (orig 10), ball2 (orig 20)
      const remainingBall1 = {
        id: 1,
        isStatic: false,
        originalRadius: 10,
        circleRadius: 37.5, // 10 * (150/40)
      } as BallBody;
      const remainingBall2 = {
        id: 2,
        isStatic: false,
        originalRadius: 20,
        circleRadius: 75, // 20 * (150/40)
      } as BallBody;

      vi.mocked(Matter.Composite.allBodies).mockReturnValue([
        remainingBall1,
        remainingBall2,
      ]);
      vi.mocked(Matter.Body.scale).mockClear();

      ballManager.recalculateScale(mockEngine, dimensions);

      // Both balls should be scaled up
      // Old scaleFactor = 150/40 = 3.75, new = 150/20 = 7.5
      // scaleRatio = 7.5 / 3.75 = 2
      expect(Matter.Body.scale).toHaveBeenCalledWith(remainingBall1, 2, 2);
      expect(Matter.Body.scale).toHaveBeenCalledWith(remainingBall2, 2, 2);
    });

    it("ignores static bodies when recalculating", () => {
      ballManager.spawnBall(mockEngine, 20, dimensions);

      // Set up a dynamic ball and a static boundary
      const dynamicBall = {
        id: 1,
        isStatic: false,
        originalRadius: 20,
        circleRadius: targetDisplayRadius,
      } as BallBody;
      const staticBoundary = {
        id: 2,
        isStatic: true,
      } as unknown as Matter.Body;

      vi.mocked(Matter.Composite.allBodies).mockReturnValue([
        dynamicBall,
        staticBoundary,
      ]);
      vi.mocked(Matter.Body.scale).mockClear();

      ballManager.recalculateScale(mockEngine, dimensions);

      // Static body should not be scaled
      expect(Matter.Body.scale).not.toHaveBeenCalledWith(
        staticBoundary,
        expect.any(Number),
        expect.any(Number)
      );
    });

    it("updates circleRadius on scaled balls", () => {
      // Spawn two balls
      ballManager.spawnBall(mockEngine, 10, dimensions);

      const smallBall = {
        id: 1,
        isStatic: false,
        originalRadius: 10,
        circleRadius: targetDisplayRadius,
      } as BallBody;
      vi.mocked(Matter.Composite.allBodies).mockReturnValue([smallBall]);

      ballManager.spawnBall(mockEngine, 20, dimensions);

      // Simulate large ball removed
      const remainingBall = {
        id: 1,
        isStatic: false,
        originalRadius: 10,
        circleRadius: 75,
      } as BallBody;

      vi.mocked(Matter.Composite.allBodies).mockReturnValue([remainingBall]);

      ballManager.recalculateScale(mockEngine, dimensions);

      // circleRadius should be updated to new display radius
      // New display radius = 10 * (150/10) = 150
      expect(remainingBall.circleRadius).toBe(targetDisplayRadius);
    });
  });

  it("stores sourceId on the ball and BallInfo when provided", () => {
    const result = ballManager.spawnBall(
      mockEngine,
      10,
      dimensions,
      "Test Ball",
      "USD",
      "gdp"
    );

    // Check BallInfo
    expect(result.sourceId).toBe("gdp");

    // Check BallBody
    const addCall = vi.mocked(Matter.Composite.add).mock.calls[0];
    const addedBalls = addCall[1] as BallBody[];
    const addedBall = addedBalls[0];
    expect(addedBall.ballSourceId).toBe("gdp");
  });

  it("returns BallInfo with undefined sourceId when not provided", () => {
    const result = ballManager.spawnBall(mockEngine, 10, dimensions);
    expect(result.sourceId).toBeUndefined();
  });
});
