/**
 * Tests for SpatialIndex
 */

import { describe, test, expect, beforeEach } from "vitest";
import { SpatialIndex } from "../spatial-index";

interface TestItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const getBounds = (item: TestItem) => ({
  x: item.x,
  y: item.y,
  width: item.width,
  height: item.height,
});

describe("SpatialIndex", () => {
  let index: SpatialIndex<TestItem>;

  beforeEach(() => {
    index = new SpatialIndex<TestItem>(getBounds, { cellSize: 100 });
  });

  describe("upsert", () => {
    test("should add an item to the index", () => {
      const item: TestItem = { id: "1", x: 50, y: 50, width: 20, height: 20 };
      index.upsert(item);
      expect(index.size).toBe(1);
      expect(index.has("1")).toBe(true);
    });

    test("should update an existing item", () => {
      const item1: TestItem = { id: "1", x: 50, y: 50, width: 20, height: 20 };
      const item2: TestItem = { id: "1", x: 150, y: 150, width: 20, height: 20 };
      index.upsert(item1);
      index.upsert(item2);
      expect(index.size).toBe(1);
      expect(index.get("1")).toEqual(item2);
    });

    test("should place items in correct cells", () => {
      const item1: TestItem = { id: "1", x: 50, y: 50, width: 20, height: 20 };
      const item2: TestItem = { id: "2", x: 150, y: 150, width: 20, height: 20 };
      index.upsert(item1);
      index.upsert(item2);
      
      // Item in cell (0,0)
      const results1 = index.queryPoint({ x: 50, y: 50 });
      expect(results1.find(r => r.id === "1")).toBeDefined();
      expect(results1.find(r => r.id === "2")).toBeUndefined();
      
      // Item in cell (1,1)
      const results2 = index.queryPoint({ x: 150, y: 150 });
      expect(results2.find(r => r.id === "2")).toBeDefined();
      expect(results2.find(r => r.id === "1")).toBeUndefined();
    });
  });

  describe("remove", () => {
    test("should remove an item from the index", () => {
      const item: TestItem = { id: "1", x: 50, y: 50, width: 20, height: 20 };
      index.upsert(item);
      index.remove("1");
      expect(index.size).toBe(0);
      expect(index.has("1")).toBe(false);
    });

    test("should handle removing non-existent item", () => {
      expect(() => index.remove("non-existent")).not.toThrow();
    });
  });

  describe("queryPoint", () => {
    test("should return items at point", () => {
      const item1: TestItem = { id: "1", x: 10, y: 10, width: 80, height: 80 };
      const item2: TestItem = { id: "2", x: 200, y: 200, width: 50, height: 50 };
      index.upsert(item1);
      index.upsert(item2);

      const results = index.queryPoint({ x: 50, y: 50 });
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe("1");
    });

    test("should return empty array for empty areas", () => {
      const item: TestItem = { id: "1", x: 0, y: 0, width: 50, height: 50 };
      index.upsert(item);

      const results = index.queryPoint({ x: 500, y: 500 });
      expect(results).toEqual([]);
    });

    test("should return multiple items in same cell", () => {
      const item1: TestItem = { id: "1", x: 10, y: 10, width: 20, height: 20 };
      const item2: TestItem = { id: "2", x: 40, y: 40, width: 20, height: 20 };
      index.upsert(item1);
      index.upsert(item2);

      const results = index.queryPoint({ x: 30, y: 30 });
      expect(results.length).toBe(2);
    });
  });

  describe("queryRect", () => {
    test("should return items intersecting rectangle", () => {
      const item1: TestItem = { id: "1", x: 10, y: 10, width: 50, height: 50 };
      const item2: TestItem = { id: "2", x: 150, y: 150, width: 50, height: 50 };
      const item3: TestItem = { id: "3", x: 300, y: 300, width: 50, height: 50 };
      index.upsert(item1);
      index.upsert(item2);
      index.upsert(item3);

      const results = index.queryRect({ x: 0, y: 0, width: 200, height: 200 });
      expect(results.length).toBe(2);
      expect(results.find(r => r.id === "1")).toBeDefined();
      expect(results.find(r => r.id === "2")).toBeDefined();
    });

    test("should not return duplicate items", () => {
      // Large item spanning multiple cells
      const item: TestItem = { id: "1", x: 0, y: 0, width: 250, height: 250 };
      index.upsert(item);

      const results = index.queryRect({ x: 0, y: 0, width: 300, height: 300 });
      expect(results.length).toBe(1);
    });
  });

  describe("rebuild", () => {
    test("should rebuild index from items array", () => {
      const items: TestItem[] = [
        { id: "1", x: 10, y: 10, width: 20, height: 20 },
        { id: "2", x: 110, y: 110, width: 20, height: 20 },
      ];
      
      index.upsert({ id: "old", x: 50, y: 50, width: 10, height: 10 });
      index.rebuild(items);
      
      expect(index.size).toBe(2);
      expect(index.has("old")).toBe(false);
      expect(index.has("1")).toBe(true);
      expect(index.has("2")).toBe(true);
    });

    test("should reset update count", () => {
      for (let i = 0; i < 10; i++) {
        index.upsert({ id: String(i), x: i * 10, y: i * 10, width: 5, height: 5 });
      }
      expect(index.getUpdateCount()).toBe(10);
      
      index.rebuild([]);
      expect(index.getUpdateCount()).toBe(0);
    });
  });

  describe("shouldRebuild", () => {
    test("should return true after many updates", () => {
      const index = new SpatialIndex<TestItem>(getBounds, {
        rebuildThreshold: 5,
      });

      for (let i = 0; i < 5; i++) {
        index.upsert({ id: String(i), x: i * 10, y: 0, width: 5, height: 5 });
      }

      expect(index.shouldRebuild()).toBe(true);
    });

    test("should return false below threshold", () => {
      const index = new SpatialIndex<TestItem>(getBounds, {
        rebuildThreshold: 10,
      });

      for (let i = 0; i < 5; i++) {
        index.upsert({ id: String(i), x: i * 10, y: 0, width: 5, height: 5 });
      }

      expect(index.shouldRebuild()).toBe(false);
    });
  });

  describe("clear", () => {
    test("should remove all items", () => {
      index.upsert({ id: "1", x: 0, y: 0, width: 10, height: 10 });
      index.upsert({ id: "2", x: 100, y: 100, width: 10, height: 10 });
      index.clear();
      
      expect(index.size).toBe(0);
      expect(index.getCellCount()).toBe(0);
    });
  });

  describe("getAll", () => {
    test("should return all items", () => {
      const items: TestItem[] = [
        { id: "1", x: 0, y: 0, width: 10, height: 10 },
        { id: "2", x: 100, y: 100, width: 10, height: 10 },
      ];
      items.forEach(item => index.upsert(item));
      
      const all = index.getAll();
      expect(all.length).toBe(2);
      expect(all.find(i => i.id === "1")).toBeDefined();
      expect(all.find(i => i.id === "2")).toBeDefined();
    });
  });
});

