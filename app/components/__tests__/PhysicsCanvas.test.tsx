import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useRef, useEffect } from "react";
import Matter from "matter-js";
import PhysicsCanvas, { PhysicsCanvasHandle } from "../PhysicsCanvas";

// Mock Matter.js
vi.mock("matter-js", () => {
  const mockEngine = {
    world: { bodies: [] },
  };

  const mockRunner = {};
  const mockRender = {};

  return {
    default: {
      Engine: {
        create: vi.fn(() => mockEngine),
        clear: vi.fn(),
      },
      Render: {
        create: vi.fn(() => mockRender),
        run: vi.fn(),
        stop: vi.fn(),
      },
      Runner: {
        create: vi.fn(() => mockRunner),
        run: vi.fn(),
        stop: vi.fn(),
      },
      Bodies: {
        rectangle: vi.fn(() => ({ id: "rect" })),
        circle: vi.fn((x, y, radius, options) => ({
          id: "circle",
          x,
          y,
          radius,
          options,
        })),
      },
      Composite: {
        add: vi.fn(),
      },
    },
  };
});

// Helper component to test the ref
function TestWrapper({
  onRef,
}: {
  onRef: (ref: PhysicsCanvasHandle | null) => void;
}) {
  const ref = useRef<PhysicsCanvasHandle>(null);

  useEffect(() => {
    onRef(ref.current);
  }, [onRef]);

  return <PhysicsCanvas ref={ref} />;
}

describe("PhysicsCanvas", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock container dimensions
    Object.defineProperty(HTMLDivElement.prototype, "clientWidth", {
      configurable: true,
      value: 800,
    });
    Object.defineProperty(HTMLDivElement.prototype, "clientHeight", {
      configurable: true,
      value: 600,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("renders a container div with canvas", () => {
      const { container } = render(<PhysicsCanvas />);
      const div = container.querySelector("div");
      expect(div).toBeInTheDocument();
    });

    it("renders a canvas element", () => {
      const { container } = render(<PhysicsCanvas />);
      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
    });

    it("initializes Matter.js engine on mount", () => {
      render(<PhysicsCanvas />);
      expect(Matter.Engine.create).toHaveBeenCalled();
    });

    it("creates Matter.js renderer with correct dimensions", () => {
      render(<PhysicsCanvas />);
      expect(Matter.Render.create).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            width: 800,
            height: 600,
            wireframes: false,
          }),
        })
      );
    });

    it("creates ground and walls for ball containment", () => {
      render(<PhysicsCanvas />);

      // Ground
      expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(
        400, // width / 2
        630, // height + 30
        800, // width
        60,
        expect.objectContaining({ isStatic: true })
      );

      // Left wall
      expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(
        -30,
        300, // height / 2
        60,
        600, // height
        expect.objectContaining({ isStatic: true })
      );

      // Right wall
      expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(
        830, // width + 30
        300, // height / 2
        60,
        600, // height
        expect.objectContaining({ isStatic: true })
      );
    });

    it("starts the renderer and runner", () => {
      render(<PhysicsCanvas />);
      expect(Matter.Render.run).toHaveBeenCalled();
      expect(Matter.Runner.run).toHaveBeenCalled();
    });
  });

  describe("spawnBall method", () => {
    it("exposes spawnBall method via ref", () => {
      let handle: PhysicsCanvasHandle | null = null;

      render(<TestWrapper onRef={(ref) => (handle = ref)} />);

      expect(handle).not.toBeNull();
      expect(handle?.spawnBall).toBeInstanceOf(Function);
    });

    it("creates a ball with the specified radius when spawnBall is called", async () => {
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

      // Composite.add should be called for ground/walls AND for the ball
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

      // Mock Math.random for predictable testing
      const mockRandom = vi.spyOn(Math, "random").mockReturnValue(0.5);

      await act(async () => {
        handle?.spawnBall(20);
      });

      // With width=800, radius=20, random=0.5:
      // x = 0.5 * (800 - 40) + 20 = 0.5 * 760 + 20 = 400
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
  });

  describe("styling", () => {
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
});
