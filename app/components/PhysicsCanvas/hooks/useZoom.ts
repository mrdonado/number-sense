import { useRef, useCallback } from "react";
import Matter from "matter-js";
import {
  ZOOM_DURATION,
  BALL_VISIBLE_RATIO,
  WHEEL_ZOOM_FACTOR,
  MIN_ZOOM,
  MAX_ZOOM,
  MOUSE_STIFFNESS,
} from "../constants";
import { screenToWorld, findClosestBody } from "../utils";
import type { Bounds, Dimensions, BallBody } from "../types";

interface UseZoomOptions {
  dimensions: Dimensions;
  render: Matter.Render;
  engine: Matter.Engine;
  runner: Matter.Runner;
  mouseConstraint: Matter.MouseConstraint;
  canvas: HTMLCanvasElement;
  onZoomChange: (zoomLevel: number) => void;
}

interface UseZoomReturn {
  isZoomedRef: React.MutableRefObject<boolean>;
  zoomTargetRef: React.MutableRefObject<Bounds | null>;
  isPanningRef: React.MutableRefObject<boolean>;
  handleDoubleClick: (e: MouseEvent) => void;
  handleClick: (e: MouseEvent) => void;
  handleWheel: (e: WheelEvent) => void;
  updateZoomedView: () => void;
  cleanup: () => void;
}

export function useZoom(options: UseZoomOptions): UseZoomReturn {
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

  const zoomAnimationRef = useRef<number | null>(null);
  const zoomTargetRef = useRef<Bounds | null>(null);
  const isZoomedRef = useRef(false);
  const isPanningRef = useRef(false);

  const fullBounds: Bounds = {
    minX: 0,
    minY: 0,
    maxX: width,
    maxY: height,
  };

  const animateZoom = useCallback(
    (from: Bounds, to: Bounds, startTime: number) => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / ZOOM_DURATION, 1);

      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3);

      render.bounds.min.x = from.minX + (to.minX - from.minX) * eased;
      render.bounds.min.y = from.minY + (to.minY - from.minY) * eased;
      render.bounds.max.x = from.maxX + (to.maxX - from.maxX) * eased;
      render.bounds.max.y = from.maxY + (to.maxY - from.maxY) * eased;

      // Update zoom indicator
      const currentWidth = render.bounds.max.x - render.bounds.min.x;
      onZoomChange(currentWidth / width);

      if (progress < 1) {
        zoomAnimationRef.current = requestAnimationFrame(() =>
          animateZoom(from, to, startTime)
        );
      } else {
        zoomAnimationRef.current = null;
      }
    },
    [render, width, onZoomChange]
  );

  const getCurrentBounds = useCallback(
    (): Bounds => ({
      minX: render.bounds.min.x,
      minY: render.bounds.min.y,
      maxX: render.bounds.max.x,
      maxY: render.bounds.max.y,
    }),
    [render]
  );

  const getWorldPosition = useCallback(
    (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return screenToWorld(
        e.clientX,
        e.clientY,
        rect,
        getCurrentBounds(),
        dimensions
      );
    },
    [canvas, getCurrentBounds, dimensions]
  );

  const handleDoubleClick = useCallback(
    (e: MouseEvent) => {
      const worldPos = getWorldPosition(e);

      const bodies = Matter.Composite.allBodies(engine.world);
      const clickedBodies = Matter.Query.point(bodies, worldPos);
      const clickedBall = clickedBodies.find((b) => !b.isStatic);

      if (!clickedBall) return;

      // Cancel any ongoing animation
      if (zoomAnimationRef.current) {
        cancelAnimationFrame(zoomAnimationRef.current);
      }

      const currentBounds = getCurrentBounds();

      // Zoom in on the ball - ball diameter should be 85% of visible area
      const ballRadius = (clickedBall as BallBody).circleRadius || 20;
      const ballDiameter = ballRadius * 2;

      // Calculate view size so ball takes 85% of the smaller dimension
      const aspectRatio = width / height;
      let viewHeight = ballDiameter / BALL_VISIBLE_RATIO;
      let viewWidth = viewHeight * aspectRatio;

      // If width is smaller than height, calculate based on width
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

      // Freeze physics and disable dragging
      runner.enabled = false;
      mouseConstraint.constraint.stiffness = 0;

      animateZoom(currentBounds, targetBounds, Date.now());
    },
    [
      engine,
      runner,
      mouseConstraint,
      width,
      height,
      getWorldPosition,
      getCurrentBounds,
      animateZoom,
    ]
  );

  const handleClick = useCallback(
    (e: MouseEvent) => {
      // Only reset if we're zoomed in
      if (!isZoomedRef.current) return;

      const worldPos = getWorldPosition(e);

      const bodies = Matter.Composite.allBodies(engine.world);
      const clickedBodies = Matter.Query.point(bodies, worldPos);
      const clickedBall = clickedBodies.find((b) => !b.isStatic);

      // Only reset if clicking on background (not on a ball)
      if (clickedBall) return;

      // Cancel any ongoing animation
      if (zoomAnimationRef.current) {
        cancelAnimationFrame(zoomAnimationRef.current);
      }

      const currentBounds = getCurrentBounds();

      // Zoom out to full view
      isZoomedRef.current = false;
      zoomTargetRef.current = null;

      // Resume physics and enable dragging
      runner.enabled = true;
      mouseConstraint.constraint.stiffness = MOUSE_STIFFNESS;

      animateZoom(currentBounds, fullBounds, Date.now());
    },
    [
      engine,
      runner,
      mouseConstraint,
      fullBounds,
      getWorldPosition,
      getCurrentBounds,
      animateZoom,
    ]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      // Cancel any ongoing animation
      if (zoomAnimationRef.current) {
        cancelAnimationFrame(zoomAnimationRef.current);
        zoomAnimationRef.current = null;
      }

      // Get current view dimensions
      const currentWidth = render.bounds.max.x - render.bounds.min.x;
      const currentHeight = render.bounds.max.y - render.bounds.min.y;

      // Calculate current zoom level (1.0 = full view, smaller = zoomed in)
      const currentZoom = currentWidth / width;

      // Find the largest visible ball to base zoom step on its size
      const viewCenter = {
        x: (render.bounds.min.x + render.bounds.max.x) / 2,
        y: (render.bounds.min.y + render.bounds.max.y) / 2,
      };

      const bodies = Matter.Composite.allBodies(engine.world);
      const visibleBalls = bodies.filter((b) => {
        if (b.isStatic) return false;
        // Check if ball is within current view bounds
        const ballRadius = (b as any).circleRadius || 10;
        return (
          b.position.x + ballRadius > render.bounds.min.x &&
          b.position.x - ballRadius < render.bounds.max.x &&
          b.position.y + ballRadius > render.bounds.min.y &&
          b.position.y - ballRadius < render.bounds.max.y
        );
      });

      // Find largest visible ball
      let largestVisibleRadius = 0;
      visibleBalls.forEach((ball) => {
        const radius = (ball as any).circleRadius || 10;
        if (radius > largestVisibleRadius) {
          largestVisibleRadius = radius;
        }
      });

      // Adaptive zoom step based on largest visible element size
      // The step should be INVERSELY proportional to element size
      // Smaller elements = much smaller steps (many more zoom levels)
      const elementViewRatio =
        largestVisibleRadius / Math.min(currentWidth, currentHeight);
      // Much more aggressive inverse scaling for tiny elements
      // Use exponential inverse: smaller elements get exponentially smaller steps
      const inverseRatio =
        elementViewRatio > 0
          ? 1 / (Math.pow(elementViewRatio * 20, 1.5) + 1)
          : 1;
      // Base step: 8% of current zoom, scaled inversely by element size
      const baseStep = currentZoom * 0.08;
      const zoomStep = Math.max(baseStep * inverseRatio, currentZoom * 0.001);

      let newZoom =
        e.deltaY > 0
          ? currentZoom + zoomStep // Zoom out: add step
          : currentZoom - zoomStep; // Zoom in: subtract step

      // Calculate dynamic minimum zoom based on smallest ball in the world
      // This ensures you can always zoom in enough to make the smallest element fill the screen
      const allBalls = bodies.filter((b) => !b.isStatic);
      let smallestRadius = Infinity;
      allBalls.forEach((ball) => {
        const radius = (ball as any).circleRadius || 10;
        if (radius < smallestRadius) {
          smallestRadius = radius;
        }
      });

      // Calculate zoom level where smallest ball would fill 85% of the smaller dimension
      const smallestDiameter = smallestRadius * 2;
      const dynamicMinZoom =
        allBalls.length > 0
          ? smallestDiameter / BALL_VISIBLE_RATIO / Math.min(width, height)
          : MIN_ZOOM;

      // Clamp zoom to min/max bounds (using dynamic minimum)
      newZoom = Math.max(dynamicMinZoom, Math.min(MAX_ZOOM, newZoom));

      // If zoom didn't change, nothing to do
      if (newZoom === currentZoom) return;

      // Get mouse position in world coordinates (before zoom)
      const rect = canvas.getBoundingClientRect();
      const mouseCanvasX = e.clientX - rect.left;
      const mouseCanvasY = e.clientY - rect.top;

      // Mouse position as a fraction of canvas size
      const mouseRatioX = mouseCanvasX / width;
      const mouseRatioY = mouseCanvasY / height;

      // Mouse position in world coordinates
      const mouseWorldX = render.bounds.min.x + mouseRatioX * currentWidth;
      const mouseWorldY = render.bounds.min.y + mouseRatioY * currentHeight;

      // Calculate new view dimensions
      const newWidth = width * newZoom;
      const newHeight = height * newZoom;

      // Calculate new bounds, keeping mouse position at same screen location
      let newMinX = mouseWorldX - mouseRatioX * newWidth;
      let newMinY = mouseWorldY - mouseRatioY * newHeight;
      let newMaxX = newMinX + newWidth;
      let newMaxY = newMinY + newHeight;

      // Clamp bounds to world limits when zooming out
      if (newZoom >= MAX_ZOOM) {
        newMinX = 0;
        newMinY = 0;
        newMaxX = width;
        newMaxY = height;
      }

      // Apply new bounds
      render.bounds.min.x = newMinX;
      render.bounds.min.y = newMinY;
      render.bounds.max.x = newMaxX;
      render.bounds.max.y = newMaxY;

      // Update zoom indicator
      onZoomChange(newZoom);

      // Update zoomed state based on zoom level
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
    },
    [render, runner, mouseConstraint, canvas, width, height, onZoomChange]
  );

  const updateZoomedView = useCallback(() => {
    // Skip if not zoomed, if user is panning, or if this is a wheel zoom (no target)
    if (!isZoomedRef.current || isPanningRef.current) return;
    if (!zoomTargetRef.current) return;

    // Find the ball we're zoomed on (the one closest to center of view)
    const centerX = (render.bounds.min.x + render.bounds.max.x) / 2;
    const centerY = (render.bounds.min.y + render.bounds.max.y) / 2;

    const bodies = Matter.Composite.allBodies(engine.world);
    const closestBall = findClosestBody(bodies, { x: centerX, y: centerY });

    if (!closestBall) return;

    // Update bounds to follow the ball (only if not animating)
    if (!zoomAnimationRef.current) {
      const viewWidth = render.bounds.max.x - render.bounds.min.x;
      const viewHeight = render.bounds.max.y - render.bounds.min.y;

      render.bounds.min.x = closestBall.position.x - viewWidth / 2;
      render.bounds.min.y = closestBall.position.y - viewHeight / 2;
      render.bounds.max.x = closestBall.position.x + viewWidth / 2;
      render.bounds.max.y = closestBall.position.y + viewHeight / 2;
    }
  }, [render, engine]);

  const cleanup = useCallback(() => {
    if (zoomAnimationRef.current) {
      cancelAnimationFrame(zoomAnimationRef.current);
    }
  }, []);

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
