"use client";

import { useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import PhysicsCanvas, {
  PhysicsCanvasHandle,
} from "./components/PhysicsCanvas/index";
import AddDataDialog from "./components/AddDataDialog";

function HomeContent() {
  const searchParams = useSearchParams();
  const isDebugMode = searchParams.get("debugMode") === "true";

  const canvasRef = useRef<PhysicsCanvasHandle>(null);
  const [inputValue, setInputValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [ballCount, setBallCount] = useState(0);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [isAddDataDialogOpen, setIsAddDataDialogOpen] = useState(false);

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

  const handleAddData = useCallback(
    (name: string, value: number, units: string, sourceId?: string) => {
      // Calculate radius from area: A = πr² → r = √(A/π)
      const radius = Math.sqrt(value / Math.PI);
      canvasRef.current?.spawnBall(radius, name, units, sourceId);
    },
    []
  );

  return (
    <div className="app-container">
      <main className="main-content">
        <h1 className="page-title">Number Sense</h1>
        <div className="toolbar">
          <button
            onClick={() => setIsAddDataDialogOpen(true)}
            className="btn btn-primary"
          >
            +
          </button>
          {isDebugMode && (
            <>
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
            </>
          )}
          <button onClick={handleClear} className="btn btn-secondary">
            🧹
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
        <AddDataDialog
          isOpen={isAddDataDialogOpen}
          onClose={() => setIsAddDataDialogOpen(false)}
          onSelect={handleAddData}
          excludedItems={(canvasRef.current?.getBalls?.() || []).map((b) => ({
            name: b.name,
            sourceId: b.sourceId || "",
          }))}
          existingUnits={(canvasRef.current?.getBalls?.() || [])
            .map((b) => b.units)
            .filter((u): u is string => !!u)}
          existingSourceIds={(canvasRef.current?.getBalls?.() || [])
            .map((b) => b.sourceId)
            .filter((s): s is string => !!s)}
        />
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="app-container">
          <main className="main-content">
            <h1 className="page-title">Number Sense</h1>
          </main>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
