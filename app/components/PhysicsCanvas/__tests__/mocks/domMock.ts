import { vi } from "vitest";

export function setupDomMocks(width = 800, height = 600) {
  Object.defineProperty(HTMLDivElement.prototype, "clientWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(HTMLDivElement.prototype, "clientHeight", {
    configurable: true,
    value: height,
  });
}

export function createEventListenerSpies() {
  const addEventListenerSpy = vi.spyOn(
    HTMLCanvasElement.prototype,
    "addEventListener"
  );
  const removeEventListenerSpy = vi.spyOn(
    HTMLCanvasElement.prototype,
    "removeEventListener"
  );

  return {
    addEventListenerSpy,
    removeEventListenerSpy,
    restore: () => {
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    },
  };
}
