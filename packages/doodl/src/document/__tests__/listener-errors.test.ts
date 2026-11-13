import { describe, expect, it } from "vitest";
import { addMarks, fakeView, makeDoc, record, rect } from "./helpers";

describe("a throwing listener never drops the rest of a commit's events", () => {
  it("delivers every event, rethrows the first error once, keeps the state", () => {
    const { doc } = makeDoc();
    const events = record(doc, ["shapesChange", "change", "selectionChange", "historyChange"]);
    let secondShapesListenerRan = 0;
    doc.on("shapesChange", () => {
      throw new Error("first");
    });
    doc.on("shapesChange", () => {
      secondShapesListenerRan++;
    });
    doc.on("change", () => {
      throw new Error("second");
    });

    let thrown: unknown;
    try {
      doc.transact("Add", (b) => {
        b.add("1", rect("a"));
        b.add("2", rect("b"));
        b.select(["a"]);
      });
    } catch (e) {
      thrown = e;
    }
    expect((thrown as Error).message).toBe("first");
    // both pages' shapesChange reached the second listener, and the later events fired
    expect(secondShapesListenerRan).toBe(2);
    expect(events.count("shapesChange")).toBe(2);
    expect(events.count("change")).toBe(1);
    expect(events.count("selectionChange")).toBe(1);
    expect(events.count("historyChange")).toBe(1);
    // the commit is applied and the next one starts clean (no stale errors)
    expect(doc.getAllShapes()).toHaveLength(2);
    expect(doc.canUndo()).toBe(true);
  });

  it("a throwing selectionChange listener does not skip the activePageChange", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["2", rect("a2")]]);
    const events = record(doc, ["activePageChange"]);
    doc.on("selectionChange", () => {
      throw new Error("sel");
    });
    expect(() => doc.click({ kind: "shape", id: "a2" })).toThrow("sel");
    expect(events.count("activePageChange")).toBe(1);
    expect(doc.getSelection().ids).toEqual(["a2"]);
  });

  it("a throwing undo listener still emits historyChange and historyApplied", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("a")]]);
    const events = record(doc, ["historyChange", "historyApplied"]);
    doc.on("shapesChange", () => {
      throw new Error("boom");
    });
    expect(() => doc.undo()).toThrow("boom");
    expect(events.count("historyChange")).toBe(1);
    expect(events.count("historyApplied")).toBe(1);
  });
});

describe("selection events see views and the active page already updated", () => {
  it("invalidates views and updates the active page before selectionChange fires", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["2", rect("a2")]]);
    const v2 = fakeView();
    doc.attachView("2", v2);
    v2.invalidations = 0;
    let seenActive: string | null = null;
    let seenInvalidations = -1;
    doc.on("selectionChange", () => {
      seenActive = doc.activePageId;
      seenInvalidations = v2.invalidations;
    });
    doc.click({ kind: "shape", id: "a2" });
    expect(seenActive).toBe("2");
    expect(seenInvalidations).toBeGreaterThan(0);

    doc.setActivePage("1");
    doc.select(["a2"], { mode: "toggle" });
    doc.select(["a2"], { mode: "add" });
    expect(doc.activePageId).toBe("2");
  });
});

describe("per-page history mode", () => {
  it("emits historyChange when the active page changes", () => {
    const { doc } = makeDoc({ history: { mode: "per-page" } });
    addMarks(doc, [["1", rect("r1")]]);
    const events = record(doc, ["historyChange"]);
    doc.setActivePage("2");
    expect(events.count("historyChange")).toBe(1);
    const state = events.log[0]?.[1] as { canUndo: boolean };
    expect(state.canUndo).toBe(false);
    doc.setActivePage("1");
    expect((events.log[1]?.[1] as { canUndo: boolean }).canUndo).toBe(true);
  });

  it("document mode does not", () => {
    const { doc } = makeDoc();
    const events = record(doc, ["historyChange"]);
    doc.setActivePage("2");
    expect(events.count("historyChange")).toBe(0);
  });
});
