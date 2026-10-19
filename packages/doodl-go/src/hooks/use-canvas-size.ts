"use client";

import { useEffect, useState, type RefObject } from "react";

export interface CanvasSize {
  width: number;
  height: number;
}

export function useCanvasSize(
  containerRef: RefObject<HTMLElement | null>,
  initialSize: CanvasSize = { width: 800, height: 560 }
): CanvasSize {
  const [size, setSize] = useState<CanvasSize>(initialSize);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = (): void => {
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width > 0 && height > 0) {
        setSize({ width, height });
      }
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    updateSize();

    return () => observer.disconnect();
  }, [containerRef]);

  return size;
}
