import type Matter from "matter-js";
import type { Bounds, Dimensions } from "../types";

export interface ZoomHandlerOptions {
  dimensions: Dimensions;
  render: Matter.Render;
  engine: Matter.Engine;
  runner: Matter.Runner;
  mouseConstraint: Matter.MouseConstraint;
  canvas: HTMLCanvasElement;
  onZoomChange: (zoomLevel: number) => void;
  isComparisonModeRef?: { current: boolean };
}

export interface ZoomHandlerResult {
  isZoomedRef: { current: boolean };
  zoomTargetRef: { current: Bounds | null };
  isPanningRef: { current: boolean };
  handleDoubleClick: (e: MouseEvent) => void;
  handleClick: (e: MouseEvent) => void;
  handleWheel: (e: WheelEvent) => void;
  handleTouchStart: (e: TouchEvent) => void;
  handleTouchMove: (e: TouchEvent) => void;
  handleTouchEnd: (e: TouchEvent) => void;
  updateZoomedView: () => void;
  cleanup: () => void;
}

export interface PanningHandlerOptions {
  dimensions: Dimensions;
  render: Matter.Render;
  canvas: HTMLCanvasElement;
  isZoomedRef: { current: boolean };
  zoomTargetRef: { current: Bounds | null };
  isPanningRef: { current: boolean };
}

export interface PanningHandlerResult {
  handleMouseDown: (e: MouseEvent) => void;
  handleMouseMove: (e: MouseEvent) => void;
  handleMouseUp: (e: MouseEvent) => void;
  handleContextMenu: (e: MouseEvent) => void;
}
