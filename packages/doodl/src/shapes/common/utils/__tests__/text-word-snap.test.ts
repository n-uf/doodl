import { describe, expect, it } from "vitest";

import type { Bounds } from "../../../../types/geometry";
import { __testOnly } from "../text-intersection";
import jonathanWhitman from "./fixtures/jonathan-whitman.json";
import registeredAddress from "./fixtures/registered-address.json";
import softwareDevelopment from "./fixtures/software-development.json";

const { snapToWords, selectWordCandidates } = __testOnly;

interface Char {
  char: string;
  rect: Bounds;
  node: unknown;
}

interface Fixture {
  chars: { c: string; r: number[]; n: number }[];
}

/** Real per-character boxes of one PDF.js text-layer line (see scripts/capture-text-fixtures.mjs). */
function fromFixture(fixture: Fixture): Char[] {
  return fixture.chars.map(({ c, r, n }) => {
    const [left = 0, top = 0, right = 0, bottom = 0] = r;
    return {
      char: c,
      rect: { x: left, y: top, width: right - left, height: bottom - top },
      node: `span-${n}`,
    };
  });
}

/**
 * A synthetic line: every character 10 wide and 20 tall, starting at (x, y).
 * `parts` are the text spans of the line, laid out one after another; a part
 * given as `{ text, gap }` is moved right by `gap` first.
 */
function line(
  parts: (string | { text: string; gap: number })[],
  y = 0,
  x = 0,
  id = ""
): Char[] {
  const out: Char[] = [];
  let cursor = x;
  parts.forEach((part, index) => {
    const { text, gap } =
      typeof part === "string" ? { text: part, gap: 0 } : part;
    cursor += gap;
    for (const ch of text) {
      out.push({
        char: ch,
        rect: { x: cursor, y, width: 10, height: 20 },
        node: `part-${id}-${y}-${index}`,
      });
      cursor += 10;
    }
  });
  return out;
}

const fullText = (chars: Char[]): string => chars.map((c) => c.char).join("");

/**
 * A mark over the line of `chars` from the centre of the first character of
 * `from` to the centre of the last character of `to` (default: `from` alone),
 * the full height of the line. It reproduces what a character-precise
 * extraction would see: the characters whose centres are inside.
 */
function markOver(chars: Char[], from: string, to: string = from): Bounds {
  const text = fullText(chars);
  const start = text.indexOf(from);
  const end = text.indexOf(to, start) + to.length - 1;
  if (start < 0 || end < start) throw new Error(`"${from}".."${to}" not in "${text}"`);
  const first = chars[start]!.rect;
  const last = chars[end]!.rect;
  const left = first.x + first.width / 2;
  const right = last.x + last.width / 2;
  const top = Math.min(...chars.map((c) => c.rect.y));
  const bottom = Math.max(...chars.map((c) => c.rect.y + c.rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** The old rule: characters whose centre is inside the mark, trimmed. */
function charPrecise(chars: Char[], area: Bounds): string {
  return chars
    .filter((c) => {
      const cx = c.rect.x + c.rect.width / 2;
      const cy = c.rect.y + c.rect.height / 2;
      return (
        cx >= area.x &&
        cx <= area.x + area.width &&
        cy >= area.y &&
        cy <= area.y + area.height
      );
    })
    .map((c) => c.char)
    .join("")
    .trim();
}

describe("snapToWords: the harbuz cases (real PDF.js text layer)", () => {
  it('mark starting inside "Registered" drops that word, keeps the rest', () => {
    const chars = fromFixture(registeredAddress);
    const mark = markOver(chars, "ered Address: 575 Lexington");

    // The character-precise rule cut the first word: this is the bug.
    expect(charPrecise(chars, mark)).toBe("ered Address: 575 Lexington");
    // Only "ered" of "Registered" is inside: under half its width, so it is left out.
    expect(snapToWords(chars, mark)).toBe("Address: 575 Lexington");
  });

  it('mark starting inside "SOFTWARE" takes the whole word', () => {
    const chars = fromFixture(softwareDevelopment);
    const mark = markOver(chars, "FTWARE DEVELOPMENT");

    expect(charPrecise(chars, mark)).toBe("FTWARE DEVELOPMENT");
    expect(snapToWords(chars, mark)).toBe("SOFTWARE DEVELOPMENT");
  });

  it('mark starting at the ":" of "Executive:" drops it and trims the trailing comma', () => {
    const chars = fromFixture(jonathanWhitman);
    const mark = markOver(chars, ": Jonathan R. Whitman,");

    expect(charPrecise(chars, mark)).toBe(": Jonathan R. Whitman,");
    expect(snapToWords(chars, mark)).toBe("Jonathan R. Whitman");
  });

  it("a word with less than half inside is dropped even at the other edge", () => {
    const chars = fromFixture(jonathanWhitman);
    // "Wh" of "Whitman," is inside: far under half. "R." loses its dot at the edge.
    const mark = markOver(chars, "Jonathan R. Wh");

    expect(snapToWords(chars, mark)).toBe("Jonathan R");
  });

  it("takes a word once exactly half or more of it is inside", () => {
    // "abcdefghij" is x 0..100, "klmnopqrst" is x 110..210.
    const chars = line(["abcdefghij klmnopqrst"]);

    // The mark's left edge cuts "abcdefghij" in half: taken whole. "klmnopqrst" has 40% inside: left out.
    expect(snapToWords(chars, { x: 50, y: 0, width: 100, height: 20 })).toBe("abcdefghij");

    // One pixel less of "abcdefghij" inside (49%): it is left out, "klmnopqrst" (60%) is taken.
    expect(snapToWords(chars, { x: 51, y: 0, width: 119, height: 20 })).toBe("klmnopqrst");
  });
});

describe("snapToWords: a small mark inside one word", () => {
  it("returns that word instead of nothing", () => {
    const chars = fromFixture(registeredAddress);
    const text = fullText(chars);
    const x = chars[text.indexOf("Lexington") + 2]!.rect; // the "x"
    const tiny: Bounds = { x: x.x + x.width / 2 - 1, y: x.y + 5, width: 2, height: 6 };

    expect(charPrecise(chars, tiny)).toBe("x");
    expect(snapToWords(chars, tiny)).toBe("Lexington");
  });

  it("takes every word a small mark touches when it takes none whole", () => {
    // "abcde" is x 0..50, "fghij" x 60..110. The mark (47..63) holds 6% of each.
    const chars = line(["abcde fghij"]);
    expect(snapToWords(chars, { x: 47, y: 5, width: 16, height: 10 })).toBe("abcde fghij");
  });

  it("returns nothing for a mark over blank space or over no text", () => {
    const chars = line(["abc def"]); // "abc" 0..30, space 30..40, "def" 40..70
    expect(snapToWords(chars, { x: 31, y: 0, width: 8, height: 20 })).toBe("");
    expect(snapToWords(chars, { x: 200, y: 0, width: 50, height: 20 })).toBe("");
    expect(snapToWords(chars, { x: 0, y: 100, width: 70, height: 20 })).toBe("");
    expect(snapToWords([], { x: 0, y: 0, width: 10, height: 10 })).toBe("");
  });
});

describe("snapToWords: edge trimming", () => {
  const wide: Bounds = { x: -5, y: -5, width: 500, height: 40 };

  it("trims edge spaces and the punctuation : ; , . ! ?", () => {
    expect(snapToWords(line(["  Hello, world! "]), wide)).toBe("Hello, world");
    expect(snapToWords(line(["...what?!"]), wide)).toBe("what");
    expect(snapToWords(line([": a; b,"]), wide)).toBe("a; b");
  });

  it("trims dashes and bullets at the edges", () => {
    expect(snapToWords(line(["• Item one"]), wide)).toBe("Item one");
    expect(snapToWords(line(["— Item –"]), wide)).toBe("Item");
    expect(snapToWords(line(["- list entry -"]), wide)).toBe("list entry");
  });

  it("keeps brackets, quotes, currency and inner punctuation", () => {
    expect(snapToWords(line(["(see [1])."]), wide)).toBe("(see [1])");
    expect(snapToWords(line(['He said "go."']), wide)).toBe('He said "go."');
    expect(snapToWords(line(["$1,000.50;"]), wide)).toBe("$1,000.50");
    expect(snapToWords(line(["€12.5 and A-B, e.g. x"]), wide)).toBe(
      "€12.5 and A-B, e.g. x"
    );
    expect(snapToWords(line(["O'Brien’s"]), wide)).toBe("O'Brien’s");
  });

  it("returns an empty string when only punctuation is left", () => {
    expect(snapToWords(line([":;,.!? - •"]), wide)).toBe("");
  });
});

describe("snapToWords: words split across spans", () => {
  it("joins two spans with no gap into one word (taken whole)", () => {
    // "Reg" + "istered" touch: one word "Registered" (x 0..100); the mark starts at the "g".
    const chars = line(["Reg", "istered", " ", "Address"]);
    const mark = markOver(chars, "gistered Address");

    expect(charPrecise(chars, mark)).toBe("gistered Address");
    expect(snapToWords(chars, mark)).toBe("Registered Address");
  });

  it("keeps two spans apart when there is a visible gap", () => {
    // Same letters with a 12px (more than one character) hole between the spans.
    const chars = line(["Reg", { text: "istered", gap: 12 }, " ", "Address"]);
    const mark = markOver(chars, "gistered Address");

    // "Reg" has only "g" inside (under half): left out. "istered" is whole.
    expect(snapToWords(chars, mark)).toBe("istered Address");
  });

  it("does not join across a whitespace-only span", () => {
    const chars = line(["Hello", " ", "world"]);
    expect(snapToWords(chars, markOver(chars, "Hello", "world"))).toBe("Hello world");
  });

  it("joins an overlap of one pixel between spans (rounding)", () => {
    const left = line(["Soft"], 0, 0, "left");
    const right = line(["ware"], 0, 39, "right"); // starts 1px inside "Soft"
    const chars = [...left, ...right];
    expect(snapToWords(chars, { x: 20, y: 0, width: 60, height: 20 })).toBe("Software");
  });
});

describe("snapToWords: several lines", () => {
  it("reads top to bottom, left to right, whatever the DOM order", () => {
    const row1 = line(["alpha beta"], 0);
    const row2 = line(["gamma delta"], 20);
    const row3 = line(["epsilon"], 40);
    const shuffled = [...row3, ...row1.slice(6), ...row2, ...row1.slice(0, 6)];

    const mark: Bounds = { x: -5, y: -5, width: 400, height: 80 };
    expect(snapToWords(shuffled, mark)).toBe("alpha beta gamma delta epsilon");
  });

  it("takes only the lines the mark covers, snapping each", () => {
    const rows = [
      ...line(["first line here"], 0),
      ...line(["second line here"], 20),
      ...line(["third line here"], 40),
    ];
    // Rows 1 and 2 (the third row's centre is outside), from inside "line" (x 60..100 on row 1,
    // x 70..110 on row 2) to the end of both "here"s. "first" and "second" are left out.
    const mark: Bounds = { x: 65, y: 2, width: 100, height: 36 };
    expect(snapToWords(rows, mark)).toBe("line here line here");
  });

  it("joins the lines of a multi-line mark with a single space", () => {
    const rows = [...line(["one two"], 0), ...line(["three four"], 20)];
    expect(snapToWords(rows, { x: 0, y: 0, width: 200, height: 40 })).toBe(
      "one two three four"
    );
  });
});

describe("selectWordCandidates", () => {
  const node = (x: number, width: number, y = 0): { bounds: Bounds } => ({
    bounds: { x, y, width, height: 20 },
  });

  it("adds a neighbour that touches a chosen span, and its neighbours in turn", () => {
    const nodes = [node(0, 30), node(30, 30), node(60, 30), node(200, 30)];
    // The mark only touches the first node.
    expect(selectWordCandidates(nodes, { x: 5, y: 0, width: 10, height: 20 })).toEqual([0, 1, 2]);
  });

  it("does not cross a visible gap or jump to another line", () => {
    const nodes = [node(0, 30), node(45, 30), node(30, 30, 20)];
    expect(selectWordCandidates(nodes, { x: 5, y: 0, width: 10, height: 20 })).toEqual([0]);
  });

  it("selects nothing when the mark touches no span", () => {
    expect(selectWordCandidates([node(0, 30)], { x: 100, y: 0, width: 10, height: 20 })).toEqual([]);
  });
});
