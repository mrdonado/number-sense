import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import Home from "../page";

// Mock the PhysicsCanvas component
const mockSpawnBall = vi.fn();

vi.mock("../components/PhysicsCanvas/index", () => ({
  default: React.forwardRef(function MockPhysicsCanvas(
    _props: unknown,
    ref: React.ForwardedRef<{ spawnBall: (radius: number) => void }>
  ) {
    React.useImperativeHandle(ref, () => ({ spawnBall: mockSpawnBall }));
    return <div data-testid="physics-canvas">Physics Canvas</div>;
  }),
  __esModule: true,
}));

// Helper to calculate expected radius from area: r = √(A/π)
const areaToRadius = (area: number) => Math.sqrt(area / Math.PI);

describe("Home Page", () => {
  beforeEach(() => {
    mockSpawnBall.mockClear();
  });

  it("renders the header", () => {
    render(<Home />);
    expect(screen.getByText("Number Sense")).toBeInTheDocument();
  });

  it("renders the input field with correct placeholder", () => {
    render(<Home />);
    expect(screen.getByPlaceholderText("Enter area")).toBeInTheDocument();
  });

  it("renders the Drop Ball button", () => {
    render(<Home />);
    expect(
      screen.getByRole("button", { name: "Drop Ball" })
    ).toBeInTheDocument();
  });

  it("renders the PhysicsCanvas component", () => {
    render(<Home />);
    expect(screen.getByTestId("physics-canvas")).toBeInTheDocument();
  });

  describe("ball spawning", () => {
    it("spawns a ball with radius calculated from area when clicking the button", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText("Enter area");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "100");
      await user.click(button);

      // Area 100 → radius = √(100/π) ≈ 5.64
      expect(mockSpawnBall).toHaveBeenCalledWith(areaToRadius(100));
    });

    it("spawns a ball when pressing Enter in the input field", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText("Enter area");

      await user.type(input, "314{Enter}");

      expect(mockSpawnBall).toHaveBeenCalledWith(areaToRadius(314));
    });

    it("does not spawn a ball with zero area", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText("Enter area");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "0");
      await user.click(button);

      expect(mockSpawnBall).not.toHaveBeenCalled();
    });

    it("does not spawn a ball with negative area", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText("Enter area");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "-5");
      await user.click(button);

      expect(mockSpawnBall).not.toHaveBeenCalled();
    });

    it("does not spawn a ball with empty input", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.click(button);

      expect(mockSpawnBall).not.toHaveBeenCalled();
    });

    it("does not spawn a ball with non-numeric input", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText("Enter area");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      // Clear and type non-numeric (browser input type=number typically prevents this,
      // but we test the logic anyway)
      await user.type(input, "abc");
      await user.click(button);

      expect(mockSpawnBall).not.toHaveBeenCalled();
    });

    it("spawns multiple balls with different areas", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText("Enter area");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "50");
      await user.click(button);

      await user.clear(input);
      await user.type(input, "200");
      await user.click(button);

      expect(mockSpawnBall).toHaveBeenCalledTimes(2);
      expect(mockSpawnBall).toHaveBeenNthCalledWith(1, areaToRadius(50));
      expect(mockSpawnBall).toHaveBeenNthCalledWith(2, areaToRadius(200));
    });

    it("handles decimal area values", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText("Enter area");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "3.14");
      await user.click(button);

      expect(mockSpawnBall).toHaveBeenCalledWith(areaToRadius(3.14));
    });
  });

  describe("input field behavior", () => {
    it("updates the input value when typing", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText(
        "Enter area"
      ) as HTMLInputElement;

      await user.type(input, "42");

      expect(input.value).toBe("42");
    });

    it("clears when user clears the input", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText(
        "Enter area"
      ) as HTMLInputElement;

      await user.type(input, "100");
      await user.clear(input);

      expect(input.value).toBe("");
    });
  });
});
