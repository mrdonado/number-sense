import { describe, it, expect } from "vitest";
import { screenToWorld, clamp, findClosestBody } from "../utils";
import type { Bounds, Dimensions } from "../types";

describe("PhysicsCanvas Utils", () => {
  describe("screenToWorld", () => {
    it("converts screen coordinates to world coordinates", () => {
      const canvasRect = { left: 0, top: 0 } as DOMRect;
      const bounds: Bounds = { minX: 0, minY: 0, maxX: 800, maxY: 600 };
      const dimensions: Dimensions = { width: 800, height: 600 };

      const result = screenToWorld(400, 300, canvasRect, bounds, dimensions);

      expect(result.x).toBe(400);
      expect(result.y).toBe(300);
    });

    it("accounts for zoomed view bounds", () => {
      const canvasRect = { left: 0, top: 0 } as DOMRect;
      // Zoomed to center of screen at 2x
      const bounds: Bounds = { minX: 200, minY: 150, maxX: 600, maxY: 450 };
      const dimensions: Dimensions = { width: 800, height: 600 };

      // Screen center (400, 300) should map to world center (400, 300)
      const result = screenToWorld(400, 300, canvasRect, bounds, dimensions);

      expect(result.x).toBe(400);
      expect(result.y).toBe(300);
    });

    it("accounts for canvas offset", () => {
      const canvasRect = { left: 100, top: 50 } as DOMRect;
      const bounds: Bounds = { minX: 0, minY: 0, maxX: 800, maxY: 600 };
      const dimensions: Dimensions = { width: 800, height: 600 };

      const result = screenToWorld(500, 350, canvasRect, bounds, dimensions);

      expect(result.x).toBe(400);
      expect(result.y).toBe(300);
    });
  });

  describe("clamp", () => {
    it("returns the value if within bounds", () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it("returns min if value is below", () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it("returns max if value is above", () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it("handles edge cases at boundaries", () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });

  describe("findClosestBody", () => {
    const createMockBody = (x: number, y: number, isStatic = false) =>
      ({
        position: { x, y },
        isStatic,
      } as unknown as Matter.Body);

    it("returns null for empty array", () => {
      const result = findClosestBody([], { x: 0, y: 0 });
      expect(result).toBeNull();
    });

    it("returns null if all bodies are static", () => {
      const bodies = [
        createMockBody(100, 100, true),
        createMockBody(200, 200, true),
      ];
      const result = findClosestBody(bodies, { x: 150, y: 150 });
      expect(result).toBeNull();
    });

    it("finds the closest dynamic body", () => {
      const bodies = [
        createMockBody(100, 100, false),
        createMockBody(200, 200, false),
        createMockBody(300, 300, false),
      ];
      const result = findClosestBody(bodies, { x: 190, y: 190 });
      expect(result?.position).toEqual({ x: 200, y: 200 });
    });

    it("ignores static bodies when finding closest", () => {
      const bodies = [
        createMockBody(100, 100, true), // static, closer
        createMockBody(200, 200, false), // dynamic, farther
      ];
      const result = findClosestBody(bodies, { x: 100, y: 100 });
      expect(result?.position).toEqual({ x: 200, y: 200 });
    });
  });
});
