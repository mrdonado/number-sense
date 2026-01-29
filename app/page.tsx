"use client";

import { useRef, useState, useCallback, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import PhysicsCanvas, {
  PhysicsCanvasHandle,
} from "./components/PhysicsCanvas/index";
import AddDataDialog from "./components/AddDataDialog";
import type { ComparisonType } from "./components/PhysicsCanvas/types";

function HomeContent() {
  const searchParams = useSearchParams();
  const isDebugMode = searchParams.get("debugMode") === "true";

  const canvasRef = useRef<PhysicsCanvasHandle>(null);
  const [inputValue, setInputValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [ballCount, setBallCount] = useState(0);
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [isAddDataDialogOpen, setIsAddDataDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [comparisonType, setComparisonType] = useState<ComparisonType>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("comparisonType");
      return (stored === "linear" ? "linear" : "area") as ComparisonType;
    }
    return "area";
  });

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleComparisonTypeChange = useCallback(() => {
    const newType: ComparisonType =
      comparisonType === "area" ? "linear" : "area";
    localStorage.setItem("comparisonType", newType);
    window.location.reload();
  }, [comparisonType]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const handleAddData = useCallback(
    (name: string, value: number, units: string, sourceId?: string) => {
      // Always calculate radius from area: A = πr² → r = √(A/π)
      // The comparison type only affects visual scaling, not the stored value
      const radius = Math.sqrt(value / Math.PI);
      canvasRef.current?.spawnBall(radius, name, units, sourceId);
    },
    []
  );

  return (
    <div className="app-container">
      <main className="main-content">
        <h1 className="page-title">
          <span style={{ fontWeight: "200", color: "#3b82f6" }}>Number</span>
          <span style={{ fontWeight: "800", color: "#3b82f6" }}>Sense </span>
        </h1>
        <a href="https://www.jdonado.com" className="page-subtitle">
          by F. Javier R. Donado
        </a>
        {isDebugMode && (
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
          </div>
        )}
        <PhysicsCanvas
          ref={canvasRef}
          onBallCountChange={setBallCount}
          onComparisonModeChange={setIsComparisonMode}
          comparisonType={comparisonType}
          onComparisonTypeChange={handleComparisonTypeChange}
          onAddData={() => setIsAddDataDialogOpen(true)}
          onClear={handleClear}
          onToggleComparisonMode={handleCompareToggle}
          canEnterComparison={ballCount >= 2}
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
