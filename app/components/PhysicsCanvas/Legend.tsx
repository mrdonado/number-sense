"use client";

import type { BallInfo } from "./types";

interface LegendProps {
  balls: BallInfo[];
  hoveredBallId: number | null;
  hiddenBallIds: Set<number>;
  onHover: (id: number | null) => void;
  onRemove: (id: number) => void;
  onToggleVisibility: (id: number) => void;
  onZoom: (id: number) => void;
}

export function Legend({
  balls,
  hoveredBallId,
  hiddenBallIds,
  onHover,
  onRemove,
  onToggleVisibility,
  onZoom,
}: LegendProps) {
  if (balls.length === 0) {
    return null;
  }

  return (
    <div className="absolute right-2 top-8 max-h-[calc(100%-4rem)] overflow-y-auto bg-black/50 backdrop-blur-sm rounded-lg p-2 min-w-30">
      <ul className="flex flex-col gap-1">
        {balls.map((ball) => {
          const isHidden = hiddenBallIds.has(ball.id);
          return (
            <li
              key={ball.id}
              className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition-all"
              style={{
                backgroundColor:
                  hoveredBallId === ball.id
                    ? "rgba(255, 255, 255, 0.2)"
                    : "transparent",
                boxShadow:
                  hoveredBallId === ball.id
                    ? `0 0 0 2px ${ball.color}`
                    : "none",
                opacity: isHidden ? 0.4 : 1,
              }}
              onMouseEnter={() => onHover(ball.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => !isHidden && onZoom(ball.id)}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor: ball.color,
                  filter: isHidden ? "grayscale(100%)" : "none",
                }}
              />
              <span
                className="text-sm truncate flex-1"
                style={{
                  color: isHidden ? "rgba(255, 255, 255, 0.5)" : "white",
                }}
              >
                {ball.name}
              </span>
              <input
                type="checkbox"
                checked={!isHidden}
                onChange={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(ball.id);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 cursor-pointer accent-white"
                title={isHidden ? "Show ball" : "Hide ball"}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(ball.id);
                }}
                className="text-white/60 hover:text-white transition-colors text-sm cursor-pointer"
                title="Remove ball"
              >
                🗑️
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
