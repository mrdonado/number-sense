import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Legend } from "../Legend";
import type { BallInfo } from "../types";

describe("Legend", () => {
  const mockBalls: BallInfo[] = [
    { id: 1, name: "Red Ball", color: "#ef4444", originalRadius: 10 },
    { id: 2, name: "Blue Ball", color: "#3b82f6", originalRadius: 20 },
    { id: 3, name: "Green Ball", color: "#22c55e", originalRadius: 15 },
  ];

  const defaultProps = {
    balls: mockBalls,
    hoveredBallId: null,
    hiddenBallIds: new Set<number>(),
    onHover: vi.fn(),
    onRemove: vi.fn(),
    onToggleVisibility: vi.fn(),
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
      />
    );
    expect(container.firstChild).toBeNull();
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

  it("calls onHover with ball id when mouse enters a list item", () => {
    const onHover = vi.fn();
    render(<Legend {...defaultProps} onHover={onHover} />);

    const listItems = screen.getAllByRole("listitem");
    fireEvent.mouseEnter(listItems[1]);

    expect(onHover).toHaveBeenCalledWith(2);
  });

  it("calls onHover with null when mouse leaves a list item", () => {
    const onHover = vi.fn();
    render(<Legend {...defaultProps} onHover={onHover} />);

    const listItems = screen.getAllByRole("listitem");
    fireEvent.mouseLeave(listItems[0]);

    expect(onHover).toHaveBeenCalledWith(null);
  });

  it("highlights the hovered ball in the list", () => {
    render(<Legend {...defaultProps} hoveredBallId={2} />);

    const listItems = screen.getAllByRole("listitem") as HTMLElement[];

    // The second item (id=2) should have highlight styles (box-shadow with its color)
    expect(listItems[1].style.boxShadow).toBe(
      `0 0 0 2px ${mockBalls[1].color}`
    );

    // Other items should not have box-shadow highlight
    expect(listItems[0].style.boxShadow).toBe("none");
  });

  describe("remove button", () => {
    it("renders a remove button for each ball", () => {
      render(<Legend {...defaultProps} />);

      const removeButtons = screen.getAllByRole("button", { name: "🗑️" });
      expect(removeButtons).toHaveLength(3);
    });

    it("calls onRemove with ball id when remove button is clicked", () => {
      const onRemove = vi.fn();
      render(<Legend {...defaultProps} onRemove={onRemove} />);

      const removeButtons = screen.getAllByRole("button", { name: "🗑️" });
      fireEvent.click(removeButtons[1]);

      expect(onRemove).toHaveBeenCalledWith(2);
    });

    it("calls onRemove only once per click", () => {
      const onRemove = vi.fn();
      render(<Legend {...defaultProps} onRemove={onRemove} />);

      const removeButtons = screen.getAllByRole("button", { name: "🗑️" });
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
        />
      );

      const removeButtons = screen.getAllByRole("button", { name: "🗑️" });
      fireEvent.click(removeButtons[0]);

      expect(onRemove).toHaveBeenCalled();
      expect(onToggleVisibility).not.toHaveBeenCalled();
    });

    it("has cursor-pointer class on remove button", () => {
      render(<Legend {...defaultProps} />);

      const removeButtons = screen.getAllByRole("button", { name: "🗑️" });
      removeButtons.forEach((button) => {
        expect(button.className).toContain("cursor-pointer");
      });
    });
  });

  describe("visibility toggle", () => {
    it("calls onToggleVisibility with ball id when list item is clicked", () => {
      const onToggleVisibility = vi.fn();
      render(
        <Legend {...defaultProps} onToggleVisibility={onToggleVisibility} />
      );

      const listItems = screen.getAllByRole("listitem");
      fireEvent.click(listItems[1]);

      expect(onToggleVisibility).toHaveBeenCalledWith(2);
    });

    it("shows grayed out style for hidden balls", () => {
      const hiddenBallIds = new Set([2]);
      render(<Legend {...defaultProps} hiddenBallIds={hiddenBallIds} />);

      const listItems = screen.getAllByRole("listitem") as HTMLElement[];

      // Hidden ball (id=2) should have reduced opacity
      expect(listItems[1].style.opacity).toBe("0.4");

      // Visible balls should have full opacity
      expect(listItems[0].style.opacity).toBe("1");
      expect(listItems[2].style.opacity).toBe("1");
    });

    it("applies grayscale filter to hidden ball color indicator", () => {
      const hiddenBallIds = new Set([1]);
      render(<Legend {...defaultProps} hiddenBallIds={hiddenBallIds} />);

      const listItems = screen.getAllByRole("listitem");
      const hiddenColorIndicator = listItems[0].querySelector(
        "span"
      ) as HTMLElement;
      const visibleColorIndicator = listItems[1].querySelector(
        "span"
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
