"use client";

import { useRef, useState } from "react";
import PhysicsCanvas, {
  PhysicsCanvasHandle,
} from "./components/PhysicsCanvas/index";

export default function Home() {
  const canvasRef = useRef<PhysicsCanvasHandle>(null);
  const [inputValue, setInputValue] = useState("");

  const handleSubmit = () => {
    const radius = parseInt(inputValue, 10);
    if (!isNaN(radius) && radius > 0) {
      canvasRef.current?.spawnBall(radius);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className="flex h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="flex h-full w-full flex-col p-6 bg-white dark:bg-black gap-6">
        <h1 className="text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          Number Sense
        </h1>
        <div className="flex gap-3">
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter radius"
            className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-physics-ball"
          />
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-physics-ball text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Drop Ball
          </button>
        </div>
        <PhysicsCanvas ref={canvasRef} />
      </main>
    </div>
  );
}
