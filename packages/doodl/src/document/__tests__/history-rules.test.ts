import { describe, expect, it } from "vitest";
import type { RectShape } from "../../shapes/rect/types";
import { addMarks, ids, makeDoc, rect, record } from "./helpers";

const xOf = (doc: ReturnType<typeof makeDoc>["doc"], id: string) =>
  (doc.getShape(id) as RectShape).x;

describe("coalescing", () => {
  it("does not merge a nudge across a selection change", () => {
    const { doc, clock } = makeDoc();
    addMarks(doc, [["1", rect("a", 10)], ["1", rect("b", 40)]]);
    doc.select(["a"]);
    doc.command({ nudge: [1, 0] });
    clock.t += 50;
    doc.select(["b"]);
    doc.command({ nudge: [1, 0] });
    expect(doc.undoCount).toBe(4); // two adds, two nudges

    doc.undo();
    expect(xOf(doc, "b")).toBe(40);
    expect(xOf(doc, "a")).toBe(11);
    expect(doc.getSelection().ids).toEqual(["b"]);
    doc.undo();
    expect(xOf(doc, "a")).toBe(10);
  });

  it("merges again when the selection is the same", () => {
    const { doc, clock } = makeDoc();
    addMarks(doc, [["1", rect("a", 10)]]);
    doc.select(["a"]);
    doc.command({ nudge: [1, 0] });
    clock.t += 50;
    doc.command({ nudge: [1, 0] });
    expect(doc.undoCount).toBe(2);
  });

  it("a host sync in between ends the burst", () => {
    const { doc, clock } = makeDoc();
    addMarks(doc, [["1", rect("a", 10)]]);
    doc.select(["a"]);
    doc.command({ nudge: [1, 0] });
    clock.t += 50;
    doc.setPageShapes("2", [rect("hostMark")]);
    clock.t += 50;
    doc.command({ nudge: [1, 0] });
    expect(doc.undoCount).toBe(3);
    doc.undo();
    expect(xOf(doc, "a")).toBe(11);
    expect(doc.getShape("hostMark")).toBeDefined();
  });

  it("a host sync that changes nothing does not end the burst", () => {
    const { doc, clock } = makeDoc();
    addMarks(doc, [["1", rect("a", 10)]]);
    doc.select(["a"]);
    doc.command({ nudge: [1, 0] });
    doc.setPageShapes("2", []);
    clock.t += 50;
    doc.command({ nudge: [1, 0] });
    expect(doc.undoCount).toBe(2);
  });
});

describe("removePage with discardShapes drops the page's history patches", () => {
  it("keeps the other pages' patches of a multi-page entry and drops page-only entries", () => {
    const { doc } = makeDoc();
    doc.transact("Paste", (b) => {
      b.add("1", rect("p1"));
      b.add("2", rect("p2"));
    });
    addMarks(doc, [["2", rect("only2")]]);
    const events = record(doc, ["historyChange"]);

    doc.removePage("2", { discardShapes: true });
    expect(doc.undoCount).toBe(1);
    expect(events.count("historyChange")).toBe(1);
    expect(doc.historyState().undoPageIds).toEqual(["1"]);

    // undoing the paste touches only page 1 and does not bring page 2 back
    doc.undo();
    expect(doc.getAllShapes()).toHaveLength(0);
    expect(doc.getPageShapes("2")).toHaveLength(0);
    doc.redo();
    expect(ids(doc.getAllShapes())).toEqual(["p1"]);
  });

  it("without discardShapes the history stays whole", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["2", rect("p2")]]);
    doc.removePage("2");
    expect(doc.undoCount).toBe(1);
  });
});

describe("history is private", () => {
  it("exposes counts and state, not the history object", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("a")]]);
    // @ts-expect-error history is private to the document
    const leaked = doc.history;
    expect(doc.undoCount).toBe(1);
    expect(doc.redoCount).toBe(0);
    expect(doc.historyState().canUndo).toBe(true);
    void leaked;
  });
});

describe("a person's delete is always undoable; host syncs stay untracked", () => {
  it("deleting an anchored mark can be undone", () => {
    const { doc } = makeDoc();
    doc.setPageShapes("1", [rect("anch", 10, 10, 10, 10, { behavior: "anchored" })]);
    expect(doc.canUndo()).toBe(false);
    doc.select(["anch"]);
    expect(doc.deleteSelected()).toBe(true);
    expect(doc.getAllShapes()).toHaveLength(0);
    expect(doc.canUndo()).toBe(true);
    doc.undo();
    expect(ids(doc.getAllShapes())).toEqual(["anch"]);
    expect(doc.getSelection().ids).toEqual(["anch"]);
    doc.redo();
    expect(doc.getAllShapes()).toHaveLength(0);
  });

  it("a staged mark deleted together with a tracked one is one entry", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("mine")]]);
    doc.setPageShapes("1", [...doc.getPageShapes("1"), rect("st", 50, 50, 5, 5, { behavior: "staged" })]);
    doc.select(["mine", "st"]);
    doc.command("delete");
    expect(doc.undoCount).toBe(2);
    doc.undo();
    expect(ids(doc.getAllShapes()).sort()).toEqual(["mine", "st"]);
  });

  it("host syncs and ordinary transactions still skip untracked marks", () => {
    const { doc } = makeDoc();
    doc.setPageShapes("1", [rect("anch", 10, 10, 10, 10, { behavior: "anchored" })]);
    doc.setPageShapes("1", []);
    expect(doc.canUndo()).toBe(false);
    doc.transact("x", (b) => b.add("1", rect("anch2", 0, 0, 5, 5, { behavior: "anchored" })));
    expect(doc.canUndo()).toBe(false);
  });
});

describe("readOnly and bypassReadOnly", () => {
  it("origin host no longer bypasses; bypassReadOnly does", () => {
    const { doc } = makeDoc();
    doc.setReadOnly(true);
    expect(doc.transact("x", (b) => b.add("1", rect("a")), { origin: "host" })).toBeNull();
    expect(doc.getAllShapes()).toHaveLength(0);

    const tx = doc.transact("x", (b) => b.add("1", rect("a")), {
      origin: "host",
      bypassReadOnly: true,
    });
    expect(tx).not.toBeNull();
    expect(ids(doc.getAllShapes())).toEqual(["a"]);
  });

  it("setPageShapes and amendTransaction always bypass", () => {
    const { doc } = makeDoc();
    const t = doc.transact("Add", (b) => b.add("1", rect("a")))!;
    doc.setReadOnly(true);
    doc.setPageShapes("2", [rect("b")]);
    expect(doc.amendTransaction(t.id, (b) => b.add("1", rect("derived", 0, 0, 3, 3, { behavior: "backdrop" })))).toBe(true);
    expect(ids(doc.getAllShapes()).sort()).toEqual(["a", "b", "derived"]);
  });
});
