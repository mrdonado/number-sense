"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import Matter from "matter-js";

const BALL_RADIUS = 20;
// Maximum ball diameter as a fraction of the smaller canvas dimension
const MAX_BALL_RATIO = 0.4;

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

  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

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

    // Track zoomed ball position
    const updateZoomedView = () => {
      if (!isZoomedRef.current || !zoomTargetRef.current) return;

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
        const ballRadius =
          (closestBall as Matter.Body & { circleRadius?: number })
            .circleRadius || 20;
        const viewWidth = render.bounds.max.x - render.bounds.min.x;
        const viewHeight = render.bounds.max.y - render.bounds.min.y;

        render.bounds.min.x = closestBall.position.x - viewWidth / 2;
        render.bounds.min.y = closestBall.position.y - viewHeight / 2;
        render.bounds.max.x = closestBall.position.x + viewWidth / 2;
        render.bounds.max.y = closestBall.position.y + viewHeight / 2;
      }
    };

    canvas.addEventListener("dblclick", handleDoubleClick);
    canvas.addEventListener("click", handleClick);
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
      className="w-full flex-1 rounded-lg overflow-hidden bg-physics-canvas-bg"
    >
      <canvas ref={canvasRef} />
    </div>
  );
});

export default PhysicsCanvas;
