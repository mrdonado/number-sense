"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import Matter from "matter-js";

const BALL_RADIUS = 20;

// Helper to get CSS variable value
function getCSSVariable(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
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
      },
    });
    renderRef.current = render;

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

    // Run the renderer
    Matter.Render.run(render);

    // Create runner
    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    // Cleanup
    return () => {
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
    const x = Math.random() * (width - radius * 2) + radius;

    // Get ball color from CSS variable
    const ballColor = getCSSVariable("--physics-ball");

    // Create a ball at a random x position, near the top
    const ball = Matter.Bodies.circle(x, radius + 10, radius, {
      restitution: 0.7, // Bounciness (0 = no bounce, 1 = perfect bounce)
      friction: 0.001,
      frictionAir: 0.001,
      render: {
        fillStyle: ballColor,
      },
    });

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
