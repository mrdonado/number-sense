"use client";

import type { BallInfo } from "./types";

interface LegendProps {
  balls: BallInfo[];
  hoveredBallId: number | null;
  onHover: (id: number | null) => void;
}

export function Legend({ balls, hoveredBallId, onHover }: LegendProps) {
  if (balls.length === 0) {
    return null;
  }

  return (
    <div className="absolute right-2 top-8 max-h-[calc(100%-4rem)] overflow-y-auto bg-black/50 backdrop-blur-sm rounded-lg p-2 min-w-30">
      <ul className="flex flex-col gap-1">
        {balls.map((ball) => (
          <li
            key={ball.id}
            className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-all"
            style={{
              backgroundColor:
                hoveredBallId === ball.id
                  ? "rgba(255, 255, 255, 0.2)"
                  : "transparent",
              boxShadow:
                hoveredBallId === ball.id ? `0 0 0 2px ${ball.color}` : "none",
            }}
            onMouseEnter={() => onHover(ball.id)}
            onMouseLeave={() => onHover(null)}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: ball.color }}
            />
            <span className="text-white text-sm truncate">{ball.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
