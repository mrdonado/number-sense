import type { PersistedBall } from "../components/PhysicsCanvas/types";

export interface SharedState {
  balls: PersistedBall[];
  comparisonType: "area" | "linear";
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
 * Decodes a shared state from URL parameters
 */
export function decodeStateFromURL(urlString?: string): SharedState | null {
  try {
    const url = new URL(urlString || window.location.href);
    const sharedParam = url.searchParams.get("shared");

    if (!sharedParam) {
      return null;
    }

    // Decode from base64
    const stateString = atob(sharedParam);

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
          ball
        );
        return null;
      }
    }

    return state;
  } catch (e) {
    console.error("Failed to decode shared state from URL:", e);
    return null;
  }
}

/**
 * Checks if the current URL contains a shared state
 */
export function hasSharedState(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  return url.searchParams.has("shared");
}
