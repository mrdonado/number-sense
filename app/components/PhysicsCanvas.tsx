"use client";

import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import Matter from "matter-js";

const BALL_RADIUS = 20;
// Maximum ball diameter as a fraction of the smaller canvas dimension
const MAX_BALL_RATIO = 0.4;
// Zoom indicator height in pixels
const ZOOM_INDICATOR_HEIGHT = 4;

// Helper to get CSS variable value
function getCSSVariable(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

// Store original radius on body for scaling calculations
interface BallBody extends Matter.Body {
  circleRadius?: number;
  originalRadius?: number;
}

export interface PhysicsCanvasHandle {
  spawnBall: (radius: number) => void;
}

const PhysicsCanvas = forwardRef<PhysicsCanvasHandle>(function PhysicsCanvas(
  _props,
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const mouseConstraintRef = useRef<Matter.MouseConstraint | null>(null);
  const zoomAnimationRef = useRef<number | null>(null);
  const zoomTargetRef = useRef<{
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  } | null>(null);
  const isZoomedRef = useRef(false);
  // Track the current scale factor (1.0 = no scaling)
  const scaleFactorRef = useRef(1.0);
  // Track middle button panning state
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const panBoundsStartRef = useRef<{ minX: number; minY: number } | null>(null);
  // State to track zoom level for the indicator (1.0 = full view, 0.1 = max zoom)
  const [zoomLevel, setZoomLevel] = useState(1.0);

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const width = container.clientWidth;
    // Account for zoom indicator height
    const height = container.clientHeight - ZOOM_INDICATOR_HEIGHT;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Create engine
    const engine = Matter.Engine.create();
    engineRef.current = engine;

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
    renderRef.current = render;

    // Initialize render bounds
    render.bounds.min.x = 0;
    render.bounds.min.y = 0;
    render.bounds.max.x = width;
    render.bounds.max.y = height;

    // Create mouse and mouse constraint for dragging
    const mouse = Matter.Mouse.create(canvas);
    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: { visible: false },
      },
    });
    mouseConstraintRef.current = mouseConstraint;

    // Keep the mouse in sync with rendering
    render.mouse = mouse;

    Matter.Composite.add(engine.world, mouseConstraint);

    // Create ground (invisible floor for balls to bounce on)
    const ground = Matter.Bodies.rectangle(width / 2, height + 30, width, 60, {
      isStatic: true,
      render: { visible: false },
    });

    // Create ceiling (invisible roof for balls to bounce on)
    const ceiling = Matter.Bodies.rectangle(width / 2, -30, width, 60, {
      isStatic: true,
      render: { visible: false },
    });

    // Create walls to keep balls contained
    const leftWall = Matter.Bodies.rectangle(-30, height / 2, 60, height, {
      isStatic: true,
      render: { visible: false },
    });

    const rightWall = Matter.Bodies.rectangle(
      width + 30,
      height / 2,
      60,
      height,
      {
        isStatic: true,
        render: { visible: false },
      }
    );

    Matter.Composite.add(engine.world, [ground, ceiling, leftWall, rightWall]);

    // Update cursor when hovering over bodies
    const updateCursor = () => {
      const bodies = Matter.Composite.allBodies(engine.world);
      const hoveredBodies = Matter.Query.point(bodies, mouse.position);
      // Filter out static bodies (walls, ground)
      const hoveredDynamicBodies = hoveredBodies.filter((b) => !b.isStatic);
      canvas.style.cursor =
        hoveredDynamicBodies.length > 0 ? "pointer" : "default";
    };

    // Check for escaped balls and wrap them to the opposite side
    const SPEED_REDUCTION = 0.5;
    const checkEscapedBalls = () => {
      const bodies = Matter.Composite.allBodies(engine.world);
      bodies.forEach((body) => {
        if (body.isStatic) return;

        const { x, y } = body.position;
        const radius =
          (body as Matter.Body & { circleRadius?: number }).circleRadius || 20;
        let newX = x;
        let newY = y;
        let escaped = false;

        // Check if ball escaped through left
        if (x < -radius * 2) {
          newX = width + radius;
          escaped = true;
        }
        // Check if ball escaped through right
        else if (x > width + radius * 2) {
          newX = -radius;
          escaped = true;
        }

        // Check if ball escaped through top
        if (y < -radius * 2) {
          newY = height + radius;
          escaped = true;
        }
        // Check if ball escaped through bottom
        else if (y > height + radius * 2) {
          newY = -radius;
          escaped = true;
        }

        if (escaped) {
          // Teleport to opposite side with reduced velocity
          Matter.Body.setPosition(body, { x: newX, y: newY });
          Matter.Body.setVelocity(body, {
            x: body.velocity.x * SPEED_REDUCTION,
            y: body.velocity.y * SPEED_REDUCTION,
          });
        }
      });
    };

    Matter.Events.on(engine, "afterUpdate", checkEscapedBalls);
    Matter.Events.on(render, "afterRender", updateCursor);

    // Zoom animation constants
    const ZOOM_DURATION = 300; // ms
    const BALL_VISIBLE_RATIO = 0.85; // Ball takes 85% of visible area
    const WHEEL_ZOOM_FACTOR = 1.15; // Logarithmic zoom factor (15% per wheel tick)
    const MIN_ZOOM = 0.01; // Maximum zoom in (1% of original view = 100x zoom)
    const MAX_ZOOM = 1.0; // Maximum zoom out (100% = full view)

    // Full view bounds
    const fullBounds = {
      minX: 0,
      minY: 0,
      maxX: width,
      maxY: height,
    };

    // Animate zoom
    const animateZoom = (
      from: { minX: number; minY: number; maxX: number; maxY: number },
      to: { minX: number; minY: number; maxX: number; maxY: number },
      startTime: number
    ) => {
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
      setZoomLevel(currentWidth / width);

      if (progress < 1) {
        zoomAnimationRef.current = requestAnimationFrame(() =>
          animateZoom(from, to, startTime)
        );
      } else {
        zoomAnimationRef.current = null;
      }
    };

    // Helper to get click position in world coordinates
    const getWorldPosition = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = (render.bounds.max.x - render.bounds.min.x) / width;
      const scaleY = (render.bounds.max.y - render.bounds.min.y) / height;

      return {
        x: render.bounds.min.x + (e.clientX - rect.left) * scaleX,
        y: render.bounds.min.y + (e.clientY - rect.top) * scaleY,
      };
    };

    // Handle double-click to zoom in on a ball
    const handleDoubleClick = (e: MouseEvent) => {
      const worldPos = getWorldPosition(e);

      const bodies = Matter.Composite.allBodies(engine.world);
      const clickedBodies = Matter.Query.point(bodies, worldPos);
      const clickedBall = clickedBodies.find((b) => !b.isStatic);

      if (!clickedBall) return;

      // Cancel any ongoing animation
      if (zoomAnimationRef.current) {
        cancelAnimationFrame(zoomAnimationRef.current);
      }

      const currentBounds = {
        minX: render.bounds.min.x,
        minY: render.bounds.min.y,
        maxX: render.bounds.max.x,
        maxY: render.bounds.max.y,
      };

      // Zoom in on the ball - ball diameter should be 85% of visible area
      const ballRadius =
        (clickedBall as Matter.Body & { circleRadius?: number }).circleRadius ||
        20;
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

      const targetBounds = {
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
    };

    // Handle single click to reset zoom (only on background)
    const handleClick = (e: MouseEvent) => {
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

      const currentBounds = {
        minX: render.bounds.min.x,
        minY: render.bounds.min.y,
        maxX: render.bounds.max.x,
        maxY: render.bounds.max.y,
      };

      // Zoom out to full view
      isZoomedRef.current = false;
      zoomTargetRef.current = null;

      // Resume physics and enable dragging
      runner.enabled = true;
      mouseConstraint.constraint.stiffness = 0.2;

      animateZoom(currentBounds, fullBounds, Date.now());
    };

    // Track zoomed ball position (only for double-click zoom, not wheel zoom or panning)
    const updateZoomedView = () => {
      // Skip if not zoomed, if user is panning, or if this is a wheel zoom (no target)
      if (!isZoomedRef.current || isPanningRef.current) return;

      // Only auto-follow ball when zoomed via double-click (zoomTargetRef is set)
      // For wheel zoom, we clear zoomTargetRef so user has manual control
      if (!zoomTargetRef.current) return;

      // Find the ball we're zoomed on (the one closest to center of view)
      const centerX = (render.bounds.min.x + render.bounds.max.x) / 2;
      const centerY = (render.bounds.min.y + render.bounds.max.y) / 2;

      const bodies = Matter.Composite.allBodies(engine.world);
      const dynamicBodies = bodies.filter((b) => !b.isStatic);

      if (dynamicBodies.length === 0) return;

      // Find closest ball to current view center
      let closestBall = dynamicBodies[0];
      let closestDist = Infinity;

      dynamicBodies.forEach((body) => {
        const dist = Math.hypot(
          body.position.x - centerX,
          body.position.y - centerY
        );
        if (dist < closestDist) {
          closestDist = dist;
          closestBall = body;
        }
      });

      // Update bounds to follow the ball (only if not animating)
      if (!zoomAnimationRef.current) {
        const viewWidth = render.bounds.max.x - render.bounds.min.x;
        const viewHeight = render.bounds.max.y - render.bounds.min.y;

        render.bounds.min.x = closestBall.position.x - viewWidth / 2;
        render.bounds.min.y = closestBall.position.y - viewHeight / 2;
        render.bounds.max.x = closestBall.position.x + viewWidth / 2;
        render.bounds.max.y = closestBall.position.y + viewHeight / 2;
      }
    };

    // Handle mouse wheel zoom
    const handleWheel = (e: WheelEvent) => {
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

      // Calculate new zoom using logarithmic scaling (multiply/divide by factor)
      // Scroll down (positive deltaY) = zoom out (multiply), scroll up = zoom in (divide)
      let newZoom =
        e.deltaY > 0
          ? currentZoom * WHEEL_ZOOM_FACTOR
          : currentZoom / WHEEL_ZOOM_FACTOR;

      // Clamp zoom to min/max bounds
      newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

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
      setZoomLevel(newZoom);

      // Update zoomed state based on zoom level
      if (newZoom >= MAX_ZOOM) {
        isZoomedRef.current = false;
        zoomTargetRef.current = null;
        // Resume physics and enable dragging when zoomed out
        runner.enabled = true;
        mouseConstraint.constraint.stiffness = 0.2;
      } else {
        isZoomedRef.current = true;
        // Clear zoomTargetRef for wheel zoom - this disables auto-follow
        // so user has manual control over panning
        zoomTargetRef.current = null;
        // Freeze physics and disable dragging when zoomed in
        runner.enabled = false;
        mouseConstraint.constraint.stiffness = 0;
      }
    };

    // Handle middle mouse button down to start panning
    const handleMouseDown = (e: MouseEvent) => {
      // Middle button is button 1
      if (e.button === 1 && isZoomedRef.current) {
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panBoundsStartRef.current = {
          minX: render.bounds.min.x,
          minY: render.bounds.min.y,
        };
        canvas.style.cursor = "grabbing";
      }
    };

    // Handle mouse move for panning
    const handleMouseMove = (e: MouseEvent) => {
      if (
        !isPanningRef.current ||
        !panStartRef.current ||
        !panBoundsStartRef.current
      )
        return;

      // Calculate delta in screen coordinates
      const deltaX = e.clientX - panStartRef.current.x;
      const deltaY = e.clientY - panStartRef.current.y;

      // Convert screen delta to world delta based on current zoom
      const currentWidth = render.bounds.max.x - render.bounds.min.x;
      const currentHeight = render.bounds.max.y - render.bounds.min.y;
      const worldDeltaX = -(deltaX / width) * currentWidth;
      const worldDeltaY = -(deltaY / height) * currentHeight;

      // Apply new bounds (pan in opposite direction of mouse movement)
      let newMinX = panBoundsStartRef.current.minX + worldDeltaX;
      let newMinY = panBoundsStartRef.current.minY + worldDeltaY;

      // Allow panning up to 1.5x the scene size (0.5 extra on each side)
      const extraWidth = width * 0.5;
      const extraHeight = height * 0.5;

      // Clamp bounds to stay within extended scene area
      newMinX = Math.max(-extraWidth, newMinX);
      newMinY = Math.max(-extraHeight, newMinY);
      newMinX = Math.min(width + extraWidth - currentWidth, newMinX);
      newMinY = Math.min(height + extraHeight - currentHeight, newMinY);

      render.bounds.min.x = newMinX;
      render.bounds.min.y = newMinY;
      render.bounds.max.x = newMinX + currentWidth;
      render.bounds.max.y = newMinY + currentHeight;

      // Update zoom target to match current pan position
      if (zoomTargetRef.current) {
        zoomTargetRef.current = {
          minX: render.bounds.min.x,
          minY: render.bounds.min.y,
          maxX: render.bounds.max.x,
          maxY: render.bounds.max.y,
        };
      }
    };

    // Handle mouse up to stop panning
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1 && isPanningRef.current) {
        isPanningRef.current = false;
        panStartRef.current = null;
        panBoundsStartRef.current = null;
        canvas.style.cursor = "default";
      }
    };

    // Prevent context menu on middle click
    const handleContextMenu = (e: MouseEvent) => {
      if (isPanningRef.current) {
        e.preventDefault();
      }
    };

    canvas.addEventListener("dblclick", handleDoubleClick);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);
    canvas.addEventListener("contextmenu", handleContextMenu);
    Matter.Events.on(render, "beforeRender", updateZoomedView);

    // Run the renderer
    Matter.Render.run(render);

    // Create runner
    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    // Cleanup
    return () => {
      if (zoomAnimationRef.current) {
        cancelAnimationFrame(zoomAnimationRef.current);
      }
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
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Mouse.clearSourceEvents(mouse);
      Matter.Engine.clear(engine);
    };
  }, []);

  const spawnBall = (radius: number) => {
    if (!containerRef.current || !engineRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const minDimension = Math.min(width, height);

    // Maximum allowed displayed radius based on canvas size
    const maxDisplayRadius = (minDimension * MAX_BALL_RATIO) / 2;

    // Get all existing dynamic bodies (balls)
    const bodies = Matter.Composite.allBodies(engineRef.current.world);
    const balls = bodies.filter((b) => !b.isStatic) as BallBody[];

    // Find the largest original radius among all balls (including the new one)
    let maxOriginalRadius = radius;
    balls.forEach((ball) => {
      if (ball.originalRadius && ball.originalRadius > maxOriginalRadius) {
        maxOriginalRadius = ball.originalRadius;
      }
    });

    // Calculate the required scale factor to fit the largest ball
    let newScaleFactor = 1.0;
    if (maxOriginalRadius > maxDisplayRadius) {
      newScaleFactor = maxDisplayRadius / maxOriginalRadius;
    }

    // If scale factor changed, we need to resize all existing balls
    if (newScaleFactor !== scaleFactorRef.current) {
      const scaleRatio = newScaleFactor / scaleFactorRef.current;

      balls.forEach((ball) => {
        if (ball.originalRadius) {
          const newRadius = ball.originalRadius * newScaleFactor;
          // Scale the body
          Matter.Body.scale(ball, scaleRatio, scaleRatio);
          // Update the circleRadius property
          ball.circleRadius = newRadius;
        }
      });

      scaleFactorRef.current = newScaleFactor;
    }

    // Calculate the display radius for the new ball
    const displayRadius = radius * scaleFactorRef.current;

    const x = Math.random() * (width - displayRadius * 2) + displayRadius;

    // Get ball color from CSS variable
    const ballColor = getCSSVariable("--physics-ball");

    // Create a ball at a random x position, near the top
    const ball = Matter.Bodies.circle(x, displayRadius + 10, displayRadius, {
      restitution: 0.7, // Bounciness (0 = no bounce, 1 = perfect bounce)
      friction: 0.001,
      frictionAir: 0.001,
      render: {
        fillStyle: ballColor,
      },
    }) as BallBody;

    // Store the original radius for future scaling calculations
    ball.originalRadius = radius;

    Matter.Composite.add(engineRef.current.world, [ball]);
  };

  useImperativeHandle(ref, () => ({
    spawnBall,
  }));

  return (
    <div
      ref={containerRef}
      className="w-full flex-1 rounded-lg overflow-hidden bg-physics-canvas-bg relative flex flex-col"
    >
      {/* Zoom indicator */}
      <div
        className="w-full shrink-0 bg-zinc-700"
        style={{
          height: ZOOM_INDICATOR_HEIGHT,
        }}
      >
        <div
          className="bg-zinc-400"
          style={{
            height: "100%",
            width: `${zoomLevel * 100}%`,
            transition: "width 0.1s ease-out",
          }}
        />
      </div>
      <canvas ref={canvasRef} className="flex-1" />
    </div>
  );
});

export default PhysicsCanvas;
