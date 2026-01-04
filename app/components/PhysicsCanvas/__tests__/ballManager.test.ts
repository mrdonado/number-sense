import { describe, it, expect, vi, beforeEach } from "vitest";
import Matter from "matter-js";
import { BallManager } from "../physics/ballManager";
import { TARGET_BALL_RATIO } from "../constants";
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

// Mock getCSSVariable
vi.mock("../utils", () => ({
  getCSSVariable: vi.fn(() => "#ff6b6b"),
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
});
