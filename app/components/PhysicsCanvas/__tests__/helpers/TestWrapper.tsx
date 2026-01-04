import { useRef, useEffect } from "react";
import PhysicsCanvas from "../../index";
import type { PhysicsCanvasHandle } from "../../types";

interface TestWrapperProps {
  onRef: (ref: PhysicsCanvasHandle | null) => void;
}

export function TestWrapper({ onRef }: TestWrapperProps) {
  const ref = useRef<PhysicsCanvasHandle>(null);

  useEffect(() => {
    onRef(ref.current);
  }, [onRef]);

  return <PhysicsCanvas ref={ref} />;
}
