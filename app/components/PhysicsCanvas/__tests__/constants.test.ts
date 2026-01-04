import { describe, it, expect } from "vitest";
import {
  BALL_RADIUS,
  TARGET_BALL_RATIO,
  ZOOM_INDICATOR_HEIGHT,
  ZOOM_DURATION,
  BALL_VISIBLE_RATIO,
  WHEEL_ZOOM_FACTOR,
  MIN_ZOOM,
  MAX_ZOOM,
  BALL_RESTITUTION,
  BALL_FRICTION,
  BALL_FRICTION_AIR,
  SPEED_REDUCTION,
  WALL_THICKNESS,
  WALL_OFFSET,
  MOUSE_STIFFNESS,
} from "../constants";

describe("PhysicsCanvas Constants", () => {
  describe("ball configuration", () => {
    it("has valid ball radius", () => {
      expect(BALL_RADIUS).toBeGreaterThan(0);
    });

    it("has valid target ball ratio between 0 and 1", () => {
      expect(TARGET_BALL_RATIO).toBeGreaterThan(0);
      expect(TARGET_BALL_RATIO).toBeLessThanOrEqual(1);
    });

    it("has physics properties in valid ranges", () => {
      expect(BALL_RESTITUTION).toBeGreaterThanOrEqual(0);
      expect(BALL_RESTITUTION).toBeLessThanOrEqual(1);
      expect(BALL_FRICTION).toBeGreaterThanOrEqual(0);
      expect(BALL_FRICTION_AIR).toBeGreaterThanOrEqual(0);
    });
  });

  describe("zoom configuration", () => {
    it("has positive zoom indicator height", () => {
      expect(ZOOM_INDICATOR_HEIGHT).toBeGreaterThan(0);
    });

    it("has valid zoom duration", () => {
      expect(ZOOM_DURATION).toBeGreaterThan(0);
    });

    it("has ball visible ratio between 0 and 1", () => {
      expect(BALL_VISIBLE_RATIO).toBeGreaterThan(0);
      expect(BALL_VISIBLE_RATIO).toBeLessThanOrEqual(1);
    });

    it("has wheel zoom factor greater than 1", () => {
      expect(WHEEL_ZOOM_FACTOR).toBeGreaterThan(1);
    });

    it("has valid min/max zoom range", () => {
      expect(MIN_ZOOM).toBeGreaterThan(0);
      expect(MIN_ZOOM).toBeLessThan(MAX_ZOOM);
      expect(MAX_ZOOM).toBeLessThanOrEqual(1);
    });
  });

  describe("physics configuration", () => {
    it("has valid speed reduction between 0 and 1", () => {
      expect(SPEED_REDUCTION).toBeGreaterThan(0);
      expect(SPEED_REDUCTION).toBeLessThanOrEqual(1);
    });

    it("has positive wall dimensions", () => {
      expect(WALL_THICKNESS).toBeGreaterThan(0);
      expect(WALL_OFFSET).toBeGreaterThan(0);
    });

    it("has valid mouse stiffness", () => {
      expect(MOUSE_STIFFNESS).toBeGreaterThan(0);
      expect(MOUSE_STIFFNESS).toBeLessThanOrEqual(1);
    });
  });
});
