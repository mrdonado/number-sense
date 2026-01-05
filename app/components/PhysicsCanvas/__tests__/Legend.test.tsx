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

  it("renders nothing when there are no balls", () => {
    const { container } = render(
      <Legend balls={[]} hoveredBallId={null} onHover={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all balls in the list", () => {
    render(<Legend balls={mockBalls} hoveredBallId={null} onHover={vi.fn()} />);

    expect(screen.getByText("Red Ball")).toBeInTheDocument();
    expect(screen.getByText("Blue Ball")).toBeInTheDocument();
    expect(screen.getByText("Green Ball")).toBeInTheDocument();
  });

  it("displays color indicators for each ball", () => {
    render(<Legend balls={mockBalls} hoveredBallId={null} onHover={vi.fn()} />);

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
    render(<Legend balls={mockBalls} hoveredBallId={null} onHover={onHover} />);

    const listItems = screen.getAllByRole("listitem");
    fireEvent.mouseEnter(listItems[1]);

    expect(onHover).toHaveBeenCalledWith(2);
  });

  it("calls onHover with null when mouse leaves a list item", () => {
    const onHover = vi.fn();
    render(<Legend balls={mockBalls} hoveredBallId={null} onHover={onHover} />);

    const listItems = screen.getAllByRole("listitem");
    fireEvent.mouseLeave(listItems[0]);

    expect(onHover).toHaveBeenCalledWith(null);
  });

  it("highlights the hovered ball in the list", () => {
    render(<Legend balls={mockBalls} hoveredBallId={2} onHover={vi.fn()} />);

    const listItems = screen.getAllByRole("listitem") as HTMLElement[];

    // The second item (id=2) should have highlight styles (box-shadow with its color)
    expect(listItems[1].style.boxShadow).toBe(
      `0 0 0 2px ${mockBalls[1].color}`
    );

    // Other items should not have box-shadow highlight
    expect(listItems[0].style.boxShadow).toBe("none");
  });
});
