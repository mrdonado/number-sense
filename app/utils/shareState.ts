import LZString from "lz-string";
import type { PersistedBall } from "../components/PhysicsCanvas/types";

export interface SharedState {
  balls: PersistedBall[];
  comparisonType: "area" | "linear";
}

/**
 * Sanitizes an array of balls by filling in missing optional fields
 * Uses the most common unit from other balls if units is missing
 */
export function sanitizeBalls(balls: PersistedBall[]): PersistedBall[] {
  if (balls.length === 0) return balls;

  // Find the most common unit
  const unitCounts = new Map<string, number>();
  balls.forEach((ball) => {
    if (ball.units) {
      unitCounts.set(ball.units, (unitCounts.get(ball.units) || 0) + 1);
    }
  });

  // Get the most common unit, defaulting to undefined if no units exist
  let mostCommonUnit: string | undefined = undefined;
  let maxCount = 0;
  unitCounts.forEach((count, unit) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommonUnit = unit;
    }
  });

  // Sanitize each ball
  return balls.map((ball) => ({
    ...ball,
    // Fill in missing units with most common unit
    units: ball.units || mostCommonUnit,
    // Fill in missing sourceId with "unknown"
    sourceId: ball.sourceId || "unknown",
  }));
}

/**
 * Encodes the current simulation state into a compressed URL parameter
 */
export function encodeStateToURL(state: SharedState): string {
  // Create a compact JSON representation
  const stateString = JSON.stringify(state);

  // Encode to base64 for URL-safe transmission
  const base64 = btoa(stateString);

  // Create the full URL with the state parameter
  const url = new URL(window.location.href);
  url.searchParams.set("shared", base64);

  return url.toString();
}

/**
 * Loads a preset from the presets.json file
 */
export async function loadPreset(
  presetId: string,
): Promise<SharedState | null> {
  try {
    const response = await fetch("/data/presets.json");
    if (!response.ok) {
      console.error("Failed to load presets file");
      return null;
    }

    const presets = await response.json();
    const preset = presets[presetId];

    if (!preset) {
      console.error(`Preset "${presetId}" not found`);
      return null;
    }

    // Validate the preset structure
    if (!preset.balls || !Array.isArray(preset.balls)) {
      console.error("Invalid preset: missing or invalid balls array");
      return null;
    }

    if (
      !preset.comparisonType ||
      !["area", "linear"].includes(preset.comparisonType)
    ) {
      console.error("Invalid preset: missing or invalid comparisonType");
      return null;
    }

    // Sanitize balls to fill in missing optional fields
    const state: SharedState = {
      balls: sanitizeBalls(preset.balls),
      comparisonType: preset.comparisonType,
    };

    return state;
  } catch (e) {
    console.error("Failed to load preset:", e);
    return null;
  }
}

/**
 * Gets the preset ID from URL parameters if present
 */
export function getPresetIdFromURL(urlString?: string): string | null {
  try {
    const url = new URL(urlString || window.location.href);
    return url.searchParams.get("preset");
  } catch (e) {
    console.error("Failed to get preset ID from URL:", e);
    return null;
  }
}

/**
 * Decodes a shared state from URL parameters
 * Supports both LZ-String compressed format and legacy base64 format
 */
export function decodeStateFromURL(urlString?: string): SharedState | null {
  try {
    const url = new URL(urlString || window.location.href);
    const sharedParam = url.searchParams.get("shared");

    if (!sharedParam) {
      return null;
    }

    let stateString: string;

    // Try LZ-String decompression first
    try {
      const decompressed =
        LZString.decompressFromEncodedURIComponent(sharedParam);
      if (decompressed) {
        stateString = decompressed;
      } else {
        // Fall back to base64 for backward compatibility
        stateString = atob(sharedParam);
      }
    } catch (e) {
      // If LZ-String fails, try base64 as fallback
      stateString = atob(sharedParam);
    }

    // Parse JSON
    const state = JSON.parse(stateString) as SharedState;

    // Validate the structure
    if (!state.balls || !Array.isArray(state.balls)) {
      console.error("Invalid shared state: missing or invalid balls array");
      return null;
    }

    if (
      !state.comparisonType ||
      !["area", "linear"].includes(state.comparisonType)
    ) {
      console.error("Invalid shared state: missing or invalid comparisonType");
      return null;
    }

    // Validate each ball has required fields
    for (const ball of state.balls) {
      if (
        !ball.name ||
        typeof ball.originalRadius !== "number" ||
        !ball.color
      ) {
        console.error(
          "Invalid shared state: ball missing required fields",
          ball,
        );
        return null;
      }
    }

    // Sanitize balls to fill in missing optional fields
    state.balls = sanitizeBalls(state.balls);

    return state;
  } catch (e) {
    console.error("Failed to decode shared state from URL:", e);
    return null;
  }
}

/**
 * Checks if the current URL contains a shared state or preset
 */
export function hasSharedState(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  return url.searchParams.has("shared") || url.searchParams.has("preset");
}

/**
 * Storage key for tracking the active preset
 */
const PRESET_ID_KEY = "activePresetId";

/**
 * Marks that a preset has been loaded
 */
export function markPresetLoaded(presetId: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESET_ID_KEY, presetId);
}

/**
 * Clears the preset marker (call when simulation is modified)
 */
export function clearPresetMarker(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PRESET_ID_KEY);
}

/**
 * Gets the active preset ID if one is loaded
 */
export function getActivePresetId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PRESET_ID_KEY);
}

/**
 * Creates a share URL for the given state
 * If a preset is active, returns a preset URL
 * Otherwise, returns a compressed URL using LZ-String
 */
export function createShareURL(state: SharedState): string {
  const url = new URL(window.location.href);
  // Clear any existing query parameters
  url.search = "";

  // Check if we have an active preset
  const activePresetId = getActivePresetId();

  if (activePresetId) {
    // Use preset URL
    url.searchParams.set("preset", activePresetId);
  } else {
    // Use LZ-String compression for URL-safe encoding
    const stateString = JSON.stringify(state);
    const compressed = LZString.compressToEncodedURIComponent(stateString);
    url.searchParams.set("shared", compressed);
  }

  return url.toString();
}
