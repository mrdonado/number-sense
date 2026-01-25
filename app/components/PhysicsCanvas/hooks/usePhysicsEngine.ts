import { useEffect, useRef, useCallback, useState } from "react";
import Matter from "matter-js";
import { ZOOM_INDICATOR_HEIGHT, MOUSE_STIFFNESS } from "../constants";
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
  spawnBall: (
    radius: number,
    name?: string,
    units?: string,
    sourceId?: string
  ) => void;
  clearBalls: () => void;
  removeBall: (id: number) => void;
  toggleBallVisibility: (id: number) => void;
  balls: BallInfo[];
  hiddenBallIds: Set<number>;
  hoveredBallId: number | null;
  setHoveredBallId: (id: number | null) => void;
  updateMousePosition: (x: number | null, y: number | null) => void;
  getBallAtPoint: (x: number, y: number) => number | null;
  isComparisonMode: boolean;
  enterComparisonMode: () => void;
  exitComparisonMode: () => void;
  zoomOnBall: (id: number) => void;
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
    boundaries: null,
  });

  const ballManagerRef = useRef<BallManager>(new BallManager());
  const dimensionsRef = useRef<Dimensions>({ width: 0, height: 0 });
  const [resizeKey, setResizeKey] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [balls, setBalls] = useState<BallInfo[]>([]);
  const [hoveredBallId, setHoveredBallId] = useState<number | null>(null);
  const hoveredBallIdRef = useRef<number | null>(null);
  const [hiddenBallIds, setHiddenBallIds] = useState<Set<number>>(new Set());
  const hiddenBallIdsRef = useRef<Set<number>>(new Set());
  const hasRestoredBalls = useRef(false);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const isComparisonModeRef = useRef(false);
  const savedPositionsRef = useRef<Map<number, { x: number; y: number }>>(
    new Map()
  );
  const savedRunnerEnabledRef = useRef(true);
  const zoomOnBallByIdRef = useRef<((id: number) => void) | null>(null);
  const resetZoomRef = useRef<(() => void) | null>(null);
  const exitComparisonModeRef = useRef<(() => void) | null>(null);
  const ballOpacitiesRef = useRef<Map<number, number>>(new Map());
  const mouseScreenPosRef = useRef<{ x: number; y: number } | null>(null);

  // Keep ref in sync with state for use in render callback
  useEffect(() => {
    hoveredBallIdRef.current = hoveredBallId;
  }, [hoveredBallId]);

  // Keep comparison mode ref in sync with state
  useEffect(() => {
    isComparisonModeRef.current = isComparisonMode;
  }, [isComparisonMode]);

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
      units: ball.units,
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
    physicsRefs.current.boundaries = boundaries;

    // Handle resize - trigger full re-initialization
    const handleResize = () => {
      if (!containerRef.current) return;

      const newWidth = containerRef.current.clientWidth;
      const newHeight =
        containerRef.current.clientHeight - ZOOM_INDICATOR_HEIGHT;

      // Skip if dimensions haven't actually changed
      if (
        newWidth === dimensionsRef.current.width &&
        newHeight === dimensionsRef.current.height
      ) {
        return;
      }

      // Trigger full re-initialization by incrementing resizeKey
      // Balls are persisted to localStorage, so they'll be restored automatically
      setResizeKey((k) => k + 1);
    };

    // Set up ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // Create event handlers
    const checkEscapedBalls = createEscapeDetectionHandler(engine, {
      width,
      height,
    });
    const updateCursor = createCursorUpdateHandler(engine, mouse, canvas);

    // Opacity transition speed for smooth hover effects
    const OPACITY_TRANSITION_SPEED = 0.08; // ~0.5 seconds at 60fps
    const ballOpacities = ballOpacitiesRef.current;

    // Helper to check if a ball is at a given screen position
    const isBallAtScreenPos = (
      ball: BallBody,
      screenX: number,
      screenY: number
    ): boolean => {
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

      const dx = worldX - ball.position.x;
      const dy = worldY - ball.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      return ball.circleRadius !== undefined && distance <= ball.circleRadius;
    };

    // Handler to make non-hovered balls translucent when a ball is hovered
    const updateBallOpacity = () => {
      const bodies = Matter.Composite.allBodies(engine.world);
      const ballBodies = bodies.filter((b) => !b.isStatic) as BallBody[];
      let hoveredId = hoveredBallIdRef.current;

      // Check if the hovered ball has moved away from the cursor
      const mousePos = mouseScreenPosRef.current;
      if (hoveredId !== null && mousePos !== null) {
        const hoveredBall = ballBodies.find((b) => b.id === hoveredId);
        if (
          hoveredBall &&
          !isBallAtScreenPos(hoveredBall, mousePos.x, mousePos.y)
        ) {
          // Ball moved away from cursor, clear hover state
          setHoveredBallId(null);
          hoveredId = null;
        }
      }

      const hasValidHover =
        hoveredId !== null && !hiddenBallIdsRef.current.has(hoveredId);

      ballBodies.forEach((ball) => {
        // Skip hidden balls
        if (hiddenBallIdsRef.current.has(ball.id)) return;

        const originalColor = ball.ballColor || "#ef4444";

        // Determine target opacity
        const targetOpacity =
          hasValidHover && ball.id !== hoveredId ? 0.3 : 1.0;

        // Get current opacity (default to 1.0 if not tracked)
        let currentOpacity = ballOpacities.get(ball.id) ?? 1.0;

        // Lerp towards target opacity
        if (Math.abs(currentOpacity - targetOpacity) > 0.01) {
          currentOpacity +=
            (targetOpacity - currentOpacity) * OPACITY_TRANSITION_SPEED;
          ballOpacities.set(ball.id, currentOpacity);
        } else {
          currentOpacity = targetOpacity;
          ballOpacities.set(ball.id, currentOpacity);
        }

        // Apply the interpolated opacity
        ball.render.fillStyle = addAlphaToColor(originalColor, currentOpacity);
      });

      // Clean up opacity tracking for removed balls
      for (const id of ballOpacities.keys()) {
        if (!ballBodies.some((b) => b.id === id)) {
          ballOpacities.delete(id);
        }
      }
    };

    // Helper to add alpha to a color
    const addAlphaToColor = (color: string, alpha: number): string => {
      // Handle hex colors
      if (color.startsWith("#")) {
        const hex = color.slice(1);
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
      // Handle rgb/rgba
      if (color.startsWith("rgb")) {
        const match = color.match(/[\d.]+/g);
        if (match) {
          const [r, g, b] = match;
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
      }
      return color;
    };

    Matter.Events.on(engine, "afterUpdate", checkEscapedBalls);
    Matter.Events.on(render, "afterRender", updateCursor);
    Matter.Events.on(render, "beforeRender", updateBallOpacity);

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
      isComparisonModeRef,
      onExitComparisonMode: () => exitComparisonModeRef.current?.(),
    };

    // We need to create the zoom handlers inline since we can't use hooks conditionally
    const {
      isZoomedRef,
      zoomTargetRef,
      isPanningRef,
      handleDoubleClick,
      handleClick,
      handleMouseDown: zoomHandleMouseDown,
      handleWheel,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      updateZoomedView,
      zoomOnBallById,
      resetZoom,
      cleanup: zoomCleanup,
    } = createZoomHandlers(zoomOptions);

    // Store zoomOnBallById and resetZoom in refs for external access
    zoomOnBallByIdRef.current = zoomOnBallById;
    resetZoomRef.current = resetZoom;

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
      handleMouseDown: panningHandleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleContextMenu,
    } = createPanningHandlers(panningOptions);

    // Combine zoom and panning mousedown handlers
    const handleMouseDown = (e: MouseEvent) => {
      zoomHandleMouseDown(e);
      panningHandleMouseDown(e);
    };

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
      resizeObserver.disconnect();
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
      Matter.Events.off(render, "beforeRender", updateBallOpacity);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Mouse.clearSourceEvents(mouse);
      Matter.Engine.clear(engine);
    };
  }, [containerRef, canvasRef, resizeKey]);

  const spawnBall = useCallback(
    (radius: number, name?: string, units?: string, sourceId?: string) => {
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
        name,
        units,
        sourceId
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

      // Reset ball opacities and hovered state so all balls return to normal opacity
      ballOpacitiesRef.current.clear();
      hoveredBallIdRef.current = null;
      setHoveredBallId(null);

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

  // Helper function to arrange balls in comparison layout
  const arrangeComparisonLayout = useCallback(() => {
    if (!physicsRefs.current.engine) return;

    const engine = physicsRefs.current.engine;
    const { width, height } = dimensionsRef.current;

    // Get all visible ball bodies
    const bodies = Matter.Composite.allBodies(engine.world);
    const ballBodies = bodies.filter(
      (b) => !b.isStatic && !hiddenBallIdsRef.current.has(b.id)
    ) as BallBody[];

    if (ballBodies.length === 0) return;

    // Find the largest ball by original radius
    let largestBall = ballBodies[0];
    ballBodies.forEach((ball) => {
      if ((ball.originalRadius || 0) > (largestBall.originalRadius || 0)) {
        largestBall = ball;
      }
    });

    // Center the largest ball
    const centerX = width / 2;
    const centerY = height / 2;
    Matter.Body.setPosition(largestBall, { x: centerX, y: centerY });
    Matter.Body.setVelocity(largestBall, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(largestBall, 0);

    // Get the display radius of the largest ball
    const largestRadius = largestBall.circleRadius || 50;

    // Distribute other balls around the largest one
    const otherBalls = ballBodies.filter((b) => b.id !== largestBall.id);
    const angleStep = (2 * Math.PI) / Math.max(otherBalls.length, 1);

    // Determine starting angle based on screen orientation:
    // - Portrait mode (height > width): Start from top (-π/2) for vertical arrangement
    // - Landscape mode (width > height): Start from left (π) for horizontal arrangement
    const isLandscape = width > height;
    const startAngle = isLandscape ? Math.PI : -Math.PI / 2;

    otherBalls.forEach((ball, index) => {
      const ballRadius = ball.circleRadius || 10;
      // Position so balls almost touch the largest ball (with small gap)
      const distance = largestRadius + ballRadius + 5;
      const angle = angleStep * index + startAngle;

      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;

      Matter.Body.setPosition(ball, { x, y });
      Matter.Body.setVelocity(ball, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(ball, 0);
    });
  }, []);

  const enterComparisonMode = useCallback(() => {
    if (!physicsRefs.current.engine || !physicsRefs.current.runner) return;

    const engine = physicsRefs.current.engine;
    const runner = physicsRefs.current.runner;

    // Get all visible ball bodies
    const bodies = Matter.Composite.allBodies(engine.world);
    const ballBodies = bodies.filter(
      (b) => !b.isStatic && !hiddenBallIdsRef.current.has(b.id)
    ) as BallBody[];

    if (ballBodies.length === 0) return;

    // Save current positions and runner state
    savedPositionsRef.current.clear();
    ballBodies.forEach((ball) => {
      savedPositionsRef.current.set(ball.id, {
        x: ball.position.x,
        y: ball.position.y,
      });
    });
    savedRunnerEnabledRef.current = runner.enabled;

    // Reset zoom to 1x before arranging
    resetZoomRef.current?.();

    // Arrange balls in comparison layout
    arrangeComparisonLayout();

    // Freeze the simulation
    runner.enabled = false;

    setIsComparisonMode(true);
  }, [arrangeComparisonLayout]);

  // Re-arrange balls when they change during comparison mode
  useEffect(() => {
    if (isComparisonMode && physicsRefs.current.engine) {
      // Small delay to ensure new ball is fully added to physics world
      const timeoutId = setTimeout(() => {
        arrangeComparisonLayout();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [balls, isComparisonMode, arrangeComparisonLayout]);

  const exitComparisonMode = useCallback(() => {
    if (!physicsRefs.current.engine || !physicsRefs.current.runner) return;

    const runner = physicsRefs.current.runner;

    // Reset zoom to 1x
    resetZoomRef.current?.();

    // Keep balls in their current comparison positions - just reset velocities
    const bodies = Matter.Composite.allBodies(physicsRefs.current.engine.world);
    bodies.forEach((body) => {
      if (!body.isStatic) {
        Matter.Body.setVelocity(body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(body, 0);
      }
    });

    // Always re-enable the runner when exiting comparison mode
    runner.enabled = true;

    // Restore mouse constraint stiffness so balls can be dragged
    if (physicsRefs.current.mouseConstraint) {
      physicsRefs.current.mouseConstraint.constraint.stiffness =
        MOUSE_STIFFNESS;
    }

    savedPositionsRef.current.clear();
    setIsComparisonMode(false);
  }, []);

  // Store exitComparisonMode in ref for access from zoom handlers
  useEffect(() => {
    exitComparisonModeRef.current = exitComparisonMode;
  }, [exitComparisonMode]);

  // Update mouse screen position for hover detection when ball moves away
  const updateMousePosition = useCallback(
    (x: number | null, y: number | null) => {
      if (x === null || y === null) {
        mouseScreenPosRef.current = null;
      } else {
        mouseScreenPosRef.current = { x, y };
      }
    },
    []
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
    updateMousePosition,
    getBallAtPoint,
    isComparisonMode,
    enterComparisonMode,
    exitComparisonMode,
    zoomOnBall: useCallback((id: number) => {
      zoomOnBallByIdRef.current?.(id);
    }, []),
  };
}
