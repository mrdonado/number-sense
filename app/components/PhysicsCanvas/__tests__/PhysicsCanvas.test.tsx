import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import Matter from "matter-js";
import PhysicsCanvas from "../index";
import type { PhysicsCanvasHandle } from "../types";
import { setupDomMocks } from "./mocks/domMock";
import { TestWrapper } from "./helpers/TestWrapper";

// Mock Matter.js - must be inline, not imported, due to hoisting
vi.mock("matter-js", () => ({
  default: {
    Engine: {
      create: vi.fn(() => ({ world: { bodies: [] } })),
      clear: vi.fn(),
    },
    Render: {
      create: vi.fn(() => ({
        mouse: null,
        bounds: { min: { x: 0, y: 0 }, max: { x: 800, y: 596 } },
      })),
      run: vi.fn(),
      stop: vi.fn(),
    },
    Runner: {
      create: vi.fn(() => ({ enabled: true })),
      run: vi.fn(),
      stop: vi.fn(),
    },
    Mouse: {
      create: vi.fn(() => ({ position: { x: 0, y: 0 } })),
      clearSourceEvents: vi.fn(),
    },
    MouseConstraint: {
      create: vi.fn(() => ({ body: null, constraint: { stiffness: 0.2 } })),
    },
    Bodies: {
      rectangle: vi.fn(() => ({ id: "rect", isStatic: true })),
      circle: vi.fn(
        (x: number, y: number, radius: number, options?: object) => ({
          id: "circle",
          x,
          y,
          radius,
          circleRadius: radius,
          options,
          isStatic: false,
          position: { x, y },
          velocity: { x: 0, y: 0 },
        })
      ),
    },
    Body: {
      setPosition: vi.fn(),
      setVelocity: vi.fn(),
      scale: vi.fn(),
    },
    Composite: {
      add: vi.fn(),
      allBodies: vi.fn(() => []),
    },
    Query: {
      point: vi.fn(() => []),
    },
    Events: {
      on: vi.fn(),
      off: vi.fn(),
    },
  },
}));

describe("PhysicsCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDomMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("renders a container div", () => {
      const { container } = render(<PhysicsCanvas />);
      const div = container.querySelector("div");
      expect(div).toBeInTheDocument();
    });

    it("renders a canvas element", () => {
      const { container } = render(<PhysicsCanvas />);
      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
    });

    it("has correct CSS classes for layout", () => {
      const { container } = render(<PhysicsCanvas />);
      const div = container.firstChild as HTMLElement;

      expect(div).toHaveClass("w-full");
      expect(div).toHaveClass("flex-1");
      expect(div).toHaveClass("rounded-lg");
      expect(div).toHaveClass("overflow-hidden");
      expect(div).toHaveClass("bg-physics-canvas-bg");
    });
  });

  describe("physics initialization", () => {
    it("initializes Matter.js engine on mount", () => {
      render(<PhysicsCanvas />);
      expect(Matter.Engine.create).toHaveBeenCalled();
    });

    it("creates Matter.js renderer with correct dimensions", () => {
      render(<PhysicsCanvas />);
      // height is 600 - 4 (ZOOM_INDICATOR_HEIGHT) = 596
      expect(Matter.Render.create).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            width: 800,
            height: 596,
            wireframes: false,
          }),
        })
      );
    });

    it("starts the renderer and runner", () => {
      render(<PhysicsCanvas />);
      expect(Matter.Render.run).toHaveBeenCalled();
      expect(Matter.Runner.run).toHaveBeenCalled();
    });
  });

  describe("boundaries", () => {
    it("creates ground for ball containment", () => {
      render(<PhysicsCanvas />);
      // height = 596, ground at height + 30 = 626
      expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(
        400, // width / 2
        626, // height + 30
        800, // width
        60, // thickness
        expect.objectContaining({ isStatic: true })
      );
    });

    it("creates ceiling for ball containment", () => {
      render(<PhysicsCanvas />);
      expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(
        400, // width / 2
        -30, // -30
        800, // width
        60, // thickness
        expect.objectContaining({ isStatic: true })
      );
    });

    it("creates left wall for ball containment", () => {
      render(<PhysicsCanvas />);
      expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(
        -30, // -30
        298, // height / 2 = 596 / 2
        60, // thickness
        596, // height
        expect.objectContaining({ isStatic: true })
      );
    });

    it("creates right wall for ball containment", () => {
      render(<PhysicsCanvas />);
      expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(
        830, // width + 30
        298, // height / 2 = 596 / 2
        60, // thickness
        596, // height
        expect.objectContaining({ isStatic: true })
      );
    });
  });

  describe("mouse interaction", () => {
    it("creates a mouse for the canvas", () => {
      render(<PhysicsCanvas />);
      expect(Matter.Mouse.create).toHaveBeenCalled();
    });

    it("creates a mouse constraint for dragging balls", () => {
      render(<PhysicsCanvas />);
      expect(Matter.MouseConstraint.create).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          mouse: expect.any(Object),
          constraint: expect.objectContaining({
            stiffness: 0.2,
          }),
        })
      );
    });

    it("adds mouse constraint to the world", () => {
      render(<PhysicsCanvas />);
      const addCalls = (Matter.Composite.add as ReturnType<typeof vi.fn>).mock
        .calls;
      const hasMouseConstraint = addCalls.some(
        (call) =>
          call[1] && !Array.isArray(call[1]) && typeof call[1] === "object"
      );
      expect(hasMouseConstraint).toBe(true);
    });
  });

  describe("event registration", () => {
    it("registers afterRender event for cursor updates", () => {
      render(<PhysicsCanvas />);
      expect(Matter.Events.on).toHaveBeenCalledWith(
        expect.any(Object),
        "afterRender",
        expect.any(Function)
      );
    });

    it("registers afterUpdate event for escape detection", () => {
      render(<PhysicsCanvas />);
      expect(Matter.Events.on).toHaveBeenCalledWith(
        expect.any(Object),
        "afterUpdate",
        expect.any(Function)
      );
    });

    it("registers beforeRender event for zoom tracking", () => {
      render(<PhysicsCanvas />);
      expect(Matter.Events.on).toHaveBeenCalledWith(
        expect.any(Object),
        "beforeRender",
        expect.any(Function)
      );
    });
  });

  describe("spawnBall via ref", () => {
    it("exposes spawnBall method via ref", () => {
      let handle: PhysicsCanvasHandle | null = null;
      render(<TestWrapper onRef={(ref) => (handle = ref)} />);

      expect(handle).not.toBeNull();
      expect(handle!.spawnBall).toBeInstanceOf(Function);
    });

    it("creates a ball with the specified radius", async () => {
      let handle: PhysicsCanvasHandle | null = null;
      render(<TestWrapper onRef={(ref) => (handle = ref)} />);

      await act(async () => {
        handle?.spawnBall(25);
      });

      expect(Matter.Bodies.circle).toHaveBeenCalledWith(
        expect.any(Number), // random x position
        35, // radius + 10
        25, // radius
        expect.objectContaining({
          restitution: 0.7,
          friction: 0.001,
          frictionAir: 0.001,
        })
      );
    });

    it("adds the ball to the physics world", async () => {
      let handle: PhysicsCanvasHandle | null = null;
      render(<TestWrapper onRef={(ref) => (handle = ref)} />);

      await act(async () => {
        handle?.spawnBall(30);
      });

      const addCalls = (Matter.Composite.add as ReturnType<typeof vi.fn>).mock
        .calls;
      const lastCall = addCalls[addCalls.length - 1];
      expect(lastCall[1]).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "circle" })])
      );
    });

    it("spawns ball at random x position within bounds", async () => {
      let handle: PhysicsCanvasHandle | null = null;
      render(<TestWrapper onRef={(ref) => (handle = ref)} />);

      const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0.5);

      await act(async () => {
        handle?.spawnBall(20);
      });

      // With width=800, radius=20, random=0.5:
      // x = 0.5 * (800 - 40) + 20 = 400
      expect(Matter.Bodies.circle).toHaveBeenCalledWith(
        400,
        expect.any(Number),
        20,
        expect.any(Object)
      );

      mockRandom.mockRestore();
    });

    it("can spawn multiple balls", async () => {
      let handle: PhysicsCanvasHandle | null = null;
      render(<TestWrapper onRef={(ref) => (handle = ref)} />);

      const initialCircleCalls = (
        Matter.Bodies.circle as ReturnType<typeof vi.fn>
      ).mock.calls.length;

      await act(async () => {
        handle?.spawnBall(15);
        handle?.spawnBall(25);
        handle?.spawnBall(35);
      });

      const newCircleCalls =
        (Matter.Bodies.circle as ReturnType<typeof vi.fn>).mock.calls.length -
        initialCircleCalls;
      expect(newCircleCalls).toBe(3);
    });
  });

  describe("cleanup", () => {
    it("stops renderer and runner on unmount", () => {
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(Matter.Render.stop).toHaveBeenCalled();
      expect(Matter.Runner.stop).toHaveBeenCalled();
      expect(Matter.Engine.clear).toHaveBeenCalled();
    });

    it("clears mouse source events on unmount", () => {
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(Matter.Mouse.clearSourceEvents).toHaveBeenCalled();
    });

    it("unregisters afterRender event on cleanup", () => {
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(Matter.Events.off).toHaveBeenCalledWith(
        expect.any(Object),
        "afterRender",
        expect.any(Function)
      );
    });

    it("unregisters afterUpdate event on cleanup", () => {
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(Matter.Events.off).toHaveBeenCalledWith(
        expect.any(Object),
        "afterUpdate",
        expect.any(Function)
      );
    });

    it("unregisters beforeRender event on cleanup", () => {
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(Matter.Events.off).toHaveBeenCalledWith(
        expect.any(Object),
        "beforeRender",
        expect.any(Function)
      );
    });
  });
});
