import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Legend } from "../Legend";
import type { BallInfo } from "../types";

describe("Legend", () => {
  // Values: Red=314.16, Blue=1256.64, Green=706.86
  // Sorted by value (desc): Blue, Green, Red
  const mockBalls: BallInfo[] = [
    {
      id: 1,
      name: "Red Ball",
      color: "#ef4444",
      originalRadius: 10,
      value: Math.PI * 10 * 10,
      units: "USD",
    },
    {
      id: 2,
      name: "Blue Ball",
      color: "#3b82f6",
      originalRadius: 20,
      value: Math.PI * 20 * 20,
      units: "USD",
    },
    {
      id: 3,
      name: "Green Ball",
      color: "#22c55e",
      originalRadius: 15,
      value: Math.PI * 15 * 15,
      units: "USD",
    },
  ];

  // After sorting by value (desc): [Blue (id=2), Green (id=3), Red (id=1)]
  const sortedBallIds = [2, 3, 1];

  const defaultProps = {
    balls: mockBalls,
    hoveredBallId: null,
    hiddenBallIds: new Set<number>(),
    onHover: vi.fn(),
    onRemove: vi.fn(),
    onToggleVisibility: vi.fn(),
    onZoom: vi.fn(),
  };

  it("renders nothing when there are no balls", () => {
    const { container } = render(
      <Legend
        balls={[]}
        hoveredBallId={null}
        hiddenBallIds={new Set()}
        onHover={vi.fn()}
        onRemove={vi.fn()}
        onToggleVisibility={vi.fn()}
        onZoom={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders collapsible header with ball count", () => {
    const ballsWithoutUnits = mockBalls.map((b) => ({
      ...b,
      units: undefined,
    }));
    render(<Legend {...defaultProps} balls={ballsWithoutUnits} />);

    expect(screen.getByText("Legend (3)")).toBeInTheDocument();
    // Check for the chevron-down icon
    const svg = screen.getByTitle("Collapse legend").querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.classList.contains("lucide-chevron-down")).toBe(true);
  });

  it("renders header with units when all balls have same units", () => {
    render(<Legend {...defaultProps} />);

    expect(screen.getByText(/Legend \(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/· USD/)).toBeInTheDocument();
  });

  it("renders 'mixed' in red when balls have different units", () => {
    const mixedUnitsBalls: BallInfo[] = [
      { ...mockBalls[0], units: "USD" },
      { ...mockBalls[1], units: "people" },
      { ...mockBalls[2], units: "USD" },
    ];
    render(<Legend {...defaultProps} balls={mixedUnitsBalls} />);

    const mixedSpan = screen.getByText(/· mixed/);
    expect(mixedSpan).toBeInTheDocument();
    // Check the inline style color attribute
    expect(mixedSpan.style.color).toBe("rgb(239, 68, 68)");
  });

  it("updates units display when balls are removed", () => {
    // Start with mixed units
    const mixedUnitsBalls: BallInfo[] = [
      { ...mockBalls[0], units: "USD" },
      { ...mockBalls[1], units: "people" },
    ];
    const { rerender } = render(
      <Legend {...defaultProps} balls={mixedUnitsBalls} />,
    );

    // Should show mixed
    expect(screen.getByText(/· mixed/)).toBeInTheDocument();

    // Remove the "people" ball - now only USD remains
    const usdOnlyBalls: BallInfo[] = [{ ...mockBalls[0], units: "USD" }];
    rerender(<Legend {...defaultProps} balls={usdOnlyBalls} />);

    // Should now show USD
    expect(screen.queryByText(/· mixed/)).not.toBeInTheDocument();
    expect(screen.getByText(/· USD/)).toBeInTheDocument();
  });

  it("updates units display based on visible balls only", () => {
    const mixedUnitsBalls: BallInfo[] = [
      { ...mockBalls[0], id: 1, units: "USD" },
      { ...mockBalls[1], id: 2, units: "people" },
    ];

    // Hide the "people" ball
    const hiddenBallIds = new Set([2]);
    render(
      <Legend
        {...defaultProps}
        balls={mixedUnitsBalls}
        hiddenBallIds={hiddenBallIds}
      />,
    );

    // Should show USD (not mixed) since only USD ball is visible
    expect(screen.queryByText(/· mixed/)).not.toBeInTheDocument();
    expect(screen.getByText(/· USD/)).toBeInTheDocument();
  });

  it("collapses and expands when header is clicked", () => {
    render(<Legend {...defaultProps} />);

    // Initially expanded
    expect(screen.getByText("Red Ball")).toBeInTheDocument();
    let svg = screen.getByTitle("Collapse legend").querySelector("svg");
    expect(svg?.classList.contains("lucide-chevron-down")).toBe(true);

    // Click to collapse
    fireEvent.click(screen.getByText(/Legend \(3\)/));
    expect(screen.queryByText("Red Ball")).not.toBeInTheDocument();
    svg = screen.getByTitle("Expand legend").querySelector("svg");
    expect(svg?.classList.contains("lucide-chevron-right")).toBe(true);

    // Click to expand
    fireEvent.click(screen.getByText(/Legend \(3\)/));
    expect(screen.getByText("Red Ball")).toBeInTheDocument();
    svg = screen.getByTitle("Collapse legend").querySelector("svg");
    expect(svg?.classList.contains("lucide-chevron-down")).toBe(true);
  });

  it("displays abbreviated values for each ball", () => {
    render(<Legend {...defaultProps} />);

    // Blue ball value = π × 20² ≈ 1256.64 → "$1.3K USD"
    // Green ball value = π × 15² ≈ 706.86 → "$707 USD"
    // Red ball value = π × 10² ≈ 314.16 → "$314 USD"
    expect(screen.getByText("$1.3K", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("$707", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("$314", { exact: false })).toBeInTheDocument();
  });

  it("sorts balls by value in descending order", () => {
    render(<Legend {...defaultProps} />);

    const listItems = screen.getAllByRole("listitem");
    // Sorted order should be: Blue (largest), Green, Red (smallest)
    expect(listItems[0]).toHaveTextContent("Blue Ball");
    expect(listItems[1]).toHaveTextContent("Green Ball");
    expect(listItems[2]).toHaveTextContent("Red Ball");
  });

  it("renders all balls in the list", () => {
    render(<Legend {...defaultProps} />);

    expect(screen.getByText("Red Ball")).toBeInTheDocument();
    expect(screen.getByText("Blue Ball")).toBeInTheDocument();
    expect(screen.getByText("Green Ball")).toBeInTheDocument();
  });

  it("displays color indicators for each ball", () => {
    render(<Legend {...defaultProps} />);

    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(3);

    // Each list item should have a colored span with a background color set
    listItems.forEach((item) => {
      const colorIndicator = item.querySelector("span") as HTMLElement;
      expect(colorIndicator).not.toBeNull();
      // Background color is converted to rgb format by the browser
      expect(colorIndicator.style.backgroundColor).toBeTruthy();
    });
  });

  it("calls onHover with ball id when pointer enters a list item", () => {
    const onHover = vi.fn();
    render(<Legend {...defaultProps} onHover={onHover} />);

    const listItems = screen.getAllByRole("listitem");
    // Sorted order: [Blue (id=2), Green (id=3), Red (id=1)]
    // Use pointerEnter with mouse pointerType (component ignores touch)
    fireEvent.pointerEnter(listItems[1], { pointerType: "mouse" });

    expect(onHover).toHaveBeenCalledWith(sortedBallIds[1]);
  });

  it("calls onHover with null when pointer leaves a list item", () => {
    const onHover = vi.fn();
    render(<Legend {...defaultProps} onHover={onHover} />);

    const listItems = screen.getAllByRole("listitem");
    // Use pointerLeave with mouse pointerType (component ignores touch)
    fireEvent.pointerLeave(listItems[0], { pointerType: "mouse" });

    expect(onHover).toHaveBeenCalledWith(null);
  });

  it("highlights the hovered ball in the list", () => {
    render(<Legend {...defaultProps} hoveredBallId={2} />);

    const listItems = screen.getAllByRole("listitem") as HTMLElement[];

    // Blue ball (id=2) is at index 0 after sorting and should have highlight styles
    expect(listItems[0].style.boxShadow).toBe(
      `0 0 0 2px ${mockBalls[1].color}`,
    );

    // Other items should not have box-shadow highlight
    expect(listItems[1].style.boxShadow).toBe("none");
  });

  describe("remove button", () => {
    it("renders a remove button for each ball", () => {
      render(<Legend {...defaultProps} />);

      const removeButtons = screen.getAllByRole("button", {
        name: "Remove ball",
      });
      expect(removeButtons).toHaveLength(3);
    });

    it("calls onRemove with ball id when remove button is clicked", () => {
      const onRemove = vi.fn();
      render(<Legend {...defaultProps} onRemove={onRemove} />);

      const removeButtons = screen.getAllByRole("button", {
        name: "Remove ball",
      });
      // Sorted order: [Blue (id=2), Green (id=3), Red (id=1)]
      fireEvent.click(removeButtons[1]);

      expect(onRemove).toHaveBeenCalledWith(sortedBallIds[1]);
    });

    it("calls onRemove only once per click", () => {
      const onRemove = vi.fn();
      render(<Legend {...defaultProps} onRemove={onRemove} />);

      const removeButtons = screen.getAllByRole("button", {
        name: "Remove ball",
      });
      fireEvent.click(removeButtons[0]);

      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it("does not trigger onToggleVisibility when clicking remove button", () => {
      const onRemove = vi.fn();
      const onToggleVisibility = vi.fn();
      render(
        <Legend
          {...defaultProps}
          onRemove={onRemove}
          onToggleVisibility={onToggleVisibility}
        />,
      );

      const removeButtons = screen.getAllByRole("button", {
        name: "Remove ball",
      });
      fireEvent.click(removeButtons[0]);

      expect(onRemove).toHaveBeenCalled();
      expect(onToggleVisibility).not.toHaveBeenCalled();
    });

    it("has remove button class applied", () => {
      render(<Legend {...defaultProps} />);

      const removeButtons = screen.getAllByRole("button", {
        name: "Remove ball",
      });
      removeButtons.forEach((button) => {
        // CSS Modules hashes class names, so check for the module prefix
        expect(button.className).toContain("removeButton");
      });
    });
  });

  describe("visibility toggle", () => {
    it("calls onToggleVisibility with ball id when checkbox is clicked", () => {
      const onToggleVisibility = vi.fn();
      render(
        <Legend {...defaultProps} onToggleVisibility={onToggleVisibility} />,
      );

      const visibilityButtons = screen.getAllByRole("button", {
        name: "Hide ball",
      });
      // Sorted order: [Blue (id=2), Green (id=3), Red (id=1)]
      fireEvent.click(visibilityButtons[1]);

      expect(onToggleVisibility).toHaveBeenCalledWith(sortedBallIds[1]);
    });

    it("calls onZoom with ball id when list item is clicked", () => {
      const onZoom = vi.fn();
      render(<Legend {...defaultProps} onZoom={onZoom} />);

      const listItems = screen.getAllByRole("listitem");
      // Sorted order: [Blue (id=2), Green (id=3), Red (id=1)]
      fireEvent.click(listItems[1]);

      expect(onZoom).toHaveBeenCalledWith(sortedBallIds[1]);
    });

    it("shows grayed out style for hidden balls", () => {
      // Hide Blue ball (id=2), which is at index 0 after sorting
      const hiddenBallIds = new Set([2]);
      render(<Legend {...defaultProps} hiddenBallIds={hiddenBallIds} />);

      const listItems = screen.getAllByRole("listitem") as HTMLElement[];

      // Hidden ball (id=2) is at index 0 and should have reduced opacity
      expect(listItems[0].style.opacity).toBe("0.4");

      // Visible balls should have full opacity
      expect(listItems[1].style.opacity).toBe("1");
      expect(listItems[2].style.opacity).toBe("1");
    });

    it("applies grayscale filter to hidden ball color indicator", () => {
      // Hide Red ball (id=1), which is at index 2 after sorting
      const hiddenBallIds = new Set([1]);
      render(<Legend {...defaultProps} hiddenBallIds={hiddenBallIds} />);

      const listItems = screen.getAllByRole("listitem");
      // Red ball (id=1) is at index 2 after sorting
      const hiddenColorIndicator = listItems[2].querySelector(
        "span",
      ) as HTMLElement;
      const visibleColorIndicator = listItems[0].querySelector(
        "span",
      ) as HTMLElement;

      expect(hiddenColorIndicator.style.filter).toBe("grayscale(100%)");
      expect(visibleColorIndicator.style.filter).toBe("none");
    });

    it("shows dimmed text for hidden balls", () => {
      const hiddenBallIds = new Set([3]);
      render(<Legend {...defaultProps} hiddenBallIds={hiddenBallIds} />);

      const hiddenBallText = screen.getByText("Green Ball");
      const visibleBallText = screen.getByText("Red Ball");

      expect(hiddenBallText.style.color).toBe("rgba(255, 255, 255, 0.5)");
      expect(visibleBallText.style.color).toBe("white");
    });
  });
});
