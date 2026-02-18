import { describe, it, expect } from "vitest";
import LZString from "lz-string";
import { encodeStateToURL, decodeStateFromURL } from "../shareState";
import type { SharedState } from "../shareState";

describe("shareState utilities", () => {
  const mockState: SharedState = {
    balls: [
      {
        name: "Test Ball 1",
        color: "#FF5733",
        originalRadius: 50,
        units: "km",
        sourceId: "test-1",
      },
      {
        name: "Test Ball 2",
        color: "#33C3FF",
        originalRadius: 100,
        units: "miles",
      },
    ],
    comparisonType: "area",
  };

  it("should encode state to URL", () => {
    // Mock window.location
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      href: "http://localhost:3000",
    } as any;

    const url = encodeStateToURL(mockState);

    expect(url).toContain("shared=");
    expect(url).toContain("localhost:3000");

    // Restore window.location
    window.location = originalLocation;
  });

  it("should decode state from URL", () => {
    // Mock window.location
    const originalLocation = window.location;

    // Create a proper URL with encoded state
    const encodedState = btoa(JSON.stringify(mockState));
    const testURL = `http://localhost:3000?shared=${encodedState}`;

    const decoded = decodeStateFromURL(testURL);

    expect(decoded).not.toBeNull();
    expect(decoded?.balls).toHaveLength(2);
    expect(decoded?.balls[0].name).toBe("Test Ball 1");
    expect(decoded?.comparisonType).toBe("area");
  });

  it("should return null for invalid URL", () => {
    const decoded = decodeStateFromURL("http://localhost:3000");
    expect(decoded).toBeNull();
  });

  it("should return null for corrupted data", () => {
    const decoded = decodeStateFromURL("http://localhost:3000?shared=invalid");
    expect(decoded).toBeNull();
  });

  it("should validate required fields", () => {
    const invalidState = {
      balls: [
        {
          name: "Test",
          // missing originalRadius and color
        },
      ],
      comparisonType: "area",
    };

    const encodedState = btoa(JSON.stringify(invalidState));
    const testURL = `http://localhost:3000?shared=${encodedState}`;

    const decoded = decodeStateFromURL(testURL);
    expect(decoded).toBeNull();
  });

  it("should validate comparisonType", () => {
    const invalidState = {
      balls: mockState.balls,
      comparisonType: "invalid" as any,
    };

    const encodedState = btoa(JSON.stringify(invalidState));
    const testURL = `http://localhost:3000?shared=${encodedState}`;

    const decoded = decodeStateFromURL(testURL);
    expect(decoded).toBeNull();
  });

  it("should decode LZ-String compressed URLs", () => {
    // Create a URL with LZ-String compression
    const compressed = LZString.compressToEncodedURIComponent(
      JSON.stringify(mockState),
    );
    const testURL = `http://localhost:3000?shared=${compressed}`;

    const decoded = decodeStateFromURL(testURL);

    expect(decoded).not.toBeNull();
    expect(decoded?.balls).toHaveLength(2);
    expect(decoded?.balls[0].name).toBe("Test Ball 1");
    expect(decoded?.comparisonType).toBe("area");
  });

  it("should produce smaller URLs with compression for large data", () => {
    // Create a large state with many balls
    const largeState: SharedState = {
      balls: Array.from({ length: 20 }, (_, i) => ({
        name: `Ball ${i + 1} with a long descriptive name`,
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        originalRadius: Math.random() * 100,
        units: "kilometers",
        sourceId: `source-${i}`,
      })),
      comparisonType: "area",
    };

    // Compare sizes
    const base64Encoded = btoa(JSON.stringify(largeState));
    const lzCompressed = LZString.compressToEncodedURIComponent(
      JSON.stringify(largeState),
    );

    // LZ-String should produce smaller output for repetitive data
    expect(lzCompressed.length).toBeLessThan(base64Encoded.length);
  });

  it("should maintain backward compatibility with base64 URLs", () => {
    // Old-style base64 URL should still work
    const encodedState = btoa(JSON.stringify(mockState));
    const testURL = `http://localhost:3000?shared=${encodedState}`;

    const decoded = decodeStateFromURL(testURL);

    expect(decoded).not.toBeNull();
    expect(decoded?.balls).toHaveLength(2);
    expect(decoded?.comparisonType).toBe("area");
  });
});
