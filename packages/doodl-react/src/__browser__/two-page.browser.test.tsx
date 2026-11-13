/**
 * Two-page repro of today's per-page-engine behaviour (page-aware rework, S0).
 *
 * Every PDF page builds its own complete drawing engine, so with two pages
 * mounted selection, history and the keyboard are per page, not per document.
 * A1-A5 state what a document-level engine must do; they are written with
 * `it.fails` because today's code does the opposite. When the rework lands
 * (S3/S4) the `.fails` markers come off and these become ordinary tests.
 *
 * Input is real pointer and keyboard input through Vitest browser's
 * `userEvent` (Playwright). Assertions go through the public API: the
 * controller getters and the layers' `onShapesChange` notifications.
 */

import { userEvent } from "@vitest/browser/context";
import type { DrawShape } from "@n-uf/doodl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mountTwoPageFixture,
  type MountedFixture,
  type PageNumber,
} from "./two-page-fixture";

interface Point {
  x: number;
  y: number;
}

interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Vitest's userEvent forwards the options to Playwright, whose `position` and
// `sourcePosition`/`targetPosition` are offsets inside the element. The
// public types of these options are empty, hence the casts. Vitest rescales
// the position objects it is given in place (iframe scale), so every call must
// pass fresh copies, never the shared constants below.
type PositionedClick = Parameters<typeof userEvent.click>[1] & {
  position: Point;
};
type PositionedDrag = Parameters<typeof userEvent.dragAndDrop>[2] & {
  sourcePosition: Point;
  targetPosition: Point;
};

const fixture: { current: MountedFixture | null } = { current: null };

function fx(): MountedFixture {
  if (!fixture.current) throw new Error("fixture is not mounted");
  return fixture.current;
}

/** Let React effects and pending canvas work settle. */
const settle = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 30));

/** Drag with the current tool on one page, in page units (scale 1). */
async function drag(page: PageNumber, from: Point, to: Point): Promise<void> {
  const canvas = fx().canvas(page);
  await userEvent.dragAndDrop(canvas, canvas, {
    sourcePosition: { x: from.x, y: from.y },
    targetPosition: { x: to.x, y: to.y },
  } as PositionedDrag);
  await settle();
}

async function click(page: PageNumber, at: Point): Promise<void> {
  await userEvent.click(fx().canvas(page), {
    position: { x: at.x, y: at.y },
  } as PositionedClick);
  await settle();
}

/** Draw a rect with the rect tool; the engine selects the new mark. */
async function drawRect(
  page: PageNumber,
  from: Point,
  to: Point,
): Promise<void> {
  await drag(page, from, to);
}

async function pressDelete(): Promise<void> {
  await userEvent.keyboard("{Delete}");
  await settle();
}

async function pressUndo(): Promise<void> {
  await userEvent.keyboard("{Control>}z{/Control}");
  await settle();
}

const shapesOf = (page: PageNumber): DrawShape[] =>
  fx().controller(page).getShapes();
const selectedOf = (page: PageNumber): string[] =>
  fx().controller(page).getSelectedIds();
const rectOf = (page: PageNumber): RectLike =>
  shapesOf(page)[0] as unknown as RectLike;

const RECT_1 = { from: { x: 30, y: 30 }, to: { x: 130, y: 100 } };
const RECT_2 = { from: { x: 50, y: 60 }, to: { x: 200, y: 150 } };
const inside = (r: { from: Point; to: Point }): Point => ({
  x: (r.from.x + r.to.x) / 2,
  y: (r.from.y + r.to.y) / 2,
});

beforeEach(async () => {
  fixture.current = await mountTwoPageFixture({ scale: 1, tool: "rect" });
});

afterEach(() => {
  fixture.current?.unmount();
  fixture.current = null;
});

describe("harness sanity (must pass today)", () => {
  it("draws a rect on page 1 in page units and leaves page 2 empty", async () => {
    await drawRect(1, RECT_1.from, RECT_1.to);

    expect(shapesOf(1)).toHaveLength(1);
    expect(shapesOf(2)).toHaveLength(0);
    const rect = rectOf(1);
    expect(rect.x).toBeCloseTo(30, 0);
    expect(rect.y).toBeCloseTo(30, 0);
    expect(rect.width).toBeCloseTo(100, 0);
    expect(rect.height).toBeCloseTo(70, 0);
    // the host hears about it through onShapesChange
    const last = fx()
      .log.filter((e) => e.kind === "shapes" && e.page === 1)
      .at(-1);
    expect(last?.value).toHaveLength(1);
  });

  it("draws on the page that was dragged, not the other one", async () => {
    await drawRect(2, RECT_2.from, RECT_2.to);

    expect(shapesOf(1)).toHaveLength(0);
    expect(shapesOf(2)).toHaveLength(1);
  });

  it("selects a mark by click and moves it by a drag with the select tool", async () => {
    await drawRect(1, RECT_1.from, RECT_1.to);
    await fx().update({ tool: "select" });
    await click(2, { x: 10, y: 10 }); // empty paper: clears nothing on page 1 yet
    await click(1, inside(RECT_1));
    expect(selectedOf(1)).toHaveLength(1);

    const before = { ...rectOf(1) };
    const mid = inside(RECT_1);
    await drag(1, mid, { x: mid.x + 50, y: mid.y + 20 });

    expect(shapesOf(1)).toHaveLength(1);
    expect(rectOf(1).x).toBeCloseTo(before.x + 50, 0);
    expect(rectOf(1).y).toBeCloseTo(before.y + 20, 0);
  });

  it("Delete on a single page removes the selected mark", async () => {
    await drawRect(1, RECT_1.from, RECT_1.to);
    await pressDelete();

    expect(shapesOf(1)).toHaveLength(0);
  });

  it("Ctrl+Z on a single page undoes the one step", async () => {
    await drawRect(1, RECT_1.from, RECT_1.to);
    await pressUndo();

    expect(shapesOf(1)).toHaveLength(0);
  });
});

describe("two pages mounted: today's per-page-engine bugs", () => {
  // A1: selection is per page engine, so both marks stay selected.
  it.fails("A1: drawing a rect on each page leaves exactly one mark selected", async () => {
    await drawRect(1, RECT_1.from, RECT_1.to);
    await drawRect(2, RECT_2.from, RECT_2.to);

    expect(shapesOf(1)).toHaveLength(1);
    expect(shapesOf(2)).toHaveLength(1);
    expect(selectedOf(1)).toEqual([]);
    expect(selectedOf(1).length + selectedOf(2).length).toBe(1);
  });

  // A2: every engine listens to Delete on window.
  it.fails("A2: Delete with the page 2 mark selected removes only that mark", async () => {
    await drawRect(1, RECT_1.from, RECT_1.to);
    await drawRect(2, RECT_2.from, RECT_2.to);
    await fx().update({ tool: "select" });
    await click(2, inside(RECT_2));
    expect(selectedOf(2)).toHaveLength(1);

    await pressDelete();

    expect(shapesOf(2)).toHaveLength(0);
    expect(shapesOf(1)).toHaveLength(1);
  });

  // A3: every engine has its own history and listens to Ctrl+Z on window.
  it.fails("A3: one Ctrl+Z undoes one step, not one per page", async () => {
    await drawRect(1, RECT_1.from, RECT_1.to);
    await drawRect(2, RECT_2.from, RECT_2.to);

    await pressUndo();

    // the latest step (the page 2 rect) is undone; the page 1 rect stays
    expect(shapesOf(2)).toHaveLength(0);
    expect(shapesOf(1)).toHaveLength(1);
  });

  // A4: a scale change re-attaches the engine (new Doodl instance), which
  // drops its history and its selection.
  it.fails("A4: a scale (zoom) change keeps undo history and selection", async () => {
    await drawRect(1, RECT_1.from, RECT_1.to);
    expect(fx().controller(1).canUndo()).toBe(true);
    expect(selectedOf(1)).toHaveLength(1);

    await fx().update({ scale: 1.5 });

    expect(shapesOf(1)).toHaveLength(1);
    expect(fx().controller(1).canUndo()).toBe(true);
    expect(selectedOf(1)).toHaveLength(1);
  });

  // A5: a move is not a history step, so undo pops the draw step instead.
  it.fails("A5: a move then Ctrl+Z moves the mark back instead of removing it", async () => {
    await drawRect(1, RECT_1.from, RECT_1.to);
    await fx().update({ tool: "select" });
    const original = { ...rectOf(1) };
    const mid = inside(RECT_1);
    await drag(1, mid, { x: mid.x + 50, y: mid.y + 20 });
    expect(rectOf(1).x).toBeCloseTo(original.x + 50, 0);

    await pressUndo();

    expect(shapesOf(1)).toHaveLength(1);
    expect(rectOf(1).x).toBeCloseTo(original.x, 0);
    expect(rectOf(1).y).toBeCloseTo(original.y, 0);
  });
});
