// Ball configuration
export const BALL_RADIUS = 20;
// Maximum ball diameter as a fraction of the smaller canvas dimension
export const MAX_BALL_RATIO = 0.4;

// Zoom indicator height in pixels
export const ZOOM_INDICATOR_HEIGHT = 4;

// Zoom animation constants
export const ZOOM_DURATION = 300; // ms
export const BALL_VISIBLE_RATIO = 0.85; // Ball takes 85% of visible area
export const WHEEL_ZOOM_FACTOR = 1.15; // Logarithmic zoom factor (15% per wheel tick)
export const MIN_ZOOM = 0.01; // Maximum zoom in (1% of original view = 100x zoom)
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
