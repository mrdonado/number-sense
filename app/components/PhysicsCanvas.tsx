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

    // Create ground (invisible floor for balls to bounce on)
    const ground = Matter.Bodies.rectangle(width / 2, height + 30, width, 60, {
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

    Matter.Composite.add(engine.world, [ground, leftWall, rightWall]);

    // Run the renderer
    Matter.Render.run(render);

    // Create runner
    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    // Cleanup
    return () => {
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
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
