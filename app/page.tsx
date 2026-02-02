"use client";

import { useRef, useState, useCallback, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import PhysicsCanvas, {
  PhysicsCanvasHandle,
} from "./components/PhysicsCanvas/index";
import AddDataDialog from "./components/AddDataDialog/index";
import type { ComparisonType } from "./components/PhysicsCanvas/types";
import { encodeStateToURL, decodeStateFromURL } from "./utils/shareState";
import { useToast } from "./components/Toast";

const STORAGE_KEY = "number-sense-balls";

function HomeContent() {
  const searchParams = useSearchParams();
  const isDebugMode = searchParams.get("debugMode") === "true";
  const { showToast, showConfirm } = useToast();

  const canvasRef = useRef<PhysicsCanvasHandle>(null);
  const [inputValue, setInputValue] = useState("");
  const [nameValue, setNameValue] = useState("");
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [isAddDataDialogOpen, setIsAddDataDialogOpen] = useState(false);
  const [comparisonType] = useState<ComparisonType>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("comparisonType");
      return (stored === "linear" ? "linear" : "area") as ComparisonType;
    }
    return "area";
  });
  const [excludedItems, setExcludedItems] = useState<
    Array<{ name: string; sourceId: string }>
  >([]);
  const [existingUnits, setExistingUnits] = useState<string[]>([]);
  const [existingSourceIds, setExistingSourceIds] = useState<string[]>([]);

  // Handle shared state from URL on mount
  useEffect(() => {
    const sharedState = decodeStateFromURL();
    if (sharedState) {
      // Overwrite localStorage with the shared state
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sharedState.balls));

      // Update comparison type if different
      if (sharedState.comparisonType !== comparisonType) {
        localStorage.setItem("comparisonType", sharedState.comparisonType);
        // Reload to apply the new comparison type
        window.location.href = window.location.pathname;
      }

      // Clear the URL parameter to clean up the URL
      const url = new URL(window.location.href);
      url.searchParams.delete("shared");
      window.history.replaceState({}, "", url.toString());

      // Reload to restore the balls from localStorage
      if (sharedState.comparisonType === comparisonType) {
        window.location.reload();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount, comparisonType is read from localStorage initially

  const handleOpenAddDataDialog = useCallback(() => {
    const balls = canvasRef.current?.getBalls?.() || [];
    setExcludedItems(
      balls.map((b) => ({
        name: b.name,
        sourceId: b.sourceId || "",
      }))
    );
    setExistingUnits(balls.map((b) => b.units).filter((u): u is string => !!u));
    setExistingSourceIds(
      balls.map((b) => b.sourceId).filter((s): s is string => !!s)
    );
    setIsAddDataDialogOpen(true);
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
    showConfirm("Are you sure you want to clear all data?", () => {
      canvasRef.current?.clearBalls();
    });
  }, [showConfirm]);

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

      // Update excludedItems to remove the newly added item from the dialog list
      setExcludedItems((prev) => [...prev, { name, sourceId: sourceId || "" }]);
    },
    []
  );

  const handleShare = useCallback(() => {
    const balls = canvasRef.current?.getBalls?.() || [];

    if (balls.length === 0) {
      showToast("Add some data to share!", "info");
      return;
    }

    // Get current persisted balls from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      showToast("No data to share!", "info");
      return;
    }

    try {
      const persistedBalls = JSON.parse(stored);
      const shareURL = encodeStateToURL({
        balls: persistedBalls,
        comparisonType,
      });

      // Try to copy to clipboard with fallback methods
      const copyToClipboard = async () => {
        // Method 1: Modern clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(shareURL);
            showToast("Share link copied to clipboard!", "success");
            return;
          } catch (err) {
            console.warn("Clipboard API failed, trying fallback:", err);
          }
        }

        // Method 2: Fallback using temporary textarea
        try {
          const textarea = document.createElement("textarea");
          textarea.value = shareURL;
          textarea.style.position = "fixed";
          textarea.style.left = "-999999px";
          textarea.style.top = "-999999px";
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();

          const successful = document.execCommand("copy");
          document.body.removeChild(textarea);

          if (successful) {
            showToast("Share link copied to clipboard!", "success");
          } else {
            throw new Error("execCommand failed");
          }
        } catch (err) {
          console.warn("Fallback copy failed:", err);
          // Method 3: Final fallback - show URL for manual copy
          prompt("Copy this URL to share:", shareURL);
        }
      };

      copyToClipboard();
    } catch (e) {
      console.error("Failed to create share URL:", e);
      showToast("Failed to create share link. Please try again.", "error");
    }
  }, [comparisonType, showToast]);

  return (
    <div className="app-container">
      <main className="main-content">
        <h1 className="page-title">
          <span style={{ fontWeight: "200", color: "#3b82f6" }}>Number</span>
          <span style={{ fontWeight: "800", color: "#3b82f6" }}>Sense </span>
        </h1>
        <a
          href="https://www.jdonado.com"
          className="page-subtitle"
          target="_blank"
          rel="noopener noreferrer"
        >
          by Javier Donado
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
          onComparisonModeChange={setIsComparisonMode}
          comparisonType={comparisonType}
          onComparisonTypeChange={handleComparisonTypeChange}
          onAddData={handleOpenAddDataDialog}
          onClear={handleClear}
          onToggleComparisonMode={handleCompareToggle}
          onShare={handleShare}
        />
        <AddDataDialog
          isOpen={isAddDataDialogOpen}
          onClose={() => setIsAddDataDialogOpen(false)}
          onSelect={handleAddData}
          excludedItems={excludedItems}
          existingUnits={existingUnits}
          existingSourceIds={existingSourceIds}
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
