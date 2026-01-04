import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useRef, useEffect } from "react";
import Matter from "matter-js";
import PhysicsCanvas, { PhysicsCanvasHandle } from "../PhysicsCanvas/index";

// Mock Matter.js
vi.mock("matter-js", () => {
  const mockEngine = {
    world: { bodies: [] },
  };

  const mockRunner = {};
  const mockRender = {
    mouse: null,
    bounds: {
      min: { x: 0, y: 0 },
      max: { x: 800, y: 600 },
    },
  };
  const mockMouse = { position: { x: 0, y: 0 } };
  const mockMouseConstraint = { body: null };

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
      Mouse: {
        create: vi.fn(() => mockMouse),
        clearSourceEvents: vi.fn(),
      },
      MouseConstraint: {
        create: vi.fn(() => mockMouseConstraint),
      },
      Bodies: {
        rectangle: vi.fn(() => ({ id: "rect", isStatic: true })),
        circle: vi.fn((x, y, radius, options) => ({
          id: "circle",
          x,
          y,
          radius,
          circleRadius: radius,
          options,
          isStatic: false,
          position: { x, y },
          velocity: { x: 0, y: 0 },
        })),
      },
      Body: {
        setPosition: vi.fn(),
        setVelocity: vi.fn(),
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
      // Note: height is 600 - 4 (ZOOM_INDICATOR_HEIGHT) = 596
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

    it("creates ground, ceiling and walls for ball containment", () => {
      render(<PhysicsCanvas />);

      // Note: height is 600 - 4 (ZOOM_INDICATOR_HEIGHT) = 596

      // Ground
      expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(
        400, // width / 2
        626, // height + 30 = 596 + 30
        800, // width
        60,
        expect.objectContaining({ isStatic: true })
      );

      // Ceiling
      expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(
        400, // width / 2
        -30, // -30
        800, // width
        60,
        expect.objectContaining({ isStatic: true })
      );

      // Left wall
      expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(
        -30,
        298, // height / 2 = 596 / 2
        60,
        596, // height
        expect.objectContaining({ isStatic: true })
      );

      // Right wall
      expect(Matter.Bodies.rectangle).toHaveBeenCalledWith(
        830, // width + 30
        298, // height / 2 = 596 / 2
        60,
        596, // height
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
      expect(handle!.spawnBall).toBeInstanceOf(Function);
    });

    it("creates a ball with scaled radius when spawnBall is called", async () => {
      let handle: PhysicsCanvasHandle | null = null;

      render(<TestWrapper onRef={(ref) => (handle = ref)} />);

      await act(async () => {
        handle?.spawnBall(25);
      });

      // Verify Bodies.circle was called with correct physics properties
      expect(Matter.Bodies.circle).toHaveBeenCalledWith(
        expect.any(Number), // x position
        expect.any(Number), // y position
        expect.any(Number), // radius (scaled)
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

      // Just verify Bodies.circle was called and x position is reasonable
      const circleCalls = (Matter.Bodies.circle as ReturnType<typeof vi.fn>)
        .mock.calls;
      const lastCall = circleCalls[circleCalls.length - 1];
      const xPosition = lastCall[0];

      // x should be within canvas bounds (0-800)
      expect(xPosition).toBeGreaterThan(0);
      expect(xPosition).toBeLessThan(800);

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

      // Check that Composite.add was called with the mouse constraint
      const addCalls = (Matter.Composite.add as ReturnType<typeof vi.fn>).mock
        .calls;
      const hasMouseConstraint = addCalls.some(
        (call) =>
          call[1] && !Array.isArray(call[1]) && typeof call[1] === "object"
      );
      expect(hasMouseConstraint).toBe(true);
    });

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
  });

  describe("zoom functionality", () => {
    it("registers beforeRender event for zoom tracking", () => {
      render(<PhysicsCanvas />);

      expect(Matter.Events.on).toHaveBeenCalledWith(
        expect.any(Object),
        "beforeRender",
        expect.any(Function)
      );
    });

    it("adds dblclick event listener to canvas for zoom in", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "addEventListener"
      );

      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "dblclick",
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it("adds click event listener to canvas for zoom reset", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "addEventListener"
      );

      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "click",
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it("adds wheel event listener for mouse wheel zoom", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "addEventListener"
      );

      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "wheel",
        expect.any(Function),
        { passive: false }
      );

      addEventListenerSpy.mockRestore();
    });

    it("removes dblclick event listener on cleanup", () => {
      const removeEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "removeEventListener"
      );

      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "dblclick",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it("removes click event listener on cleanup", () => {
      const removeEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "removeEventListener"
      );

      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "click",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it("removes wheel event listener on cleanup", () => {
      const removeEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "removeEventListener"
      );

      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "wheel",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
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

  describe("panning functionality", () => {
    it("adds mousedown event listener for panning", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "addEventListener"
      );

      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "mousedown",
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it("adds mousemove event listener for panning", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "addEventListener"
      );

      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "mousemove",
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it("adds mouseup event listener for panning", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "addEventListener"
      );

      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "mouseup",
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it("adds mouseleave event listener for panning", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "addEventListener"
      );

      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "mouseleave",
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it("adds contextmenu event listener to prevent context menu during panning", () => {
      const addEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "addEventListener"
      );

      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "contextmenu",
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it("removes mousedown event listener on cleanup", () => {
      const removeEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "removeEventListener"
      );

      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "mousedown",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it("removes mousemove event listener on cleanup", () => {
      const removeEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "removeEventListener"
      );

      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "mousemove",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it("removes mouseup event listener on cleanup", () => {
      const removeEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "removeEventListener"
      );

      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "mouseup",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it("removes mouseleave event listener on cleanup", () => {
      const removeEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "removeEventListener"
      );

      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "mouseleave",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });

    it("removes contextmenu event listener on cleanup", () => {
      const removeEventListenerSpy = vi.spyOn(
        HTMLCanvasElement.prototype,
        "removeEventListener"
      );

      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "contextmenu",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
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
