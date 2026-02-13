import Matter from "matter-js";
import { WALL_THICKNESS, WALL_OFFSET } from "../../../constants";
import type { Dimensions } from "../types";

/**
 * Create invisible boundaries (ground, ceiling, walls) to contain balls
 */
export function createBoundaries(
  dimensions: Dimensions,
): [Matter.Body, Matter.Body, Matter.Body, Matter.Body] {
  const { width, height } = dimensions;

  // Ground (invisible floor)
  const ground = Matter.Bodies.rectangle(
    width / 2,
    height + WALL_OFFSET,
    width,
    WALL_THICKNESS,
    { isStatic: true, render: { visible: false } },
  );

  // Ceiling (invisible roof)
  const ceiling = Matter.Bodies.rectangle(
    width / 2,
    -WALL_OFFSET,
    width,
    WALL_THICKNESS,
    { isStatic: true, render: { visible: false } },
  );

  // Left wall
  const leftWall = Matter.Bodies.rectangle(
    -WALL_OFFSET,
    height / 2,
    WALL_THICKNESS,
    height,
    { isStatic: true, render: { visible: false } },
  );

  // Right wall
  const rightWall = Matter.Bodies.rectangle(
    width + WALL_OFFSET,
    height / 2,
    WALL_THICKNESS,
    height,
    { isStatic: true, render: { visible: false } },
  );

  return [ground, ceiling, leftWall, rightWall];
}
