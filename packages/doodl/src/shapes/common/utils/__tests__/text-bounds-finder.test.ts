import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __testOnly,
  findTextInTextLayer,
  findTextInTextLayerDetailed,
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

// =============================================================================
// Normalisation
// =============================================================================

const { normalizeWithMap, normalizeQuery } = __testOnly;

/** [text, startIndex, endIndex] of every match. */
function spans(query: string, layerText: string, opts: Partial<FindTextOptions> = {}) {
  return findTextInTextLayer(query, oneSpan(layerText), {
    ...OPTS,
    ...opts,
  }).map((m) => [m.text, m.startIndex, m.endIndex] as const);
}

describe("normalizeWithMap", () => {
  it("drops soft hyphen and zero-width chars and keeps the map exact", () => {
    const n = normalizeWithMap("a­ b", true);
    expect(n.text).toBe("a b");
    expect(n.origStart).toEqual([0, 2, 3]);
    expect(n.origEnd).toEqual([1, 3, 4]);

    expect(normalizeWithMap("x​‌‍﻿y", true).text).toBe("xy");
  });

  it("collapses whitespace runs into one space spanning the run", () => {
    const n = normalizeWithMap("a  \n\tb", true);
    expect(n.text).toBe("a b");
    expect(n.origStart).toEqual([0, 1, 5]);
    expect(n.origEnd).toEqual([1, 5, 6]);
  });

  it("expands ligatures but maps every unit to the whole ligature", () => {
    const n = normalizeWithMap("aﬁb", true);
    expect(n.text).toBe("afib");
    expect(n.origStart).toEqual([0, 1, 1, 2]);
    expect(n.origEnd).toEqual([1, 2, 2, 3]);
  });

  it("composes NFD into NFC and keeps both forms equal", () => {
    expect(normalizeWithMap("é", true).text).toBe("é");
    expect(normalizeWithMap("é", true).text).toBe("é");
    const n = normalizeWithMap("éx", true);
    expect(n.origStart).toEqual([0, 2]);
    expect(n.origEnd).toEqual([2, 3]);
  });

  it("folds case through the same map (U+0130 expands to two units)", () => {
    const n = normalizeWithMap("İx", true);
    expect(n.text.length).toBe(3);
    expect(n.origStart).toEqual([0, 0, 1]);
    expect(n.origEnd).toEqual([1, 1, 2]);
  });

  it("keeps case when ignoreCase is false", () => {
    expect(normalizeWithMap("AbC", false).text).toBe("AbC");
  });
});

describe("normalizeQuery", () => {
  it("trims and collapses", () => {
    expect(normalizeQuery("  John \n Smith  ", true)).toBe("john smith");
  });
  it("is empty for whitespace and ignorable-only queries", () => {
    expect(normalizeQuery("  \n", true)).toBe("");
    expect(normalizeQuery("​­", true)).toBe("");
  });
});

describe("findTextInTextLayer: normalised matching", () => {
  it("matches a no-break space against a plain space", () => {
    expect(spans("John Smith", "John Smith")).toEqual([
      ["John Smith", 0, 10],
    ]);
  });

  it("matches the other way round (NBSP in the query)", () => {
    expect(spans("John Smith", "John Smith")).toEqual([
      ["John Smith", 0, 10],
    ]);
  });

  it("matches a double space in the layer with a single space", () => {
    expect(spans("john smith", "John  Smith")).toEqual([
      ["John  Smith", 0, 11],
    ]);
  });

  it("matches a newline in the layer text and in the query", () => {
    expect(spans("John Smith", "John\nSmith")).toHaveLength(1);
    expect(spans("John\nSmith", "John Smith")).toHaveLength(1);
    expect(spans("John \n Smith", "John Smith")).toHaveLength(1);
  });

  it("trims the query (trailing space, newline)", () => {
    expect(spans("Smith ", "John Smith.")).toEqual([["Smith", 5, 10]]);
    expect(spans("Smith\n", "John Smith.")).toEqual([["Smith", 5, 10]]);
    expect(spans(" John", "John Smith.")).toEqual([["John", 0, 4]]);
  });

  it("returns nothing for a whitespace-only query", () => {
    expect(spans("  \n ", "John Smith")).toEqual([]);
  });

  it("matches a ligature in the layer against its letters", () => {
    expect(spans("define", "deﬁne")).toEqual([["deﬁne", 0, 5]]);
    expect(spans("deﬁne", "define")).toEqual([["define", 0, 6]]);
  });

  it("keeps ligature match bounds on the original characters", () => {
    // "x ﬁ y": the ligature is one original char at index 2
    expect(spans("fi", "x ﬁ y")).toEqual([["ﬁ", 2, 3]]);
  });

  it("treats NFD and NFC spellings as equal", () => {
    expect(spans("José", "José")).toEqual([["José", 0, 5]]);
    expect(spans("José", "José")).toEqual([["José", 0, 4]]);
  });

  it("does not strip accents", () => {
    expect(spans("Jose", "José")).toEqual([]);
  });

  it("ignores a soft hyphen inside a word", () => {
    expect(spans("international", "inter­national")).toEqual([
      ["inter­national", 0, 14],
    ]);
  });

  it("ignores zero-width characters inside a word", () => {
    expect(spans("Whitman", "Whit​man")).toEqual([
      ["Whit​man", 0, 8],
    ]);
    expect(spans("Whit‍man", "Whitman")).toHaveLength(1);
  });

  it("does not drift indices after U+0130 (length-changing lowercase)", () => {
    expect(spans("İx", "İx İx")).toEqual([
      ["İx", 0, 2],
      ["İx", 3, 5],
    ]);
    // a query after the expanding char lands on the right original index
    expect(spans("x", "İx")).toEqual([["x", 1, 2]]);
  });

  it("folds Greek final sigma both ways (οδος vs ΟΔΟΣ)", () => {
    expect(spans("οδος", "ΟΔΟΣ")).toEqual([["ΟΔΟΣ", 0, 4]]);
    expect(spans("ΟΔΟΣ", "οδος")).toEqual([["οδος", 0, 4]]);
    expect(spans("οδοσ", "οδος")).toHaveLength(1);
    expect(spans("οδος", "οδος", { ignoreCase: false })).toHaveLength(1);
    expect(spans("οδος", "ΟΔΟΣ", { ignoreCase: false })).toHaveLength(0);
  });

  it("keeps the match rect exact across a collapsed run", () => {
    const [match] = findTextInTextLayer("a b", oneSpan("a   b"), OPTS);
    // 5 original chars at 10px each, whole run covered
    expect(match!.bounds).toEqual([{ x: 0, y: 0, width: 50, height: LINE_H }]);
  });

  it("matches across spans through synthetic separators", () => {
    const layer = makeLayer(lineSpans(["foo", "bar"], { gap: 6 }));
    expect(findTextInTextLayer("FOO  BAR", layer, OPTS)).toHaveLength(1);
  });

  it("is case-sensitive only on request", () => {
    expect(spans("JOHN", "john")).toHaveLength(1);
    expect(spans("JOHN", "john", { ignoreCase: false })).toHaveLength(0);
    expect(spans("John", "John Smith", { ignoreCase: false })).toHaveLength(1);
  });
});

// =============================================================================
// Overlaps
// =============================================================================

describe("findTextInTextLayer: overlapping occurrences merge into one match", () => {
  it("covers all of 'aaaa' for 'aa' with one match", () => {
    expect(spans("aa", "aaaa")).toEqual([["aaaa", 0, 4]]);
  });

  it("covers 'aaa' for 'aa' and 'ababa' for 'aba'", () => {
    expect(spans("aa", "aaa")).toEqual([["aaa", 0, 3]]);
    expect(spans("aba", "ababa")).toEqual([["ababa", 0, 5]]);
  });

  it("does not drop trailing chars: '1212' in '121212' covers 0..6", () => {
    expect(spans("1212", "121212")).toEqual([["121212", 0, 6]]);
    expect(spans("1212", "1212 1212")).toEqual([
      ["1212", 0, 4],
      ["1212", 5, 9],
    ]);
  });

  it("recomputes bounds for the merged range", () => {
    const [m] = findTextInTextLayer("1212", oneSpan("121212"), OPTS);
    expect(m!.bounds).toEqual([{ x: 0, y: 0, width: 60, height: LINE_H }]);
  });

  it("merges chains of overlaps, and keeps later separate matches", () => {
    expect(spans("aa", "aaaa b aaa")).toEqual([
      ["aaaa", 0, 4],
      ["aaa", 7, 10],
    ]);
  });

  it("reports one match when a ligature yields the same chars twice", () => {
    // "f" matches the first and second unit of the single char U+FB03
    expect(spans("f", "\uFB03")).toEqual([["\uFB03", 0, 1]]);
  });

  it("counts a merged run once against maxMatches", () => {
    const r = findTextInTextLayerDetailed("aa", oneSpan("aaaa b aa"), {
      ...OPTS,
      maxMatches: 2,
    });
    expect(r.matches).toHaveLength(2);
    expect(r.truncated).toBe(false);
  });

  it("still finds adjacent and separated repeats", () => {
    expect(spans("ab", "ababxab")).toEqual([
      ["ab", 0, 2],
      ["ab", 2, 4],
      ["ab", 5, 7],
    ]);
  });

  it("does not overlap across normalised characters", () => {
    // "ﬁﬁ" is "fifi": query "fi" matches each ligature once
    expect(spans("fi", "ﬁﬁ")).toEqual([
      ["ﬁ", 0, 1],
      ["ﬁ", 1, 2],
    ]);
  });
});

// =============================================================================
// Truncation
// =============================================================================

describe("findTextInTextLayerDetailed: truncation", () => {
  const many = (n: number) => oneSpan("ab ".repeat(n));

  it("reports truncated when matches exceed maxMatches", () => {
    const r = findTextInTextLayerDetailed("ab", many(5), {
      ...OPTS,
      maxMatches: 3,
    });
    expect(r.matches).toHaveLength(3);
    expect(r.truncated).toBe(true);
    // the plain function returns the same capped list
    expect(findTextInTextLayer("ab", many(5), { ...OPTS, maxMatches: 3 })).toEqual(
      r.matches,
    );
  });

  it("is not truncated when matches equal maxMatches exactly", () => {
    const r = findTextInTextLayerDetailed("ab", many(3), {
      ...OPTS,
      maxMatches: 3,
    });
    expect(r.matches).toHaveLength(3);
    expect(r.truncated).toBe(false);
  });

  it("is not truncated below the cap", () => {
    const r = findTextInTextLayerDetailed("ab", many(2), {
      ...OPTS,
      maxMatches: 3,
    });
    expect(r).toMatchObject({ truncated: false });
    expect(r.matches).toHaveLength(2);
  });

  it("keeps the default cap of 50", () => {
    const r = findTextInTextLayerDetailed("ab", many(51), OPTS);
    expect(r.matches).toHaveLength(50);
    expect(r.truncated).toBe(true);
    expect(
      findTextInTextLayerDetailed("ab", many(50), OPTS).truncated,
    ).toBe(false);
  });

  it("ignores word-mode rejects when deciding truncation", () => {
    // 2 whole-word hits then only embedded ones: cap 2 is not exceeded
    const layer = oneSpan("ab ab abab xabx");
    const r = findTextInTextLayerDetailed("ab", layer, {
      ...OPTS,
      matchMode: "word",
      maxMatches: 2,
    });
    expect(r.matches).toHaveLength(2);
    expect(r.truncated).toBe(false);
  });

  it("returns an empty, untruncated result for empty queries", () => {
    expect(findTextInTextLayerDetailed("", many(2), OPTS)).toEqual({
      matches: [],
      truncated: false,
    });
  });
});

// =============================================================================
// Word mode
// =============================================================================

const WORD: Partial<FindTextOptions> = { matchMode: "word" };

describe("findTextInTextLayer: word mode with Unicode boundaries", () => {
  it("rejects a longer ASCII word, accepts the whole word", () => {
    expect(spans("Whitman", "Whitman and Whitmanson", WORD)).toEqual([
      ["Whitman", 0, 7],
    ]);
    expect(spans("Whitman", "Whitman and Whitmanson")).toHaveLength(2);
  });

  it("does not match a prefix of an accented word", () => {
    expect(spans("Whit", "Whitéman", WORD)).toEqual([]);
    expect(spans("Whit", "Whitéman")).toHaveLength(1); // substring default
  });

  it("does not match inside a word with a decomposed accent", () => {
    expect(spans("Whit", "Whitéman", WORD)).toEqual([]);
  });

  it("handles Cyrillic words", () => {
    expect(spans("Иван", "Иван Иванов", WORD))
      .toEqual([["Иван", 0, 4]]);
    expect(
      spans("Иван", "Иван Иванов"),
    ).toHaveLength(2);
  });

  it("treats digits and underscore as word characters", () => {
    expect(spans("abc", "abc1 abc_ abc", WORD)).toEqual([["abc", 10, 13]]);
  });

  it("treats punctuation and the text edges as boundaries", () => {
    expect(spans("abc", "(abc), abc.", WORD)).toHaveLength(2);
    expect(spans("abc", "abc", WORD)).toHaveLength(1);
  });

  it("recognises astral letters as word characters", () => {
    // U+10400 DESERET CAPITAL LETTER LONG I: a letter outside the BMP
    expect(spans("b", "b𐐀", WORD)).toEqual([]);
    expect(spans("b", "𐐀b", WORD)).toEqual([]);
    expect(spans("b", "𐐀 b", WORD)).toHaveLength(1);
  });
});

describe("isWordBoundary", () => {
  const { isWordBoundary } = __testOnly;
  it("is true for undefined, space and punctuation, false for letters and digits in any script", () => {
    for (const c of [undefined, " ", ".", "-", "(", "—"]) {
      expect(isWordBoundary(c)).toBe(true);
    }
    for (const c of ["a", "Z", "7", "_", "é", "И", "中", "́"]) {
      expect(isWordBoundary(c)).toBe(false);
    }
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
