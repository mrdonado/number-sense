"use client";

import { useRef, useState, useCallback } from "react";
import PhysicsCanvas, {
  PhysicsCanvasHandle,
} from "./components/PhysicsCanvas/index";

export default function Home() {
  const canvasRef = useRef<PhysicsCanvasHandle>(null);
  const [inputValue, setInputValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [ballCount, setBallCount] = useState(0);
  const [isComparisonMode, setIsComparisonMode] = useState(false);

  const handleSubmit = () => {
    const area = parseFloat(inputValue);
    if (!isNaN(area) && area > 0) {
      // Calculate radius from area: A = πr² → r = √(A/π)
      const radius = Math.sqrt(area / Math.PI);
      canvasRef.current?.spawnBall(radius, nameValue || undefined);
    }
  };

  const handleClear = useCallback(() => {
    canvasRef.current?.clearBalls();
  }, []);

  const handleCompareToggle = useCallback(() => {
    if (isComparisonMode) {
      canvasRef.current?.exitComparisonMode();
    } else {
      canvasRef.current?.enterComparisonMode();
    }
  }, [isComparisonMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <div className="app-container">
      <main className="main-content">
        <h1 className="page-title">Number Sense</h1>
        <div className="toolbar">
          <input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter name"
            className="input"
          />
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter area"
            className="input"
          />
          <button onClick={handleSubmit} className="btn btn-primary">
            Drop Ball
          </button>
          <button onClick={handleClear} className="btn btn-secondary">
            Clear
          </button>
          {ballCount >= 2 && (
            <button
              onClick={handleCompareToggle}
              className={`btn ${
                isComparisonMode ? "btn-compare-active" : "btn-compare"
              }`}
            >
              {isComparisonMode ? "Exit Comparison" : "Compare Sizes"}
            </button>
          )}
        </div>
        <PhysicsCanvas
          ref={canvasRef}
          onBallCountChange={setBallCount}
          onComparisonModeChange={setIsComparisonMode}
        />
      </main>
    </div>
  );
}
