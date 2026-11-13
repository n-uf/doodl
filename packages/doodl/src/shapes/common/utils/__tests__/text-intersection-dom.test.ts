// @vitest-environment jsdom
//
// extractTextFromBounds on a fake text layer: jsdom has no layout, so every
// character box comes from a real PDF.js capture (see
// scripts/capture-text-fixtures.mjs) through a stubbed Range.getBoundingClientRect.

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { Bounds } from "../../../../types/geometry";
import { extractTextFromBounds } from "../text-intersection";
import registeredAddress from "./fixtures/registered-address.json";
import softwareDevelopment from "./fixtures/software-development.json";

interface Fixture {
  chars: { c: string; r: number[]; n: number }[];
}

/** Layer origin on the "screen", and the canvas scale used by the tests. */
const LAYER = { left: 100, top: 50 };
const SCALE = 2;

type Box = { left: number; top: number; right: number; bottom: number };
const boxes = new WeakMap<Text, Box[]>();

const rangeProto = Range.prototype as { getBoundingClientRect?: unknown };
let savedGetBoundingClientRect: unknown;

afterAll(() => {
  rangeProto.getBoundingClientRect = savedGetBoundingClientRect;
});

beforeAll(() => {
  savedGetBoundingClientRect = rangeProto.getBoundingClientRect;
  // Union of the stubbed boxes of the characters the range covers.
  (Range.prototype as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect =
    function (this: Range): DOMRect {
      const node = this.startContainer as Text;
      const list = boxes.get(node) ?? [];
      const slice = list.slice(this.startOffset, this.endOffset);
      if (slice.length === 0) return new DOMRect(0, 0, 0, 0);
      const left = Math.min(...slice.map((b) => b.left));
      const top = Math.min(...slice.map((b) => b.top));
      const right = Math.max(...slice.map((b) => b.right));
      const bottom = Math.max(...slice.map((b) => b.bottom));
      return new DOMRect(left, top, right - left, bottom - top);
    };
});

afterEach(() => {
  document.body.innerHTML = "";
});

/** A text layer with one span per fixture text node, boxes placed at LAYER + box * 1 (layer pixels). */
function buildLayer(fixture: Fixture): HTMLElement {
  const layer = document.createElement("div");
  layer.getBoundingClientRect = () =>
    new DOMRect(LAYER.left, LAYER.top, 800, 1000);
  document.body.appendChild(layer);

  const byNode = new Map<number, { c: string; r: number[] }[]>();
  for (const ch of fixture.chars) {
    const list = byNode.get(ch.n) ?? [];
    list.push(ch);
    byNode.set(ch.n, list);
  }
  for (const [, list] of [...byNode.entries()].sort((a, b) => a[0] - b[0])) {
    const span = document.createElement("span");
    const text = document.createTextNode(list.map((ch) => ch.c).join(""));
    span.appendChild(text);
    layer.appendChild(span);
    boxes.set(
      text,
      list.map(({ r }) => {
        const [l = 0, t = 0, rt = 0, b = 0] = r;
        return {
          left: LAYER.left + l,
          top: LAYER.top + t,
          right: LAYER.left + rt,
          bottom: LAYER.top + b,
        };
      })
    );
  }
  return layer;
}

/** Canvas-space bounds (what a shape stores) for a mark between two layer-pixel x values on the line. */
function canvasBounds(fixture: Fixture, fromText: string, toText: string): Bounds {
  const full = fixture.chars.map((c) => c.c).join("");
  const start = full.indexOf(fromText);
  const end = full.indexOf(toText, start) + toText.length - 1;
  const a = fixture.chars[start]!.r;
  const b = fixture.chars[end]!.r;
  const left = (a[0]! + a[2]!) / 2;
  const right = (b[0]! + b[2]!) / 2;
  const top = a[1]!;
  const bottom = a[3]!;
  // The shape lives in canvas space: screen = canvas * SCALE + layer origin.
  return {
    x: left / SCALE,
    y: top / SCALE,
    width: (right - left) / SCALE,
    height: (bottom - top) / SCALE,
  };
}

describe("extractTextFromBounds", () => {
  it("default is character-precise: a mark starting mid-word cuts the word", () => {
    const layer = buildLayer(registeredAddress);
    const bounds = canvasBounds(registeredAddress, "ered Address: 575 Lex", "ered Address: 575 Lex");

    expect(extractTextFromBounds(layer, bounds, SCALE)).toBe("ered Address: 575 Lex");
    expect(extractTextFromBounds(layer, bounds, SCALE, { x: 0, y: 0 })).toBe("ered Address: 575 Lex");
    expect(extractTextFromBounds(layer, bounds, SCALE, { x: 0, y: 0 }, {})).toBe(
      "ered Address: 575 Lex"
    );
    expect(extractTextFromBounds(layer, bounds, SCALE, { x: 0, y: 0 }, { snap: "char" })).toBe(
      "ered Address: 575 Lex"
    );
  });

  it('snap "word" keeps whole words only: the "ered" tail of "Registered" and the "Lex" head of "Lexington" are under half', () => {
    const layer = buildLayer(registeredAddress);
    const bounds = canvasBounds(registeredAddress, "ered Address: 575 Lex", "ered Address: 575 Lex");
    expect(
      extractTextFromBounds(layer, bounds, SCALE, { x: 0, y: 0 }, { snap: "word" })
    ).toBe("Address: 575");

    const wider = canvasBounds(registeredAddress, "ered Address: 575 Lexing", "ered Address: 575 Lexing");
    expect(
      extractTextFromBounds(layer, wider, SCALE, { x: 0, y: 0 }, { snap: "word" })
    ).toBe("Address: 575 Lexington");
  });

  it('snap "word" takes "SOFTWARE" whole from a mark starting at "FTWARE"', () => {
    const layer = buildLayer(softwareDevelopment);
    const bounds = canvasBounds(softwareDevelopment, "FTWARE DEVELOPMENT", "FTWARE DEVELOPMENT");

    expect(extractTextFromBounds(layer, bounds, SCALE)).toBe("FTWARE DEVELOPMENT");
    expect(extractTextFromBounds(layer, bounds, SCALE, { x: 0, y: 0 }, { snap: "word" })).toBe(
      "SOFTWARE DEVELOPMENT"
    );
  });

  it('snap "word" returns "" over empty space, like the default', () => {
    const layer = buildLayer(softwareDevelopment);
    const away: Bounds = { x: 600, y: 600, width: 20, height: 20 };

    expect(extractTextFromBounds(layer, away, SCALE)).toBe("");
    expect(extractTextFromBounds(layer, away, SCALE, { x: 0, y: 0 }, { snap: "word" })).toBe("");
  });
});
