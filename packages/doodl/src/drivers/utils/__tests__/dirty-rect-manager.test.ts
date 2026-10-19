/**
 * Tests for DirtyRectManager
 */

import { describe, test, expect, beforeEach } from "vitest";
import { DirtyRectManager, boundsIntersectsRegions } from "../dirty-rect-manager";

describe("DirtyRectManager", () => {
  let manager: DirtyRectManager;

  beforeEach(() => {
    manager = new DirtyRectManager();
    // Clear initial forceFullRedraw state so markDirty works
    manager.getDirtyRegions();
  });

  describe("markDirty", () => {
    test("should add a dirty region", () => {
      manager.markDirty({ x: 10, y: 20, width: 100, height: 50 });
      expect(manager.getDirtyRegionCount()).toBe(1);
    });

    test("should add padding to regions", () => {
      manager.markDirty({ x: 10, y: 20, width: 100, height: 50 }, 5);
      const regions = manager.getDirtyRegions();
      expect(regions[0]).toEqual({
        x: 5,
        y: 15,
        width: 110,
        height: 60,
      });
    });

    test("should not add regions when full redraw is forced", () => {
      manager.forceFullRedraw();
      manager.markDirty({ x: 10, y: 20, width: 100, height: 50 });
      expect(manager.getDirtyRegionCount()).toBe(0);
    });
  });

  describe("forceFullRedraw", () => {
    test("should return empty array from getDirtyRegions", () => {
      manager.markDirty({ x: 10, y: 20, width: 100, height: 50 });
      manager.forceFullRedraw();
      const regions = manager.getDirtyRegions();
      expect(regions).toEqual([]);
    });

    test("should reset full redraw flag after getDirtyRegions", () => {
      manager.forceFullRedraw();
      manager.getDirtyRegions(); // Consumes the force flag
      manager.markDirty({ x: 10, y: 20, width: 100, height: 50 });
      const regions = manager.getDirtyRegions();
      expect(regions.length).toBe(1);
    });
  });

  describe("getDirtyRegions", () => {
    test("should merge overlapping regions", () => {
      manager.markDirty({ x: 0, y: 0, width: 100, height: 100 }, 0);
      manager.markDirty({ x: 50, y: 50, width: 100, height: 100 }, 0);
      const regions = manager.getDirtyRegions();
      expect(regions.length).toBe(1);
      expect(regions[0]).toEqual({
        x: 0,
        y: 0,
        width: 150,
        height: 150,
      });
    });

    test("should keep separate regions that are far apart", () => {
      const manager = new DirtyRectManager({ proximityThreshold: 10 });
      manager.getDirtyRegions(); // Clear initial forceFullRedraw state
      manager.markDirty({ x: 0, y: 0, width: 50, height: 50 }, 0);
      manager.markDirty({ x: 200, y: 200, width: 50, height: 50 }, 0);
      const regions = manager.getDirtyRegions();
      expect(regions.length).toBe(2);
    });

    test("should reset regions after retrieval", () => {
      manager.markDirty({ x: 10, y: 20, width: 100, height: 50 });
      manager.getDirtyRegions();
      expect(manager.getDirtyRegionCount()).toBe(0);
    });

    test("should force full redraw after interval", () => {
      const manager = new DirtyRectManager({ fullRedrawInterval: 3 });
      manager.getDirtyRegions(); // Clear initial forceFullRedraw state
      
      // First call - returns regions (count=1)
      manager.markDirty({ x: 0, y: 0, width: 50, height: 50 }, 0);
      let regions = manager.getDirtyRegions();
      expect(regions.length).toBe(1);
      
      // Second call - still returns regions (count=2)
      manager.markDirty({ x: 0, y: 0, width: 50, height: 50 }, 0);
      regions = manager.getDirtyRegions();
      expect(regions.length).toBe(1);
      
      // Third call - forces full redraw (count=3 >= interval)
      manager.markDirty({ x: 0, y: 0, width: 50, height: 50 }, 0);
      regions = manager.getDirtyRegions();
      expect(regions).toEqual([]); // Empty = full redraw
    });
  });

  describe("hasDirtyRegions", () => {
    test("should return true when regions exist", () => {
      manager.markDirty({ x: 10, y: 20, width: 100, height: 50 });
      expect(manager.hasDirtyRegions()).toBe(true);
    });

    test("should return true when full redraw is pending", () => {
      manager.forceFullRedraw();
      expect(manager.hasDirtyRegions()).toBe(true);
    });

    test("should return false when no regions", () => {
      expect(manager.hasDirtyRegions()).toBe(false);
    });
  });

  describe("reset", () => {
    test("should clear all state", () => {
      manager.markDirty({ x: 10, y: 20, width: 100, height: 50 });
      manager.reset();
      expect(manager.getDirtyRegionCount()).toBe(0);
      expect(manager.isFullRedrawPending()).toBe(true);
    });
  });
});

describe("boundsIntersectsRegions", () => {
  test("should return true for intersecting bounds", () => {
    const bounds = { x: 50, y: 50, width: 100, height: 100 };
    const regions = [{ x: 0, y: 0, width: 100, height: 100 }];
    expect(boundsIntersectsRegions(bounds, regions)).toBe(true);
  });

  test("should return false for non-intersecting bounds", () => {
    const bounds = { x: 200, y: 200, width: 50, height: 50 };
    const regions = [{ x: 0, y: 0, width: 100, height: 100 }];
    expect(boundsIntersectsRegions(bounds, regions)).toBe(false);
  });

  test("should return false for empty regions", () => {
    const bounds = { x: 0, y: 0, width: 50, height: 50 };
    expect(boundsIntersectsRegions(bounds, [])).toBe(false);
  });

  test("should check all regions", () => {
    const bounds = { x: 50, y: 50, width: 10, height: 10 };
    const regions = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 45, y: 45, width: 20, height: 20 }, // This one intersects
    ];
    expect(boundsIntersectsRegions(bounds, regions)).toBe(true);
  });
});

