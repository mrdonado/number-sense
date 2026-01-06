import { useEffect, useRef, useCallback, useState } from "react";
import Matter from "matter-js";
import { ZOOM_INDICATOR_HEIGHT } from "../constants";
import { getCSSVariable } from "../utils";
import { createBoundaries } from "../physics/createBoundaries";
import { createMouseConstraint } from "../physics/createMouseConstraint";
import { createEscapeDetectionHandler } from "../physics/escapeDetection";
import { createCursorUpdateHandler } from "../physics/cursorManager";
import { BallManager } from "../physics/ballManager";
import { createZoomHandlers, createPanningHandlers } from "../handlers";
import type {
  BallBody,
  BallInfo,
  Dimensions,
  PersistedBall,
  PhysicsRefs,
} from "../types";

const STORAGE_KEY = "number-sense-balls";

interface UsePhysicsEngineOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

interface UsePhysicsEngineReturn {
  zoomLevel: number;
  spawnBall: (radius: number, name?: string) => void;
  clearBalls: () => void;
  removeBall: (id: number) => void;
  toggleBallVisibility: (id: number) => void;
  balls: BallInfo[];
  hiddenBallIds: Set<number>;
  hoveredBallId: number | null;
  setHoveredBallId: (id: number | null) => void;
  getBallAtPoint: (x: number, y: number) => number | null;
}

export function usePhysicsEngine(
  options: UsePhysicsEngineOptions
): UsePhysicsEngineReturn {
  const { containerRef, canvasRef } = options;

  const physicsRefs = useRef<PhysicsRefs>({
    engine: null,
    render: null,
    runner: null,
    mouseConstraint: null,
  });

  const ballManagerRef = useRef<BallManager>(new BallManager());
  const dimensionsRef = useRef<Dimensions>({ width: 0, height: 0 });
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [balls, setBalls] = useState<BallInfo[]>([]);
  const [hoveredBallId, setHoveredBallId] = useState<number | null>(null);
  const hoveredBallIdRef = useRef<number | null>(null);
  const [hiddenBallIds, setHiddenBallIds] = useState<Set<number>>(new Set());
  const hiddenBallIdsRef = useRef<Set<number>>(new Set());
  const hasRestoredBalls = useRef(false);

  // Keep ref in sync with state for use in render callback
  useEffect(() => {
    hoveredBallIdRef.current = hoveredBallId;
  }, [hoveredBallId]);

  // Persist balls to localStorage whenever they change
  useEffect(() => {
    if (balls.length === 0 && !hasRestoredBalls.current) {
      // Don't clear storage before we've had a chance to restore
      return;
    }
    const persistedBalls: PersistedBall[] = balls.map((ball) => ({
      name: ball.name,
      color: ball.color,
      originalRadius: ball.originalRadius,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedBalls));
  }, [balls]);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight - ZOOM_INDICATOR_HEIGHT;

    dimensionsRef.current = { width, height };

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Create engine
    const engine = Matter.Engine.create();
    physicsRefs.current.engine = engine;

    // Get theme colors from CSS variables
    const canvasBg = getCSSVariable("--physics-canvas-bg");

    // Create renderer
    const render = Matter.Render.create({
      canvas: canvas,
      engine: engine,
      options: {
        width: width,
        height: height,
        wireframes: false,
        background: canvasBg,
        hasBounds: true,
      },
    });
    physicsRefs.current.render = render;

    // Initialize render bounds
    render.bounds.min.x = 0;
    render.bounds.min.y = 0;
    render.bounds.max.x = width;
    render.bounds.max.y = height;

    // Create mouse and mouse constraint
    const { mouse, mouseConstraint } = createMouseConstraint(engine, canvas);
    physicsRefs.current.mouseConstraint = mouseConstraint;

    // Keep the mouse in sync with rendering
    render.mouse = mouse;

    Matter.Composite.add(engine.world, mouseConstraint);

    // Create boundaries
    const boundaries = createBoundaries({ width, height });
    Matter.Composite.add(engine.world, boundaries);

    // Create event handlers
    const checkEscapedBalls = createEscapeDetectionHandler(engine, {
      width,
      height,
    });
    const updateCursor = createCursorUpdateHandler(engine, mouse, canvas);

    // Handler to draw highlight border on hovered balls
    const drawHoverHighlight = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx || hoveredBallIdRef.current === null) return;

      // Don't draw highlight for hidden balls
      if (hiddenBallIdsRef.current.has(hoveredBallIdRef.current)) return;

      const bodies = Matter.Composite.allBodies(engine.world);
      const hoveredBall = bodies.find(
        (b) => b.id === hoveredBallIdRef.current
      ) as BallBody | undefined;

      if (hoveredBall && hoveredBall.circleRadius) {
        // Account for current zoom/pan by using render bounds
        const scaleX = width / (render.bounds.max.x - render.bounds.min.x);
        const scaleY = height / (render.bounds.max.y - render.bounds.min.y);
        const offsetX = render.bounds.min.x;
        const offsetY = render.bounds.min.y;

        const screenX = (hoveredBall.position.x - offsetX) * scaleX;
        const screenY = (hoveredBall.position.y - offsetY) * scaleY;
        const screenRadius = hoveredBall.circleRadius * scaleX;

        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    };

    Matter.Events.on(engine, "afterUpdate", checkEscapedBalls);
    Matter.Events.on(render, "afterRender", updateCursor);
    Matter.Events.on(render, "afterRender", drawHoverHighlight);

    // Run the renderer
    Matter.Render.run(render);

    // Create runner
    const runner = Matter.Runner.create();
    physicsRefs.current.runner = runner;
    Matter.Runner.run(runner, engine);

    // Set up zoom functionality
    const zoomOptions = {
      dimensions: { width, height },
      render,
      engine,
      runner,
      mouseConstraint,
      canvas,
      onZoomChange: setZoomLevel,
    };

    // We need to create the zoom handlers inline since we can't use hooks conditionally
    const {
      isZoomedRef,
      zoomTargetRef,
      isPanningRef,
      handleDoubleClick,
      handleClick,
      handleWheel,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      updateZoomedView,
      cleanup: zoomCleanup,
    } = createZoomHandlers(zoomOptions);

    // Set up panning functionality
    const panningOptions = {
      dimensions: { width, height },
      render,
      canvas,
      isZoomedRef,
      zoomTargetRef,
      isPanningRef,
    };

    const {
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleContextMenu,
    } = createPanningHandlers(panningOptions);

    // Add event listeners
    canvas.addEventListener("dblclick", handleDoubleClick);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);
    canvas.addEventListener("contextmenu", handleContextMenu);
    // Touch events for pinch-to-zoom
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
    Matter.Events.on(render, "beforeRender", updateZoomedView);

    // Restore persisted balls from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const persistedBalls: PersistedBall[] = JSON.parse(stored);
        const restoredBalls: BallInfo[] = [];

        for (const persistedBall of persistedBalls) {
          const ballInfo = ballManagerRef.current.restoreBall(
            engine,
            persistedBall,
            { width, height }
          );
          restoredBalls.push(ballInfo);
        }

        if (restoredBalls.length > 0) {
          setBalls(restoredBalls);
        }
      }
    } catch (e) {
      console.error("Failed to restore balls from localStorage:", e);
    }
    hasRestoredBalls.current = true;

    // Cleanup
    return () => {
      zoomCleanup();
      canvas.removeEventListener("dblclick", handleDoubleClick);
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      // Remove touch event listeners
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      Matter.Events.off(render, "beforeRender", updateZoomedView);
      Matter.Events.off(engine, "afterUpdate", checkEscapedBalls);
      Matter.Events.off(render, "afterRender", updateCursor);
      Matter.Events.off(render, "afterRender", drawHoverHighlight);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Mouse.clearSourceEvents(mouse);
      Matter.Engine.clear(engine);
    };
  }, [containerRef, canvasRef]);

  const spawnBall = useCallback(
    (radius: number, name?: string) => {
      if (!containerRef.current || !physicsRefs.current.engine) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      const ballInfo = ballManagerRef.current.spawnBall(
        physicsRefs.current.engine,
        radius,
        {
          width,
          height,
        },
        name
      );

      setBalls((prev) => [...prev, ballInfo]);
    },
    [containerRef]
  );

  const getBallAtPoint = useCallback(
    (screenX: number, screenY: number): number | null => {
      if (!physicsRefs.current.engine || !physicsRefs.current.render)
        return null;

      const render = physicsRefs.current.render;
      const { width, height } = dimensionsRef.current;

      // Convert screen coordinates to world coordinates accounting for zoom/pan
      const bounds = {
        minX: render.bounds.min.x,
        minY: render.bounds.min.y,
        maxX: render.bounds.max.x,
        maxY: render.bounds.max.y,
      };

      const scaleX = (bounds.maxX - bounds.minX) / width;
      const scaleY = (bounds.maxY - bounds.minY) / height;

      const worldX = bounds.minX + screenX * scaleX;
      const worldY = bounds.minY + screenY * scaleY;

      const bodies = Matter.Composite.allBodies(
        physicsRefs.current.engine.world
      );

      for (const body of bodies) {
        if (body.isStatic) continue;
        const ball = body as BallBody;
        const dx = worldX - ball.position.x;
        const dy = worldY - ball.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (ball.circleRadius && distance <= ball.circleRadius) {
          return ball.id;
        }
      }

      return null;
    },
    []
  );

  const clearBalls = useCallback(() => {
    if (!physicsRefs.current.engine) return;

    const bodies = Matter.Composite.allBodies(physicsRefs.current.engine.world);
    const dynamicBodies = bodies.filter((b) => !b.isStatic);

    // Remove all dynamic bodies (balls) from the world
    Matter.Composite.remove(physicsRefs.current.engine.world, dynamicBodies);

    // Reset the ball manager scale
    ballManagerRef.current.resetScale();

    // Clear the balls state
    setBalls([]);
  }, []);

  const removeBall = useCallback(
    (id: number) => {
      if (!physicsRefs.current.engine) return;

      // Remove from hidden set if it was hidden
      const newHiddenSet = new Set(hiddenBallIdsRef.current);
      newHiddenSet.delete(id);

      // Get current balls without the removed one
      const remainingBalls = balls.filter((b) => b.id !== id);

      if (remainingBalls.length === 0) {
        // Just remove the ball and clear everything
        const bodies = Matter.Composite.allBodies(
          physicsRefs.current.engine.world
        );
        const ballToRemove = bodies.find((b) => b.id === id);
        if (ballToRemove) {
          Matter.Composite.remove(
            physicsRefs.current.engine.world,
            ballToRemove
          );
        }
        ballManagerRef.current.resetScale();
        setBalls([]);
        setHiddenBallIds(new Set());
        hiddenBallIdsRef.current = new Set();
        return;
      }

      // Repaint all remaining balls
      const { newBalls, idMapping } = ballManagerRef.current.repaintBalls(
        physicsRefs.current.engine,
        dimensionsRef.current,
        remainingBalls,
        newHiddenSet
      );

      // Update hidden ball IDs with new IDs
      const updatedHiddenSet = new Set<number>();
      newHiddenSet.forEach((oldId) => {
        const newId = idMapping.get(oldId);
        if (newId !== undefined) {
          updatedHiddenSet.add(newId);
        }
      });

      hiddenBallIdsRef.current = updatedHiddenSet;
      setHiddenBallIds(updatedHiddenSet);
      setBalls(newBalls);
    },
    [balls]
  );

  const toggleBallVisibility = useCallback(
    (id: number) => {
      if (!physicsRefs.current.engine) return;

      // Calculate new hidden set
      const newHiddenSet = new Set(hiddenBallIdsRef.current);
      const isCurrentlyHidden = newHiddenSet.has(id);
      if (isCurrentlyHidden) {
        newHiddenSet.delete(id);
      } else {
        newHiddenSet.add(id);
      }

      // Get visible balls for the new state
      const visibleBalls = balls.filter((b) => !newHiddenSet.has(b.id));

      // Calculate what the new scale factor would be
      const newScaleFactor =
        ballManagerRef.current.calculateScaleFactorForBalls(
          visibleBalls,
          dimensionsRef.current
        );
      const currentScaleFactor = ballManagerRef.current.getScaleFactor();
      const scaleFactorChanges =
        Math.abs(newScaleFactor - currentScaleFactor) > 0.0001;

      if (scaleFactorChanges) {
        // Scale factor changes - need to repaint all visible balls
        const { newBalls, idMapping } = ballManagerRef.current.repaintBalls(
          physicsRefs.current.engine,
          dimensionsRef.current,
          balls,
          newHiddenSet
        );

        // Update hidden ball IDs with new IDs
        const updatedHiddenSet = new Set<number>();
        newHiddenSet.forEach((oldId) => {
          const newId = idMapping.get(oldId);
          if (newId !== undefined) {
            updatedHiddenSet.add(newId);
          }
        });

        hiddenBallIdsRef.current = updatedHiddenSet;
        setHiddenBallIds(updatedHiddenSet);
        setBalls(newBalls);
      } else {
        // Scale factor stays the same - just add/remove the single ball
        const ballInfo = balls.find((b) => b.id === id);
        if (!ballInfo) return;

        if (isCurrentlyHidden) {
          // Unhiding: spawn the ball at current scale
          const newBallInfo = ballManagerRef.current.spawnBallAtCurrentScale(
            physicsRefs.current.engine,
            {
              name: ballInfo.name,
              color: ballInfo.color,
              originalRadius: ballInfo.originalRadius,
            },
            dimensionsRef.current
          );

          // Update balls state with new ID
          const updatedBalls = balls.map((b) =>
            b.id === id ? newBallInfo : b
          );
          setBalls(updatedBalls);

          // Update hidden set (remove old ID since it's now visible)
          hiddenBallIdsRef.current = newHiddenSet;
          setHiddenBallIds(newHiddenSet);
        } else {
          // Hiding: remove the ball from physics world
          const bodies = Matter.Composite.allBodies(
            physicsRefs.current.engine.world
          );
          const ballToRemove = bodies.find((b) => b.id === id);
          if (ballToRemove) {
            Matter.Composite.remove(
              physicsRefs.current.engine.world,
              ballToRemove
            );
          }

          // Generate a new unique ID for the hidden ball (negative to avoid collision)
          const newId = -Date.now() - Math.random();
          const updatedBalls = balls.map((b) =>
            b.id === id ? { ...b, id: newId } : b
          );
          setBalls(updatedBalls);

          // Update hidden set with new ID
          const updatedHiddenSet = new Set(hiddenBallIdsRef.current);
          updatedHiddenSet.delete(id);
          updatedHiddenSet.add(newId);
          hiddenBallIdsRef.current = updatedHiddenSet;
          setHiddenBallIds(updatedHiddenSet);
        }
      }
    },
    [balls]
  );

  return {
    zoomLevel,
    spawnBall,
    clearBalls,
    removeBall,
    toggleBallVisibility,
    balls,
    hiddenBallIds,
    hoveredBallId,
    setHoveredBallId,
    getBallAtPoint,
  };
}
