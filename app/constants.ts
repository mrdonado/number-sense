// Ball configuration
export const BALL_RADIUS = 20;
// Target ball diameter as a fraction of the smaller canvas dimension
// The largest ball will always be scaled to this size
export const TARGET_BALL_RATIO = 0.5;

// Zoom indicator height in pixels
export const ZOOM_INDICATOR_HEIGHT = 4;

// Zoom animation constants
export const ZOOM_DURATION = 2000; // ms
export const BALL_VISIBLE_RATIO = 0.85; // Ball takes 85% of visible area
export const WHEEL_ZOOM_FACTOR = 1.08; // Logarithmic zoom factor (8% per wheel tick)
export const TRACKPAD_ZOOM_FACTOR = 1.02; // Slower zoom for trackpads (2% per tick)
export const MIN_ZOOM = 0.0001; // Maximum zoom in (0.01% of original view = 10000x zoom) - effectively unlimited
export const MAX_ZOOM = 1.0; // Maximum zoom out (100% = full view)

// Physics constants
export const BALL_RESTITUTION = 0.7; // Bounciness (0 = no bounce, 1 = perfect bounce)
export const BALL_FRICTION = 0.001;
export const BALL_FRICTION_AIR = 0.001;
export const SPEED_REDUCTION = 0.5; // Velocity reduction when ball wraps around

// Wall thickness
export const WALL_THICKNESS = 60;
export const WALL_OFFSET = 30;

// Mouse constraint
export const MOUSE_STIFFNESS = 0.2;

// Ball color palette - works well with the existing theme
export const BALL_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#a855f7", // purple
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#6366f1", // indigo
  "#d946ef", // fuchsia
  "#64748b", // slate
];

// Key for localStorage to persist ball data
export const STORAGE_KEY = "number-sense-balls";
