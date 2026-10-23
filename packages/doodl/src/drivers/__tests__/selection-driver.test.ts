// @vitest-environment jsdom
/**
 * Tests for SelectionDriver rect extraction: plain HTML text vs PDF.js text
 * layers (span validation).
 *
 * jsdom has no layout, so text geometry is faked: every text node is laid
 * out on one line at a known position (CHAR_W px per character), and element
 * boxes are stubbed per element.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Bounds } from "../../types";
import { SelectionDriver, type SelectionDriverOptions } from "../selection-driver";
import { isPositionedTextLayer } from "../utils";

const CHAR_W = 8;
const LINE_H = 20;

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

/** Fake line position of each text node */
const textLayout = new Map<Node, { left: number; top: number }>();
/** What range.getClientRects() returns for ranges spanning several nodes */
let multiNodeRangeRects: DOMRect[] = [];

function layoutText(node: Node, left: number, top: number): void {
  textLayout.set(node, { left, top });
}

function stubBox(el: Element, box: DOMRect): void {
  el.getBoundingClientRect = () => box;
}

const originalGetClientRects = Range.prototype.getClientRects;

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
  Range.prototype.getClientRects = function (this: Range) {
    const node = this.startContainer;
    if (node === this.endContainer && node.nodeType === Node.TEXT_NODE) {
      const pos = textLayout.get(node);
      if (!pos || this.endOffset <= this.startOffset) return [] as unknown as DOMRectList;
      return [
        rect(
          pos.left + this.startOffset * CHAR_W,
          pos.top,
          (this.endOffset - this.startOffset) * CHAR_W,
          LINE_H,
        ),
      ] as unknown as DOMRectList;
    }
    return multiNodeRangeRects as unknown as DOMRectList;
  };
});

afterEach(() => {
  Range.prototype.getClientRects = originalGetClientRects;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  textLayout.clear();
  multiNodeRangeRects = [];
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = "";
});

interface Harness {
  container: HTMLElement;
  onSelectionEnd: ReturnType<typeof vi.fn<(rects: Bounds[], text: string) => void>>;
  onSelectionCancel: ReturnType<typeof vi.fn<() => void>>;
  select(range: Range, fromY: number, toY: number): void;
}

function setup(html: string, options: SelectionDriverOptions = {}): Harness {
  document.body.innerHTML = `<canvas></canvas><div id="text">${html}</div>`;
  const canvas = document.querySelector("canvas")!;
  const container = document.getElementById("text")!;
  stubBox(container, rect(0, 0, 600, 400));

  const onSelectionEnd = vi.fn<(rects: Bounds[], text: string) => void>();
  const onSelectionCancel = vi.fn<() => void>();
  const driver = new SelectionDriver(
    canvas,
    container,
    { onSelectionEnd, onSelectionCancel },
    options,
  );
  driver.enable();

  return {
    container,
    onSelectionEnd,
    onSelectionCancel,
    select(range, fromY, toY) {
      container.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, clientY: fromY }),
      );
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
      document.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, clientY: toY }),
      );
    },
  };
}

// =============================================================================
// PLAIN HTML
// =============================================================================

describe("SelectionDriver on plain HTML text", () => {
  const html =
    "<p>Hello <span>plain</span> world</p>\n<p>Second paragraph</p>";

  function layoutParagraphs(container: HTMLElement) {
    const [p1, p2] = Array.from(container.querySelectorAll("p"));
    const hello = p1!.firstChild!; // "Hello "
    const plain = p1!.querySelector("span")!.firstChild!; // "plain"
    const world = p1!.lastChild!; // " world"
    const second = p2!.firstChild!; // "Second paragraph"
    layoutText(hello, 10, 10);
    layoutText(plain, 10 + 6 * CHAR_W, 10);
    layoutText(world, 10 + 11 * CHAR_W, 10);
    layoutText(second, 10, 50);
    stubBox(p1!.querySelector("span")!, rect(10 + 6 * CHAR_W, 10, 5 * CHAR_W, LINE_H));
    return { hello, second };
  }

  test("accepts the selected text lines, merged per line, in page coordinates", () => {
    const h = setup(html);
    const { hello, second } = layoutParagraphs(h.container);
    // Element border boxes the browser adds for fully selected elements
    // must not leak into the highlight
    multiNodeRangeRects = [rect(0, 0, 600, 40)];

    const range = document.createRange();
    range.setStart(hello, 0);
    range.setEnd(second, 6); // "Second"
    h.select(range, 15, 55);

    expect(h.onSelectionCancel).not.toHaveBeenCalled();
    expect(h.onSelectionEnd).toHaveBeenCalledTimes(1);
    const [rects, text] = h.onSelectionEnd.mock.calls[0]!;
    expect(text).toContain("Hello plain world");
    expect(text).toContain("Second");
    expect(rects).toEqual([
      { x: 10, y: 10, width: 17 * CHAR_W, height: LINE_H },
      { x: 10, y: 50, width: 6 * CHAR_W, height: LINE_H },
    ]);
  });

  test("divides by the layer scale", () => {
    const h = setup(html, { scale: 2 });
    const { hello } = layoutParagraphs(h.container);

    const range = document.createRange();
    range.setStart(hello, 0);
    range.setEnd(hello, 5); // "Hello"
    h.select(range, 15, 15);

    const [rects] = h.onSelectionEnd.mock.calls[0]!;
    expect(rects).toEqual([{ x: 5, y: 5, width: (5 * CHAR_W) / 2, height: LINE_H / 2 }]);
  });

  test("clips rects to the container", () => {
    const h = setup(html);
    const { second } = layoutParagraphs(h.container);
    stubBox(h.container, rect(0, 0, 50, 400));

    const range = document.createRange();
    range.setStart(second, 0);
    range.setEnd(second, 16); // whole line, 128px wide
    h.select(range, 55, 55);

    const [rects] = h.onSelectionEnd.mock.calls[0]!;
    expect(rects).toEqual([{ x: 10, y: 50, width: 40, height: LINE_H }]);
  });

  test("keeps lines a triple-click selects beyond the drag", () => {
    const h = setup(html);
    const { hello, second } = layoutParagraphs(h.container);

    const range = document.createRange();
    range.setStart(hello, 0);
    range.setEnd(second, 16);
    h.select(range, 15, 15); // no vertical drag

    const [rects] = h.onSelectionEnd.mock.calls[0]!;
    expect(rects).toHaveLength(2);
  });

  test("cancels a selection outside the container", () => {
    const h = setup(html);
    document.body.insertAdjacentHTML("beforeend", "<p id='outside'>elsewhere</p>");
    const outside = document.getElementById("outside")!.firstChild!;
    layoutText(outside, 10, 500);

    const range = document.createRange();
    range.setStart(outside, 0);
    range.setEnd(outside, 9);
    h.select(range, 505, 505);

    expect(h.onSelectionEnd).not.toHaveBeenCalled();
    expect(h.onSelectionCancel).toHaveBeenCalledTimes(1);
  });

  test("validateAgainstSpans: true keeps the span-validated path", () => {
    const h = setup(html, { validateAgainstSpans: true });
    const { hello } = layoutParagraphs(h.container);
    // "Hello" overlaps no span: the PDF filter rejects it
    multiNodeRangeRects = [];
    const range = document.createRange();
    range.setStart(hello, 0);
    range.setEnd(hello, 5);
    h.select(range, 15, 15);

    expect(h.onSelectionEnd).not.toHaveBeenCalled();
    expect(h.onSelectionCancel).toHaveBeenCalledTimes(1);
  });

  test("does not log", () => {
    const log = vi.spyOn(console, "log");
    const h = setup(html);
    const { hello } = layoutParagraphs(h.container);
    const range = document.createRange();
    range.setStart(hello, 0);
    range.setEnd(hello, 5);
    h.select(range, 15, 15);

    expect(h.onSelectionEnd).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });
});

// =============================================================================
// PDF.JS TEXT LAYER
// =============================================================================

describe("SelectionDriver on a PDF.js text layer", () => {
  const html =
    '<span style="position:absolute">Developer:</span>' +
    '<span style="position:absolute">Jane</span>';

  function setupTextLayer(options: SelectionDriverOptions = {}) {
    const h = setup(html, options);
    h.container.classList.add("textLayer");
    const [s1, s2] = Array.from(h.container.querySelectorAll("span"));
    stubBox(s1!, rect(10, 100, 80, LINE_H));
    stubBox(s2!, rect(10, 124, 32, LINE_H));
    return { ...h, s1: s1!, s2: s2! };
  }

  test("drops phantom rects that start off the text spans", () => {
    const h = setupTextLayer();
    multiNodeRangeRects = [
      rect(10, 100, 80, LINE_H), // on "Developer:"
      rect(10, 124, 32, LINE_H), // on "Jane"
      rect(200, 60, 100, LINE_H), // phantom in the blank zone
    ];

    const range = document.createRange();
    range.setStart(h.s1.firstChild!, 0);
    range.setEnd(h.s2.firstChild!, 4);
    h.select(range, 60, 140);

    const [rects] = h.onSelectionEnd.mock.calls[0]!;
    expect(rects).toEqual([
      { x: 10, y: 100, width: 80, height: LINE_H },
      { x: 10, y: 124, width: 32, height: LINE_H },
    ]);
  });

  test("drops rects below where the drag stopped", () => {
    const h = setupTextLayer();
    multiNodeRangeRects = [
      rect(10, 100, 80, LINE_H),
      rect(10, 124, 32, LINE_H), // greedy selection snapped to the next line
    ];

    const range = document.createRange();
    range.setStart(h.s1.firstChild!, 0);
    range.setEnd(h.s2.firstChild!, 4);
    h.select(range, 105, 105);

    const [rects] = h.onSelectionEnd.mock.calls[0]!;
    expect(rects).toEqual([{ x: 10, y: 100, width: 80, height: LINE_H }]);
  });

  test("validateAgainstSpans: false uses the text-node path", () => {
    const h = setupTextLayer({ validateAgainstSpans: false });
    layoutText(h.s1.firstChild!, 10, 100);
    multiNodeRangeRects = [rect(200, 60, 100, LINE_H)];

    const range = document.createRange();
    range.setStart(h.s1.firstChild!, 0);
    range.setEnd(h.s1.firstChild!, 10);
    h.select(range, 105, 105);

    const [rects] = h.onSelectionEnd.mock.calls[0]!;
    expect(rects).toEqual([{ x: 10, y: 100, width: 10 * CHAR_W, height: LINE_H }]);
  });
});

// =============================================================================
// TEXT LAYER DETECTION
// =============================================================================

describe("isPositionedTextLayer", () => {
  function container(html: string, className = ""): HTMLElement {
    const el = document.createElement("div");
    el.className = className;
    el.innerHTML = html;
    document.body.appendChild(el);
    return el;
  }

  test("recognises PDF.js / react-pdf text layer classes", () => {
    expect(isPositionedTextLayer(container("", "textLayer"))).toBe(true);
    expect(
      isPositionedTextLayer(container("", "react-pdf__Page__textContent")),
    ).toBe(true);
  });

  test("recognises absolutely positioned text spans", () => {
    expect(
      isPositionedTextLayer(
        container('<span> </span><span style="position:absolute">text</span>'),
      ),
    ).toBe(true);
  });

  test("treats ordinary HTML as plain text", () => {
    expect(isPositionedTextLayer(container("<p>just text</p>"))).toBe(false);
    expect(
      isPositionedTextLayer(container("<p>an <span>inline</span> span</p>")),
    ).toBe(false);
  });
});
