import Matter from "matter-js";

// Extended Matter.Body with custom properties for ball tracking
export interface ExtendedBody extends Matter.Body {
  circleRadius?: number;
  originalRadius?: number;
  ballName?: string;
  ballColor?: string;
  ballUnits?: string;
  ballSourceId?: string;
}

// Alias for ExtendedBody - represents a ball body in the physics simulation
export type BallBody = ExtendedBody;

// Ball info for the legend
export interface BallInfo {
  id: number;
  name: string;
  color: string;
  originalRadius: number;
  value: number; // The original area (π × radius²)
  units?: string;
  sourceId?: string;
}

// Persisted ball data for localStorage
export interface PersistedBall {
  name: string;
  color: string;
  originalRadius: number;
  units?: string;
}

// Public handle exposed via ref
export interface BallForExclusion {
  name: string;
  sourceId?: string;
  units?: string;
}

export type ComparisonType = "area" | "linear";

export interface PhysicsCanvasHandle {
  spawnBall: (
    radius: number,
    name?: string,
    units?: string,
    sourceId?: string
  ) => void;
  clearBalls: () => void;
  isComparisonMode: boolean;
  enterComparisonMode: () => void;
  exitComparisonMode: () => void;
  getBallNames: () => string[];
  getBalls?: () => BallForExclusion[];
}

// Bounds rectangle for zoom/pan calculations
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Canvas dimensions
export interface Dimensions {
  width: number;
  height: number;
}

// Physics engine refs container
export interface PhysicsRefs {
  engine: Matter.Engine | null;
  render: Matter.Render | null;
  runner: Matter.Runner | null;
  mouseConstraint: Matter.MouseConstraint | null;
  boundaries: Matter.Body[] | null;
}

// Zoom state
export interface ZoomState {
  isZoomed: boolean;
  target: Bounds | null;
  animationFrame: number | null;
}

// Pan state
export interface PanState {
  isPanning: boolean;
  startPosition: { x: number; y: number } | null;
  boundsStart: { minX: number; minY: number } | null;
}
