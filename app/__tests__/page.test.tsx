import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import Home from "../page";

// Mock the PhysicsCanvas component
const mockSpawnBall = vi.fn();

vi.mock("../components/PhysicsCanvas", () => ({
  default: React.forwardRef(function MockPhysicsCanvas(
    _props: unknown,
    ref: React.ForwardedRef<{ spawnBall: (radius: number) => void }>
  ) {
    React.useImperativeHandle(ref, () => ({ spawnBall: mockSpawnBall }));
    return <div data-testid="physics-canvas">Physics Canvas</div>;
  }),
  __esModule: true,
}));

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
    expect(screen.getByPlaceholderText("Enter radius")).toBeInTheDocument();
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
    it("spawns a ball with the entered radius when clicking the button", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText("Enter radius");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "25");
      await user.click(button);

      expect(mockSpawnBall).toHaveBeenCalledWith(25);
    });

    it("spawns a ball when pressing Enter in the input field", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText("Enter radius");

      await user.type(input, "30{Enter}");

      expect(mockSpawnBall).toHaveBeenCalledWith(30);
    });

    it("does not spawn a ball with zero radius", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText("Enter radius");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "0");
      await user.click(button);

      expect(mockSpawnBall).not.toHaveBeenCalled();
    });

    it("does not spawn a ball with negative radius", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText("Enter radius");
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

      const input = screen.getByPlaceholderText("Enter radius");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      // Clear and type non-numeric (browser input type=number typically prevents this,
      // but we test the logic anyway)
      await user.type(input, "abc");
      await user.click(button);

      expect(mockSpawnBall).not.toHaveBeenCalled();
    });

    it("spawns multiple balls with different radii", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText("Enter radius");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "20");
      await user.click(button);

      await user.clear(input);
      await user.type(input, "50");
      await user.click(button);

      expect(mockSpawnBall).toHaveBeenCalledTimes(2);
      expect(mockSpawnBall).toHaveBeenNthCalledWith(1, 20);
      expect(mockSpawnBall).toHaveBeenNthCalledWith(2, 50);
    });
  });

  describe("input field behavior", () => {
    it("updates the input value when typing", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText(
        "Enter radius"
      ) as HTMLInputElement;

      await user.type(input, "42");

      expect(input.value).toBe("42");
    });

    it("clears when user clears the input", async () => {
      const user = userEvent.setup();
      render(<Home />);

      const input = screen.getByPlaceholderText(
        "Enter radius"
      ) as HTMLInputElement;

      await user.type(input, "100");
      await user.clear(input);

      expect(input.value).toBe("");
    });
  });
});
