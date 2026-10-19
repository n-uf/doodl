/**
 * Tests for CanvasPool
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CanvasPool } from "../canvas-pool";

// Mock document.createElement for canvas
const createMockCanvas = (): HTMLCanvasElement => {
  const ctx = {
    clearRect: vi.fn(),
  };
  const canvas = {
    width: 0,
    height: 0,
    style: {} as CSSStyleDeclaration,
    getContext: vi.fn(() => ctx),
  } as unknown as HTMLCanvasElement;
  return canvas;
};

describe("CanvasPool", () => {
  let pool: CanvasPool;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    // Store original createElement inside beforeEach where document is available
    originalCreateElement = document.createElement.bind(document);

    // Mock createElement for canvas
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "canvas") {
        return createMockCanvas();
      }
      return originalCreateElement(tag);
    });

    pool = new CanvasPool({
      maxSize: 5,
      staleTimeout: 1000,
      pruneInterval: 500,
    });
  });

  afterEach(() => {
    pool.destroy();
    vi.restoreAllMocks();
  });

  describe("acquire", () => {
    test("should create new canvas when pool is empty", () => {
      const canvas = pool.acquire(100, 100);
      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(100);
      expect(canvas.height).toBe(100);
    });

    test("should reuse canvas with matching dimensions", () => {
      const canvas1 = pool.acquire(100, 100);
      pool.release(canvas1);

      const canvas2 = pool.acquire(100, 100);
      expect(canvas2).toBe(canvas1);
    });

    test("should resize unused canvas when dimensions differ", () => {
      const canvas1 = pool.acquire(100, 100);
      pool.release(canvas1);

      const canvas2 = pool.acquire(200, 200);
      expect(canvas2).toBe(canvas1);
      expect(canvas2.width).toBe(200);
      expect(canvas2.height).toBe(200);
    });

    test("should create new canvas when all are in use", () => {
      const canvas1 = pool.acquire(100, 100);
      const canvas2 = pool.acquire(100, 100);

      expect(canvas1).not.toBe(canvas2);
    });

    test("should not exceed max size in pool", () => {
      const canvases: HTMLCanvasElement[] = [];
      for (let i = 0; i < 7; i++) {
        canvases.push(pool.acquire(100, 100));
      }

      // Release all
      canvases.forEach((c) => pool.release(c));

      // Check pool stats
      const stats = pool.getStats();
      expect(stats.total).toBeLessThanOrEqual(5);
    });
  });

  describe("release", () => {
    test("should mark canvas as available", () => {
      const canvas = pool.acquire(100, 100);
      pool.release(canvas);

      const stats = pool.getStats();
      expect(stats.available).toBe(1);
      expect(stats.inUse).toBe(0);
    });

    test("should clear canvas content on release", () => {
      const canvas = pool.acquire(100, 100);
      const ctx = canvas.getContext("2d");

      pool.release(canvas);

      expect(ctx?.clearRect).toHaveBeenCalled();
    });

    test("should handle releasing non-pooled canvas", () => {
      const externalCanvas = createMockCanvas();
      expect(() => pool.release(externalCanvas)).not.toThrow();
    });
  });

  describe("getStats", () => {
    test("should return correct counts", () => {
      pool.acquire(100, 100);
      pool.acquire(200, 200);
      const canvas3 = pool.acquire(300, 300);
      pool.release(canvas3);

      const stats = pool.getStats();
      expect(stats.total).toBe(3);
      expect(stats.inUse).toBe(2);
      expect(stats.available).toBe(1);
    });
  });

  describe("setMaxSize", () => {
    test("should update max size", () => {
      pool.setMaxSize(3);
      expect(pool.getMaxSize()).toBe(3);
    });

    test("should prune excess unused canvases", () => {
      // Fill pool
      const canvases: HTMLCanvasElement[] = [];
      for (let i = 0; i < 5; i++) {
        canvases.push(pool.acquire(100, 100));
      }
      canvases.forEach((c) => pool.release(c));

      // Reduce max size
      pool.setMaxSize(2);

      const stats = pool.getStats();
      expect(stats.total).toBeLessThanOrEqual(2);
    });
  });

  describe("clear", () => {
    test("should remove all canvases", () => {
      pool.acquire(100, 100);
      pool.acquire(200, 200);
      pool.clear();

      const stats = pool.getStats();
      expect(stats.total).toBe(0);
    });
  });

  describe("prune", () => {
    test("should remove stale unused canvases", async () => {
      const pool = new CanvasPool({
        staleTimeout: 50,
        pruneInterval: 10000, // Disable auto-prune
      });

      const canvas = pool.acquire(100, 100);
      pool.release(canvas);

      // Wait for stale timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      pool.prune();

      const stats = pool.getStats();
      expect(stats.total).toBe(0);

      pool.destroy();
    });

    test("should not remove in-use canvases", async () => {
      const pool = new CanvasPool({
        staleTimeout: 50,
        pruneInterval: 10000,
      });

      pool.acquire(100, 100);

      await new Promise((resolve) => setTimeout(resolve, 100));

      pool.prune();

      const stats = pool.getStats();
      expect(stats.total).toBe(1);
      expect(stats.inUse).toBe(1);

      pool.destroy();
    });
  });
});
