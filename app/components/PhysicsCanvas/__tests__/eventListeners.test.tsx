import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import PhysicsCanvas from "../index";
import { setupDomMocks, createEventListenerSpies } from "./mocks/domMock";

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
    Bodies: (() => {
      let circleIdCounter = 0;
      return {
        rectangle: vi.fn(() => ({ id: "rect", isStatic: true })),
        circle: vi.fn(() => ({
          id: `circle-${++circleIdCounter}`,
          isStatic: false,
        })),
      };
    })(),
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

describe("PhysicsCanvas Event Listeners", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDomMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("zoom event listeners", () => {
    it("adds dblclick event listener to canvas for zoom in", () => {
      const { addEventListenerSpy, restore } = createEventListenerSpies();
      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "dblclick",
        expect.any(Function)
      );

      restore();
    });

    it("adds click event listener to canvas for zoom reset", () => {
      const { addEventListenerSpy, restore } = createEventListenerSpies();
      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "click",
        expect.any(Function)
      );

      restore();
    });

    it("adds wheel event listener for mouse wheel zoom", () => {
      const { addEventListenerSpy, restore } = createEventListenerSpies();
      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "wheel",
        expect.any(Function),
        { passive: false }
      );

      restore();
    });

    it("removes dblclick event listener on cleanup", () => {
      const { removeEventListenerSpy, restore } = createEventListenerSpies();
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "dblclick",
        expect.any(Function)
      );

      restore();
    });

    it("removes click event listener on cleanup", () => {
      const { removeEventListenerSpy, restore } = createEventListenerSpies();
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "click",
        expect.any(Function)
      );

      restore();
    });

    it("removes wheel event listener on cleanup", () => {
      const { removeEventListenerSpy, restore } = createEventListenerSpies();
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "wheel",
        expect.any(Function)
      );

      restore();
    });
  });

  describe("panning event listeners", () => {
    it("adds mousedown event listener for panning", () => {
      const { addEventListenerSpy, restore } = createEventListenerSpies();
      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "mousedown",
        expect.any(Function)
      );

      restore();
    });

    it("adds mousemove event listener for panning", () => {
      const { addEventListenerSpy, restore } = createEventListenerSpies();
      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "mousemove",
        expect.any(Function)
      );

      restore();
    });

    it("adds mouseup event listener for panning", () => {
      const { addEventListenerSpy, restore } = createEventListenerSpies();
      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "mouseup",
        expect.any(Function)
      );

      restore();
    });

    it("adds mouseleave event listener for panning", () => {
      const { addEventListenerSpy, restore } = createEventListenerSpies();
      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "mouseleave",
        expect.any(Function)
      );

      restore();
    });

    it("adds contextmenu event listener to prevent context menu during panning", () => {
      const { addEventListenerSpy, restore } = createEventListenerSpies();
      render(<PhysicsCanvas />);

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "contextmenu",
        expect.any(Function)
      );

      restore();
    });

    it("removes mousedown event listener on cleanup", () => {
      const { removeEventListenerSpy, restore } = createEventListenerSpies();
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "mousedown",
        expect.any(Function)
      );

      restore();
    });

    it("removes mousemove event listener on cleanup", () => {
      const { removeEventListenerSpy, restore } = createEventListenerSpies();
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "mousemove",
        expect.any(Function)
      );

      restore();
    });

    it("removes mouseup event listener on cleanup", () => {
      const { removeEventListenerSpy, restore } = createEventListenerSpies();
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "mouseup",
        expect.any(Function)
      );

      restore();
    });

    it("removes mouseleave event listener on cleanup", () => {
      const { removeEventListenerSpy, restore } = createEventListenerSpies();
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "mouseleave",
        expect.any(Function)
      );

      restore();
    });

    it("removes contextmenu event listener on cleanup", () => {
      const { removeEventListenerSpy, restore } = createEventListenerSpies();
      const { unmount } = render(<PhysicsCanvas />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "contextmenu",
        expect.any(Function)
      );

      restore();
    });
  });
});
