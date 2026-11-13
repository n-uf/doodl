import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __testOnly,
  findTextInTextLayer,
  type FindTextOptions,
} from "../text-bounds-finder";

const { collectMatchSegments, mergeAdjacentBounds } = __testOnly;

// =============================================================================
// Fake DOM text layer (node env, no jsdom)
// =============================================================================

interface FakeSpanSpec {
  text: string;
  left: number;
  top?: number;
  width: number;
  height?: number;
}

const LINE_H = 20;

/** One span per string, laid out left to right on one line with a fixed gap. */
function lineSpans(
  texts: string[],
  { gap = 0, height = LINE_H, top = 0, left = 0 } = {},
): FakeSpanSpec[] {
  const charW = height / 2;
  let x = left;
  return texts.map((text) => {
    const spec = { text, left: x, top, width: text.length * charW, height };
    x += spec.width + gap;
    return spec;
  });
}

function rectOf(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
  };
}

function makeLayer(specs: FakeSpanSpec[]): HTMLElement {
  const nodes = specs.map((s) => {
    const span = {
      nodeType: 1,
      getBoundingClientRect: () =>
        rectOf(s.left, s.top ?? 0, s.width, s.height ?? LINE_H),
    };
    return { textContent: s.text, parentNode: span };
  });
  let i = 0;
  const layer = {
    getBoundingClientRect: () => rectOf(0, 0, 1000, 1000),
    __reset: () => {
      i = 0;
    },
    __next: () => nodes[i++] ?? null,
  };
  return layer as unknown as HTMLElement;
}

beforeEach(() => {
  vi.stubGlobal("Node", { ELEMENT_NODE: 1 });
  vi.stubGlobal("NodeFilter", { SHOW_TEXT: 4 });
  vi.stubGlobal("document", {
    createTreeWalker: (root: {
      __reset: () => void;
      __next: () => unknown;
    }) => {
      root.__reset();
      return { nextNode: () => root.__next() };
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const OPTS: FindTextOptions = { scale: 1 };

/** Single-span layer: the whole text on one line. */
function oneSpan(text: string): HTMLElement {
  return makeLayer(lineSpans([text]));
}

// =============================================================================
// Baseline (behaviour that must not change) and gap threshold
// =============================================================================

describe("findTextInTextLayer: plain ASCII baseline", () => {
  it("finds every case-insensitive occurrence with proportional bounds", () => {
    const layer = oneSpan("The cat sat. The Cat.");
    const matches = findTextInTextLayer("the", layer, OPTS);
    expect(matches.map((m) => [m.text, m.startIndex, m.endIndex])).toEqual([
      ["The", 0, 3],
      ["The", 13, 16],
    ]);
    // 21 chars over a 210px span, 10px per char
    expect(matches[1]!.bounds).toEqual([
      { x: 130, y: 0, width: 30, height: LINE_H },
    ]);
  });

  it("honours ignoreCase=false", () => {
    const layer = oneSpan("The cat sat. The Cat.");
    const matches = findTextInTextLayer("Cat", layer, {
      ...OPTS,
      ignoreCase: false,
    });
    expect(matches.map((m) => m.startIndex)).toEqual([17]);
  });

  it("substring mode is the default and finds inside words", () => {
    const layer = oneSpan("STANDARD");
    expect(findTextInTextLayer("AND", layer, OPTS)).toHaveLength(1);
    expect(
      findTextInTextLayer("AND", layer, { ...OPTS, matchMode: "word" }),
    ).toHaveLength(0);
  });

  it("returns [] for empty query, zero scale and empty layer", () => {
    expect(findTextInTextLayer("", oneSpan("abc"), OPTS)).toEqual([]);
    expect(findTextInTextLayer("a", oneSpan("abc"), { scale: 0 })).toEqual([]);
    expect(findTextInTextLayer("a", makeLayer([]), OPTS)).toEqual([]);
  });
});

describe("findTextInTextLayer: gap threshold is relative to span height", () => {
  it("joins spans with a small gap (font-subset split)", () => {
    // height 20 -> threshold 3px; a 2px gap is no word break
    const layer = makeLayer(lineSpans(["foo", "bar"], { gap: 2 }));
    expect(findTextInTextLayer("foobar", layer, OPTS)).toHaveLength(1);
    expect(findTextInTextLayer("foo bar", layer, OPTS)).toHaveLength(0);
  });

  it("inserts a space for a gap over 0.15 of the height", () => {
    const layer = makeLayer(lineSpans(["foo", "bar"], { gap: 4 }));
    expect(findTextInTextLayer("foobar", layer, OPTS)).toHaveLength(0);
    expect(findTextInTextLayer("foo bar", layer, OPTS)).toHaveLength(1);
  });

  it("gives the same answer at 1x and 3x zoom", () => {
    // same layout, scaled: gap 4 at height 20 vs gap 12 at height 60
    const small = makeLayer(lineSpans(["foo", "bar"], { gap: 4 }));
    const big = makeLayer(
      lineSpans(["foo", "bar"], { gap: 12, height: 60 }),
    );
    expect(findTextInTextLayer("foo bar", small, OPTS)).toHaveLength(1);
    expect(findTextInTextLayer("foo bar", big, OPTS)).toHaveLength(1);

    // a 4px gap at 3x zoom (height 60) is small relative to the font
    const bigTight = makeLayer(
      lineSpans(["foo", "bar"], { gap: 4, height: 60 }),
    );
    expect(findTextInTextLayer("foobar", bigTight, OPTS)).toHaveLength(1);
  });
});

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
