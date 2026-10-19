import { describe, expect, it } from "vitest";

import { __testOnly } from "../text-bounds-finder";

const { collectMatchSegments, mergeAdjacentBounds } = __testOnly;

describe("collectMatchSegments", () => {
  it("collapses contiguous chars in one text node", () => {
    const node = { textContent: "SUSLOV" } as unknown as Text;
    const positions = Array.from({ length: 6 }, (_, i) => ({
      textNode: node,
      charIndex: i,
      synthetic: false as const,
    }));

    const segments = collectMatchSegments(positions, 0, 4); // "SUSL"
    expect(segments).toEqual([
      { textNode: node, startChar: 0, endChar: 4 },
    ]);
  });

  it("skips synthetic separators and splits segments", () => {
    const left = { textContent: "FOO" } as unknown as Text;
    const right = { textContent: "BAR" } as unknown as Text;
    const positions = [
      { textNode: left, charIndex: 0, synthetic: false as const },
      { textNode: left, charIndex: 1, synthetic: false as const },
      { textNode: left, charIndex: 2, synthetic: false as const },
      { textNode: null, charIndex: -1, synthetic: true as const },
      { textNode: right, charIndex: 0, synthetic: false as const },
      { textNode: right, charIndex: 1, synthetic: false as const },
      { textNode: right, charIndex: 2, synthetic: false as const },
    ];

    // Match spanning "O BAR" indices 2..6 (exclusive end 7) — synthetic in middle
    const segments = collectMatchSegments(positions, 2, 7);
    expect(segments).toEqual([
      { textNode: left, startChar: 2, endChar: 3 },
      { textNode: right, startChar: 0, endChar: 3 },
    ]);
  });

  it("handles font-subset splits without synthetic gap", () => {
    const a = { textContent: "SUS" } as unknown as Text;
    const b = { textContent: "LOV" } as unknown as Text;
    const positions = [
      { textNode: a, charIndex: 0, synthetic: false as const },
      { textNode: a, charIndex: 1, synthetic: false as const },
      { textNode: a, charIndex: 2, synthetic: false as const },
      { textNode: b, charIndex: 0, synthetic: false as const },
      { textNode: b, charIndex: 1, synthetic: false as const },
      { textNode: b, charIndex: 2, synthetic: false as const },
    ];

    const segments = collectMatchSegments(positions, 0, 4); // "SUSL"
    expect(segments).toEqual([
      { textNode: a, startChar: 0, endChar: 3 },
      { textNode: b, startChar: 0, endChar: 1 },
    ]);
  });
});

describe("mergeAdjacentBounds", () => {
  it("merges same-line adjacent rects", () => {
    const merged = mergeAdjacentBounds([
      { x: 10, y: 20, width: 30, height: 12 },
      { x: 40, y: 21, width: 20, height: 11 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ x: 10, y: 20, width: 50 });
  });

  it("keeps separate lines distinct", () => {
    const merged = mergeAdjacentBounds([
      { x: 10, y: 20, width: 30, height: 12 },
      { x: 10, y: 40, width: 30, height: 12 },
    ]);
    expect(merged).toHaveLength(2);
  });
});
