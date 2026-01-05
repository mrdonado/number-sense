import { useEffect, useRef, useCallback, useState } from "react";
import Matter from "matter-js";
import { ZOOM_INDICATOR_HEIGHT } from "../constants";
import { getCSSVariable } from "../utils";
import { createBoundaries } from "../physics/createBoundaries";
import { createMouseConstraint } from "../physics/createMouseConstraint";
import { createEscapeDetectionHandler } from "../physics/escapeDetection";
import { createCursorUpdateHandler } from "../physics/cursorManager";
import { BallManager } from "../physics/ballManager";
import { useZoom } from "./useZoom";
import { usePanning } from "./usePanning";
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
  balls: BallInfo[];
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

  // These refs will be populated after physics initialization
  const zoomHookRef = useRef<ReturnType<typeof useZoom> | null>(null);
  const panningHookRef = useRef<ReturnType<typeof usePanning> | null>(null);

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

  return {
    zoomLevel,
    spawnBall,
    clearBalls,
    balls,
    hoveredBallId,
    setHoveredBallId,
    getBallAtPoint,
  };
}

// Helper functions that mirror the hook logic but work within useEffect
import {
  ZOOM_DURATION,
  BALL_VISIBLE_RATIO,
  WHEEL_ZOOM_FACTOR,
  MIN_ZOOM,
  MAX_ZOOM,
  MOUSE_STIFFNESS,
} from "../constants";
import { screenToWorld, findClosestBody } from "../utils";
import type { Bounds } from "../types";

interface ZoomHandlerOptions {
  dimensions: Dimensions;
  render: Matter.Render;
  engine: Matter.Engine;
  runner: Matter.Runner;
  mouseConstraint: Matter.MouseConstraint;
  canvas: HTMLCanvasElement;
  onZoomChange: (zoomLevel: number) => void;
}

function createZoomHandlers(options: ZoomHandlerOptions) {
  const {
    dimensions,
    render,
    engine,
    runner,
    mouseConstraint,
    canvas,
    onZoomChange,
  } = options;
  const { width, height } = dimensions;

  let zoomAnimationFrame: number | null = null;
  const isZoomedRef = { current: false };
  const zoomTargetRef = { current: null as Bounds | null };
  const isPanningRef = { current: false };

  const fullBounds: Bounds = {
    minX: 0,
    minY: 0,
    maxX: width,
    maxY: height,
  };

  const animateZoom = (from: Bounds, to: Bounds, startTime: number) => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / ZOOM_DURATION, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    render.bounds.min.x = from.minX + (to.minX - from.minX) * eased;
    render.bounds.min.y = from.minY + (to.minY - from.minY) * eased;
    render.bounds.max.x = from.maxX + (to.maxX - from.maxX) * eased;
    render.bounds.max.y = from.maxY + (to.maxY - from.maxY) * eased;

    const currentWidth = render.bounds.max.x - render.bounds.min.x;
    onZoomChange(currentWidth / width);

    if (progress < 1) {
      zoomAnimationFrame = requestAnimationFrame(() =>
        animateZoom(from, to, startTime)
      );
    } else {
      zoomAnimationFrame = null;
    }
  };

  const getCurrentBounds = (): Bounds => ({
    minX: render.bounds.min.x,
    minY: render.bounds.min.y,
    maxX: render.bounds.max.x,
    maxY: render.bounds.max.y,
  });

  const getWorldPosition = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    return screenToWorld(
      e.clientX,
      e.clientY,
      rect,
      getCurrentBounds(),
      dimensions
    );
  };

  const handleDoubleClick = (e: MouseEvent) => {
    const worldPos = getWorldPosition(e);
    const bodies = Matter.Composite.allBodies(engine.world);
    const clickedBodies = Matter.Query.point(bodies, worldPos);
    const clickedBall = clickedBodies.find((b) => !b.isStatic);

    if (!clickedBall) return;

    if (zoomAnimationFrame) {
      cancelAnimationFrame(zoomAnimationFrame);
    }

    const currentBounds = getCurrentBounds();
    const ballRadius = (clickedBall as BallBody).circleRadius || 20;
    const ballDiameter = ballRadius * 2;

    const aspectRatio = width / height;
    let viewHeight = ballDiameter / BALL_VISIBLE_RATIO;
    let viewWidth = viewHeight * aspectRatio;

    if (aspectRatio < 1) {
      viewWidth = ballDiameter / BALL_VISIBLE_RATIO;
      viewHeight = viewWidth / aspectRatio;
    }

    const targetBounds: Bounds = {
      minX: clickedBall.position.x - viewWidth / 2,
      minY: clickedBall.position.y - viewHeight / 2,
      maxX: clickedBall.position.x + viewWidth / 2,
      maxY: clickedBall.position.y + viewHeight / 2,
    };

    zoomTargetRef.current = targetBounds;
    isZoomedRef.current = true;
    runner.enabled = false;
    mouseConstraint.constraint.stiffness = 0;

    animateZoom(currentBounds, targetBounds, Date.now());
  };

  const handleClick = (e: MouseEvent) => {
    if (!isZoomedRef.current) return;

    const worldPos = getWorldPosition(e);
    const bodies = Matter.Composite.allBodies(engine.world);
    const clickedBodies = Matter.Query.point(bodies, worldPos);
    const clickedBall = clickedBodies.find((b) => !b.isStatic);

    if (clickedBall) return;

    if (zoomAnimationFrame) {
      cancelAnimationFrame(zoomAnimationFrame);
    }

    const currentBounds = getCurrentBounds();
    isZoomedRef.current = false;
    zoomTargetRef.current = null;
    runner.enabled = true;
    mouseConstraint.constraint.stiffness = MOUSE_STIFFNESS;

    animateZoom(currentBounds, fullBounds, Date.now());
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();

    if (zoomAnimationFrame) {
      cancelAnimationFrame(zoomAnimationFrame);
      zoomAnimationFrame = null;
    }

    const currentWidth = render.bounds.max.x - render.bounds.min.x;
    const currentHeight = render.bounds.max.y - render.bounds.min.y;
    const currentZoom = currentWidth / width;

    let newZoom =
      e.deltaY > 0
        ? currentZoom * WHEEL_ZOOM_FACTOR
        : currentZoom / WHEEL_ZOOM_FACTOR;

    newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

    if (newZoom === currentZoom) return;

    const rect = canvas.getBoundingClientRect();
    const mouseCanvasX = e.clientX - rect.left;
    const mouseCanvasY = e.clientY - rect.top;

    const mouseRatioX = mouseCanvasX / width;
    const mouseRatioY = mouseCanvasY / height;

    const mouseWorldX = render.bounds.min.x + mouseRatioX * currentWidth;
    const mouseWorldY = render.bounds.min.y + mouseRatioY * currentHeight;

    const newWidth = width * newZoom;
    const newHeight = height * newZoom;

    let newMinX = mouseWorldX - mouseRatioX * newWidth;
    let newMinY = mouseWorldY - mouseRatioY * newHeight;
    let newMaxX = newMinX + newWidth;
    let newMaxY = newMinY + newHeight;

    if (newZoom >= MAX_ZOOM) {
      newMinX = 0;
      newMinY = 0;
      newMaxX = width;
      newMaxY = height;
    }

    render.bounds.min.x = newMinX;
    render.bounds.min.y = newMinY;
    render.bounds.max.x = newMaxX;
    render.bounds.max.y = newMaxY;

    onZoomChange(newZoom);

    if (newZoom >= MAX_ZOOM) {
      isZoomedRef.current = false;
      zoomTargetRef.current = null;
      runner.enabled = true;
      mouseConstraint.constraint.stiffness = MOUSE_STIFFNESS;
    } else {
      isZoomedRef.current = true;
      zoomTargetRef.current = null;
      runner.enabled = false;
      mouseConstraint.constraint.stiffness = 0;
    }
  };

  const updateZoomedView = () => {
    if (!isZoomedRef.current || isPanningRef.current) return;
    if (!zoomTargetRef.current) return;

    const centerX = (render.bounds.min.x + render.bounds.max.x) / 2;
    const centerY = (render.bounds.min.y + render.bounds.max.y) / 2;

    const bodies = Matter.Composite.allBodies(engine.world);
    const closestBall = findClosestBody(bodies, { x: centerX, y: centerY });

    if (!closestBall) return;

    if (!zoomAnimationFrame) {
      const viewWidth = render.bounds.max.x - render.bounds.min.x;
      const viewHeight = render.bounds.max.y - render.bounds.min.y;

      render.bounds.min.x = closestBall.position.x - viewWidth / 2;
      render.bounds.min.y = closestBall.position.y - viewHeight / 2;
      render.bounds.max.x = closestBall.position.x + viewWidth / 2;
      render.bounds.max.y = closestBall.position.y + viewHeight / 2;
    }
  };

  const cleanup = () => {
    if (zoomAnimationFrame) {
      cancelAnimationFrame(zoomAnimationFrame);
    }
  };

  return {
    isZoomedRef,
    zoomTargetRef,
    isPanningRef,
    handleDoubleClick,
    handleClick,
    handleWheel,
    updateZoomedView,
    cleanup,
  };
}

interface PanningHandlerOptions {
  dimensions: Dimensions;
  render: Matter.Render;
  canvas: HTMLCanvasElement;
  isZoomedRef: { current: boolean };
  zoomTargetRef: { current: Bounds | null };
  isPanningRef: { current: boolean };
}

function createPanningHandlers(options: PanningHandlerOptions) {
  const {
    dimensions,
    render,
    canvas,
    isZoomedRef,
    zoomTargetRef,
    isPanningRef,
  } = options;
  const { width, height } = dimensions;

  let panStart: { x: number; y: number } | null = null;
  let panBoundsStart: { minX: number; minY: number } | null = null;

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button === 1 && isZoomedRef.current) {
      e.preventDefault();
      isPanningRef.current = true;
      panStart = { x: e.clientX, y: e.clientY };
      panBoundsStart = {
        minX: render.bounds.min.x,
        minY: render.bounds.min.y,
      };
      canvas.style.cursor = "grabbing";
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isPanningRef.current || !panStart || !panBoundsStart) return;

    const deltaX = e.clientX - panStart.x;
    const deltaY = e.clientY - panStart.y;

    const currentWidth = render.bounds.max.x - render.bounds.min.x;
    const currentHeight = render.bounds.max.y - render.bounds.min.y;
    const worldDeltaX = -(deltaX / width) * currentWidth;
    const worldDeltaY = -(deltaY / height) * currentHeight;

    let newMinX = panBoundsStart.minX + worldDeltaX;
    let newMinY = panBoundsStart.minY + worldDeltaY;

    const extraWidth = width * 0.5;
    const extraHeight = height * 0.5;

    newMinX = Math.max(-extraWidth, newMinX);
    newMinY = Math.max(-extraHeight, newMinY);
    newMinX = Math.min(width + extraWidth - currentWidth, newMinX);
    newMinY = Math.min(height + extraHeight - currentHeight, newMinY);

    render.bounds.min.x = newMinX;
    render.bounds.min.y = newMinY;
    render.bounds.max.x = newMinX + currentWidth;
    render.bounds.max.y = newMinY + currentHeight;

    if (zoomTargetRef.current) {
      zoomTargetRef.current = {
        minX: render.bounds.min.x,
        minY: render.bounds.min.y,
        maxX: render.bounds.max.x,
        maxY: render.bounds.max.y,
      };
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (e.button === 1 && isPanningRef.current) {
      isPanningRef.current = false;
      panStart = null;
      panBoundsStart = null;
      canvas.style.cursor = "default";
    }
  };

  const handleContextMenu = (e: MouseEvent) => {
    if (isPanningRef.current) {
      e.preventDefault();
    }
  };

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleContextMenu,
  };
}
