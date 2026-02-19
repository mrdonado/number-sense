import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import Home from "../page";
import { ToastProvider } from "../components/Toast";

// Mock next/navigation
const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

// Mock the AddDataDialog component
const mockCloseAddDataDialog = vi.fn();
vi.mock("../components/AddDataDialog", () => ({
  default: function MockAddDataDialog(props: {
    isOpen: boolean;
    onClose: () => void;
  }) {
    if (!props.isOpen) return null;

    return (
      <button
        onClick={() => {
          mockCloseAddDataDialog();
          props.onClose();
        }}
        title="Close Add Data"
      >
        Close Add Data
      </button>
    );
  },
  __esModule: true,
}));

// Mock the PhysicsCanvas component
const mockSpawnBall = vi.fn();
const mockClearBalls = vi.fn();
const mockGoToComparisonOverview = vi.fn();

// Helper to render with ToastProvider
const renderWithToast = (component: React.ReactElement) => {
  return render(<ToastProvider>{component}</ToastProvider>);
};

vi.mock("../components/PhysicsCanvas/index", () => ({
  default: React.forwardRef(function MockPhysicsCanvas(
    props: {
      onAddData?: () => void;
      onClear?: () => void;
      onToggleComparisonMode?: () => void;
      onComparisonModeChange?: (isComparisonMode: boolean) => void;
    },
    ref: React.ForwardedRef<{
      spawnBall: (radius: number, name?: string) => void;
      clearBalls: () => void;
      goToComparisonOverview: () => void;
    }>,
  ) {
    React.useImperativeHandle(ref, () => ({
      spawnBall: mockSpawnBall,
      clearBalls: mockClearBalls,
      goToComparisonOverview: mockGoToComparisonOverview,
    }));
    return (
      <div data-testid="physics-canvas">
        Physics Canvas
        {/* Render control buttons for testing */}
        <button onClick={props.onAddData} title="Add Data">
          +
        </button>
        <button onClick={props.onClear} title="Clear All">
          Clear
        </button>
        <button
          onClick={() => props.onComparisonModeChange?.(true)}
          title="Enable Comparison"
        >
          Enable Comparison
        </button>
      </div>
    );
  }),
  __esModule: true,
}));

// Helper to calculate expected radius from area: r = √(A/π)
const areaToRadius = (area: number) => Math.sqrt(area / Math.PI);

describe("Home Page", () => {
  beforeEach(() => {
    mockSpawnBall.mockClear();
    mockClearBalls.mockClear();
    mockGoToComparisonOverview.mockClear();
    mockCloseAddDataDialog.mockClear();
    // Reset search params to debug mode for tests that need input fields
    mockSearchParams.delete("debugMode");
  });

  it("renders the header", () => {
    renderWithToast(<Home />);
    expect(screen.getByText(/Number/i)).toBeInTheDocument();
    expect(screen.getByText(/Sense/i)).toBeInTheDocument();
  });

  it("renders the Add Data button", () => {
    renderWithToast(<Home />);
    expect(screen.getByTitle("Add Data")).toBeInTheDocument();
  });

  it("renders the Clear button", () => {
    renderWithToast(<Home />);
    expect(screen.getByTitle("Clear All")).toBeInTheDocument();
  });

  it("renders the PhysicsCanvas component", () => {
    renderWithToast(<Home />);
    expect(screen.getByTestId("physics-canvas")).toBeInTheDocument();
  });

  describe("debug mode", () => {
    beforeEach(() => {
      mockSearchParams.set("debugMode", "true");
    });

    it("renders the input fields in debug mode", () => {
      renderWithToast(<Home />);
      expect(screen.getByPlaceholderText("Enter area")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter name")).toBeInTheDocument();
    });

    it("renders the Drop Ball button in debug mode", () => {
      renderWithToast(<Home />);
      expect(
        screen.getByRole("button", { name: "Drop Ball" }),
      ).toBeInTheDocument();
    });

    it("spawns a ball with radius calculated from area when clicking the button", async () => {
      const user = userEvent.setup();
      renderWithToast(<Home />);

      const input = screen.getByPlaceholderText("Enter area");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "100");
      await user.click(button);

      // Area 100 → radius = √(100/π) ≈ 5.64, no name provided
      expect(mockSpawnBall).toHaveBeenCalledWith(areaToRadius(100), undefined);
    });

    it("spawns a ball with name when provided", async () => {
      const user = userEvent.setup();
      renderWithToast(<Home />);

      const nameInput = screen.getByPlaceholderText("Enter name");
      const areaInput = screen.getByPlaceholderText("Enter area");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(nameInput, "My Ball");
      await user.type(areaInput, "100");
      await user.click(button);

      expect(mockSpawnBall).toHaveBeenCalledWith(areaToRadius(100), "My Ball");
    });

    it("spawns a ball when pressing Enter in the input field", async () => {
      const user = userEvent.setup();
      renderWithToast(<Home />);

      const input = screen.getByPlaceholderText("Enter area");

      await user.type(input, "314{Enter}");

      expect(mockSpawnBall).toHaveBeenCalledWith(areaToRadius(314), undefined);
    });

    it("does not spawn a ball with zero area", async () => {
      const user = userEvent.setup();
      renderWithToast(<Home />);

      const input = screen.getByPlaceholderText("Enter area");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "0");
      await user.click(button);

      expect(mockSpawnBall).not.toHaveBeenCalled();
    });

    it("does not spawn a ball with negative area", async () => {
      const user = userEvent.setup();
      renderWithToast(<Home />);

      const input = screen.getByPlaceholderText("Enter area");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "-5");
      await user.click(button);

      expect(mockSpawnBall).not.toHaveBeenCalled();
    });

    it("does not spawn a ball with empty input", async () => {
      const user = userEvent.setup();
      renderWithToast(<Home />);

      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.click(button);

      expect(mockSpawnBall).not.toHaveBeenCalled();
    });

    it("does not spawn a ball with non-numeric input", async () => {
      const user = userEvent.setup();
      renderWithToast(<Home />);

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
      renderWithToast(<Home />);

      const input = screen.getByPlaceholderText("Enter area");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "50");
      await user.click(button);

      await user.clear(input);
      await user.type(input, "200");
      await user.click(button);

      expect(mockSpawnBall).toHaveBeenCalledTimes(2);
      expect(mockSpawnBall).toHaveBeenNthCalledWith(
        1,
        areaToRadius(50),
        undefined,
      );
      expect(mockSpawnBall).toHaveBeenNthCalledWith(
        2,
        areaToRadius(200),
        undefined,
      );
    });

    it("handles decimal area values", async () => {
      const user = userEvent.setup();
      renderWithToast(<Home />);

      const input = screen.getByPlaceholderText("Enter area");
      const button = screen.getByRole("button", { name: "Drop Ball" });

      await user.type(input, "3.14");
      await user.click(button);

      expect(mockSpawnBall).toHaveBeenCalledWith(areaToRadius(3.14), undefined);
    });

    it("updates the input value when typing", async () => {
      const user = userEvent.setup();
      renderWithToast(<Home />);

      const input = screen.getByPlaceholderText(
        "Enter area",
      ) as HTMLInputElement;

      await user.type(input, "42");

      expect(input.value).toBe("42");
    });

    it("clears when user clears the input", async () => {
      const user = userEvent.setup();
      renderWithToast(<Home />);

      const input = screen.getByPlaceholderText(
        "Enter area",
      ) as HTMLInputElement;

      await user.type(input, "100");
      await user.clear(input);

      expect(input.value).toBe("");
    });

    it("can clear after spawning balls", async () => {
      const user = userEvent.setup();
      renderWithToast(<Home />);

      const areaInput = screen.getByPlaceholderText("Enter area");
      const dropButton = screen.getByRole("button", { name: "Drop Ball" });
      const clearButton = screen.getByTitle("Clear All");

      // Spawn a ball
      await user.type(areaInput, "100");
      await user.click(dropButton);

      expect(mockSpawnBall).toHaveBeenCalledTimes(1);

      // Clear all balls - click the clear button
      await user.click(clearButton);

      // Confirm the clear action in the toast dialog - get all buttons and find the one in the actions
      const confirmButton = screen.getAllByRole("button", { name: "Clear" })[1];
      await user.click(confirmButton);

      expect(mockClearBalls).toHaveBeenCalledTimes(1);
    });
  });

  describe("non-debug mode", () => {
    beforeEach(() => {
      mockSearchParams.delete("debugMode");
    });

    it("does not render input fields by default", () => {
      renderWithToast(<Home />);
      expect(
        screen.queryByPlaceholderText("Enter area"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText("Enter name"),
      ).not.toBeInTheDocument();
    });

    it("does not render Drop Ball button by default", () => {
      renderWithToast(<Home />);
      expect(
        screen.queryByRole("button", { name: "Drop Ball" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("clear balls", () => {
    it("calls clearBalls when clicking the Clear button", async () => {
      const user = userEvent.setup();
      renderWithToast(<Home />);

      const clearButton = screen.getByTitle("Clear All");
      await user.click(clearButton);

      // Confirm the clear action in the toast dialog - get all buttons and find the one in the actions
      const confirmButton = screen.getAllByRole("button", { name: "Clear" })[1];
      await user.click(confirmButton);

      expect(mockClearBalls).toHaveBeenCalledTimes(1);
    });
  });

  it("returns to comparison overview when Add Data dialog closes during comparison mode", async () => {
    const user = userEvent.setup();
    renderWithToast(<Home />);

    await user.click(screen.getByTitle("Enable Comparison"));
    await user.click(screen.getByTitle("Add Data"));
    await user.click(screen.getByTitle("Close Add Data"));

    expect(mockCloseAddDataDialog).toHaveBeenCalledTimes(1);
    expect(mockGoToComparisonOverview).toHaveBeenCalledTimes(1);
  });
});
