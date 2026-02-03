import Matter from "matter-js";
import {
  ZOOM_DURATION,
  BALL_VISIBLE_RATIO,
  WHEEL_ZOOM_FACTOR,
  TRACKPAD_ZOOM_FACTOR,
  MIN_ZOOM,
  MAX_ZOOM,
  MOUSE_STIFFNESS,
} from "../constants";
import { screenToWorld, findClosestBody } from "../utils";
import type { BallBody, Bounds } from "../types";
import type { ZoomHandlerOptions, ZoomHandlerResult } from "./types";

// Touch interaction constants
const TAP_THRESHOLD_MS = 300;
const TAP_MOVE_THRESHOLD = 10;

/**
 * Creates handlers for zoom interactions including:
 * - Mouse wheel zoom
 * - Double-click zoom on balls
 * - Click to zoom out
 * - Touch pinch-to-zoom
 * - Touch tap to zoom in/out
 * - Touch pan when zoomed
 */
export function createZoomHandlers(
  options: ZoomHandlerOptions
): ZoomHandlerResult {
  const {
    dimensions,
    render,
    engine,
    runner,
    mouseConstraint,
    canvas,
    onZoomChange,
    onUserZoom,
    isComparisonModeRef,
    onExitComparisonMode,
  } = options;
  const { width, height } = dimensions;

  // Animation state
  let zoomAnimationFrame: number | null = null;

  // Zoom state refs (shared with panning handlers)
  const isZoomedRef = { current: false };
  const zoomTargetRef = { current: null as Bounds | null };
  const isPanningRef = { current: false };

  // Full view bounds
  const fullBounds: Bounds = {
    minX: 0,
    minY: 0,
    maxX: width,
    maxY: height,
  };

  // Touch state
  let lastPinchDistance: number | null = null;
  let lastPinchCenter: { x: number; y: number } | null = null;
  let touchPanStart: { x: number; y: number } | null = null;
  let touchPanBoundsStart: { minX: number; minY: number } | null = null;
  let isTouchPanning = false;
  let touchStartTime: number | null = null;
  let touchStartPosition: { x: number; y: number } | null = null;

  // Ref to track if a pinch gesture just occurred (to prevent ball selection after pinch)
  const wasPinchingRef = { current: false };

  // Mouse drag detection state
  let mouseDownPosition: { x: number; y: number } | null = null;
  const DRAG_THRESHOLD = 5; // pixels - if mouse moves more than this, it's a drag

  // ============ Helper Functions ============

  const getCurrentBounds = (): Bounds => ({
    minX: render.bounds.min.x,
    minY: render.bounds.min.y,
    maxX: render.bounds.max.x,
    maxY: render.bounds.max.y,
  });

  const getWorldPosition = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    return screenToWorld(
      clientX,
      clientY,
      rect,
      getCurrentBounds(),
      dimensions
    );
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

  const cancelZoomAnimation = () => {
    if (zoomAnimationFrame) {
      cancelAnimationFrame(zoomAnimationFrame);
      zoomAnimationFrame = null;
    }
  };

  const calculateTargetBoundsForBall = (ball: Matter.Body): Bounds => {
    const ballRadius = (ball as BallBody).circleRadius || 20;
    const ballDiameter = ballRadius * 2;

    const aspectRatio = width / height;
    let viewHeight = ballDiameter / BALL_VISIBLE_RATIO;
    let viewWidth = viewHeight * aspectRatio;

    if (aspectRatio < 1) {
      viewWidth = ballDiameter / BALL_VISIBLE_RATIO;
      viewHeight = viewWidth / aspectRatio;
    }

    return {
      minX: ball.position.x - viewWidth / 2,
      minY: ball.position.y - viewHeight / 2,
      maxX: ball.position.x + viewWidth / 2,
      maxY: ball.position.y + viewHeight / 2,
    };
  };

  const zoomInOnBall = (ball: Matter.Body) => {
    cancelZoomAnimation();

    const currentBounds = getCurrentBounds();
    const targetBounds = calculateTargetBoundsForBall(ball);

    zoomTargetRef.current = targetBounds;
    isZoomedRef.current = true;
    runner.enabled = false;
    mouseConstraint.constraint.stiffness = 0;

    animateZoom(currentBounds, targetBounds, Date.now());
  };

  const zoomOut = () => {
    cancelZoomAnimation();

    const currentBounds = getCurrentBounds();
    isZoomedRef.current = false;
    zoomTargetRef.current = null;
    // Only re-enable runner if not in comparison mode
    if (!isComparisonModeRef?.current) {
      runner.enabled = true;
      mouseConstraint.constraint.stiffness = MOUSE_STIFFNESS;
    }

    animateZoom(currentBounds, fullBounds, Date.now());
  };

  // Reset zoom to 1x without affecting runner state (for use during comparison mode transitions)
  const resetZoom = () => {
    cancelZoomAnimation();

    const currentBounds = getCurrentBounds();
    isZoomedRef.current = false;
    zoomTargetRef.current = null;

    // Animate to full view
    animateZoom(currentBounds, fullBounds, Date.now());
  };

  const applyZoom = (
    newZoom: number,
    centerX: number,
    centerY: number,
    centerRatioX: number,
    centerRatioY: number
  ) => {
    const newWidth = width * newZoom;
    const newHeight = height * newZoom;

    let newMinX = centerX - centerRatioX * newWidth;
    let newMinY = centerY - centerRatioY * newHeight;
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
      // Only re-enable runner if not in comparison mode
      if (!isComparisonModeRef?.current) {
        runner.enabled = true;
        mouseConstraint.constraint.stiffness = MOUSE_STIFFNESS;
      }
    } else {
      isZoomedRef.current = true;
      zoomTargetRef.current = null;
      runner.enabled = false;
      mouseConstraint.constraint.stiffness = 0;
    }
  };

  // ============ Mouse Event Handlers ============

  const handleDoubleClick = (e: MouseEvent) => {
    const worldPos = getWorldPosition(e.clientX, e.clientY);
    const bodies = Matter.Composite.allBodies(engine.world);
    const clickedBodies = Matter.Query.point(bodies, worldPos);
    const clickedBall = clickedBodies.find((b) => !b.isStatic);

    if (clickedBall) {
      zoomInOnBall(clickedBall);
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    mouseDownPosition = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: MouseEvent) => {
    // Check if this was a drag (mouse moved significantly since mousedown)
    if (mouseDownPosition) {
      const dx = e.clientX - mouseDownPosition.x;
      const dy = e.clientY - mouseDownPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > DRAG_THRESHOLD) {
        // This was a drag, not a click - don't zoom
        mouseDownPosition = null;
        return;
      }
    }
    mouseDownPosition = null;

    const worldPos = getWorldPosition(e.clientX, e.clientY);
    const bodies = Matter.Composite.allBodies(engine.world);
    const clickedBodies = Matter.Query.point(bodies, worldPos);
    const clickedBall = clickedBodies.find((b) => !b.isStatic);

    if (clickedBall) {
      // Clicked on a ball - zoom in on it
      zoomInOnBall(clickedBall);
    } else {
      // Clicked on background (not a ball)
      // If zoomed in, zoom out
      if (isZoomedRef.current) {
        zoomOut();
      }
      // If in comparison mode at 1x zoom, exit comparison mode
      else if (isComparisonModeRef?.current && onExitComparisonMode) {
        const currentZoom = (render.bounds.max.x - render.bounds.min.x) / width;
        if (Math.abs(currentZoom - 1.0) < 0.01) {
          onExitComparisonMode();
        }
      }
    }
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    cancelZoomAnimation();

    const currentWidth = render.bounds.max.x - render.bounds.min.x;
    const currentHeight = render.bounds.max.y - render.bounds.min.y;
    const currentZoom = currentWidth / width;

    // Detect if this is a trackpad (smooth scrolling) or mouse wheel (discrete steps)
    // Trackpads typically have smaller deltaY values and use deltaMode 0 (pixels)
    // Mouse wheels have larger, discrete deltaY values
    const isTrackpad = Math.abs(e.deltaY) < 50 && e.deltaMode === 0;
    const zoomFactor = isTrackpad ? TRACKPAD_ZOOM_FACTOR : WHEEL_ZOOM_FACTOR;

    let newZoom =
      e.deltaY > 0 ? currentZoom * zoomFactor : currentZoom / zoomFactor;

    newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

    if (newZoom === currentZoom) return;

    const rect = canvas.getBoundingClientRect();
    const mouseCanvasX = e.clientX - rect.left;
    const mouseCanvasY = e.clientY - rect.top;

    const mouseRatioX = mouseCanvasX / width;
    const mouseRatioY = mouseCanvasY / height;

    const mouseWorldX = render.bounds.min.x + mouseRatioX * currentWidth;
    const mouseWorldY = render.bounds.min.y + mouseRatioY * currentHeight;

    applyZoom(newZoom, mouseWorldX, mouseWorldY, mouseRatioX, mouseRatioY);
    // Notify that user initiated a zoom
    onUserZoom?.();
  };

  // ============ Touch Helper Functions ============

  const isEventInRightPanel = (clientX: number, clientY: number): boolean => {
    const element = document.elementFromPoint(clientX, clientY);
    if (!element) return false;
    // Check if the element or any of its parents has the rightPanel class
    return element.closest('[class*="rightPanel"]') !== null;
  };

  const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (
    touch1: Touch,
    touch2: Touch
  ): { x: number; y: number } => ({
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  });

  const resetTouchPanState = () => {
    touchPanStart = null;
    touchPanBoundsStart = null;
    isTouchPanning = false;
    isPanningRef.current = false;
    touchStartTime = null;
    touchStartPosition = null;
  };

  const resetPinchState = () => {
    lastPinchDistance = null;
    lastPinchCenter = null;
  };

  // ============ Touch Event Handlers ============

  const handleTouchStart = (e: TouchEvent) => {
    // Ignore touches from the right panel (controls/legend)
    if (
      e.touches.length > 0 &&
      isEventInRightPanel(e.touches[0].clientX, e.touches[0].clientY)
    ) {
      return;
    }

    if (e.touches.length === 2) {
      // Two-finger pinch start
      e.preventDefault();
      resetTouchPanState();
      lastPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
      lastPinchCenter = getTouchCenter(e.touches[0], e.touches[1]);
      wasPinchingRef.current = true; // Mark that a pinch is in progress
    } else if (e.touches.length === 1) {
      // Single finger - could be tap or pan
      touchStartTime = Date.now();
      touchStartPosition = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };

      if (isZoomedRef.current) {
        touchPanStart = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        touchPanBoundsStart = {
          minX: render.bounds.min.x,
          minY: render.bounds.min.y,
        };
      }
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    // Handle two-finger pinch zoom
    if (e.touches.length === 2 && lastPinchDistance !== null) {
      e.preventDefault();
      handlePinchZoom(e);
      return;
    }

    // Handle single-finger panning when zoomed
    if (
      e.touches.length === 1 &&
      isZoomedRef.current &&
      touchPanStart &&
      touchPanBoundsStart
    ) {
      handleTouchPan(e);
    }
  };

  const handlePinchZoom = (e: TouchEvent) => {
    const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
    const currentCenter = getTouchCenter(e.touches[0], e.touches[1]);

    cancelZoomAnimation();

    const pinchRatio = currentDistance / lastPinchDistance!;
    const currentWidth = render.bounds.max.x - render.bounds.min.x;
    const currentHeight = render.bounds.max.y - render.bounds.min.y;
    const currentZoom = currentWidth / width;

    let newZoom = currentZoom / pinchRatio;

    // Calculate dynamic minimum zoom based on smallest ball in the world
    const bodies = Matter.Composite.allBodies(engine.world);
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

    newZoom = Math.max(dynamicMinZoom, Math.min(MAX_ZOOM, newZoom));

    // Remove threshold check - allow even tiny zoom changes for smooth pinch zooming
    // especially when zoomed in on small elements
    if (newZoom === currentZoom) {
      lastPinchDistance = currentDistance;
      lastPinchCenter = currentCenter;
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const pinchCanvasX = currentCenter.x - rect.left;
    const pinchCanvasY = currentCenter.y - rect.top;

    const pinchRatioX = pinchCanvasX / width;
    const pinchRatioY = pinchCanvasY / height;

    const pinchWorldX = render.bounds.min.x + pinchRatioX * currentWidth;
    const pinchWorldY = render.bounds.min.y + pinchRatioY * currentHeight;

    applyZoom(newZoom, pinchWorldX, pinchWorldY, pinchRatioX, pinchRatioY);
    // Notify that user initiated a zoom
    onUserZoom?.();

    lastPinchDistance = currentDistance;
    lastPinchCenter = currentCenter;
  };

  const handleTouchPan = (e: TouchEvent) => {
    const touch = e.touches[0];

    // Check if we've moved enough to consider it a pan (not a tap)
    if (touchStartPosition) {
      const dx = touch.clientX - touchStartPosition.x;
      const dy = touch.clientY - touchStartPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > TAP_MOVE_THRESHOLD) {
        isTouchPanning = true;
        touchStartTime = null;
        // Clear zoom target so updateZoomedView won't snap back to the ball after panning
        zoomTargetRef.current = null;
      }
    }

    if (isTouchPanning && touchPanStart && touchPanBoundsStart) {
      e.preventDefault();
      isPanningRef.current = true;

      const deltaX = touch.clientX - touchPanStart.x;
      const deltaY = touch.clientY - touchPanStart.y;

      const currentWidth = render.bounds.max.x - render.bounds.min.x;
      const currentHeight = render.bounds.max.y - render.bounds.min.y;
      const worldDeltaX = -(deltaX / width) * currentWidth;
      const worldDeltaY = -(deltaY / height) * currentHeight;

      let newMinX = touchPanBoundsStart.minX + worldDeltaX;
      let newMinY = touchPanBoundsStart.minY + worldDeltaY;

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
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    // Ignore touches from the right panel (controls/legend)
    if (
      e.changedTouches.length > 0 &&
      isEventInRightPanel(
        e.changedTouches[0].clientX,
        e.changedTouches[0].clientY
      )
    ) {
      return;
    }

    // Check for tap on ball (like double-click)
    if (
      touchStartTime !== null &&
      touchStartPosition !== null &&
      e.changedTouches.length === 1 &&
      !isTouchPanning &&
      !wasPinchingRef.current // Don't process tap if we were pinching
    ) {
      const touchEndTime = Date.now();
      const touchDuration = touchEndTime - touchStartTime;

      if (touchDuration < TAP_THRESHOLD_MS) {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartPosition.x;
        const dy = touch.clientY - touchStartPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < TAP_MOVE_THRESHOLD) {
          const worldPos = getWorldPosition(touch.clientX, touch.clientY);
          const bodies = Matter.Composite.allBodies(engine.world);
          const tappedBodies = Matter.Query.point(bodies, worldPos);
          const tappedBall = tappedBodies.find((b) => !b.isStatic);

          if (tappedBall) {
            zoomInOnBall(tappedBall);
          } else if (isZoomedRef.current) {
            zoomOut();
          } else if (isComparisonModeRef?.current && onExitComparisonMode) {
            // Tapped on background at 1x zoom in comparison mode - exit comparison mode
            const currentZoom =
              (render.bounds.max.x - render.bounds.min.x) / width;
            if (Math.abs(currentZoom - 1.0) < 0.01) {
              onExitComparisonMode();
            }
          }
        }
      }
    }

    // Reset pinch state
    if (e.touches.length < 2) {
      resetPinchState();
    }

    // Reset touch pan state and pinching flag
    if (e.touches.length === 0) {
      resetTouchPanState();
      // Reset the pinching flag after a short delay to allow the touch end handler in PhysicsCanvas to check it
      setTimeout(() => {
        wasPinchingRef.current = false;
      }, 50);
    }
  };

  // ============ Update Loop ============

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

  const zoomOnBallById = (ballId: number) => {
    const bodies = Matter.Composite.allBodies(engine.world);
    const ball = bodies.find((b) => b.id === ballId && !b.isStatic);
    if (ball) {
      zoomInOnBall(ball);
    }
  };

  // ============ Cleanup ============

  const cleanup = () => {
    cancelZoomAnimation();
  };

  return {
    isZoomedRef,
    zoomTargetRef,
    isPanningRef,
    wasPinchingRef,
    handleDoubleClick,
    handleClick,
    handleMouseDown,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    updateZoomedView,
    zoomOnBallById,
    resetZoom,
    cleanup,
  };
}
