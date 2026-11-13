import { describe, expect, it } from "vitest";
import type { RectShape } from "../../shapes/rect/types";
import { DocumentHistory } from "../document-history";
import { addMarks, fakeView, ids, makeDoc, rect, record } from "./helpers";

const xOf = (doc: ReturnType<typeof makeDoc>["doc"], id: string) =>
  (doc.getShape(id) as RectShape | undefined)?.x;

describe("document history", () => {
  it("undo and redo run in order across pages, one step each", () => {
    const { doc } = makeDoc();
    addMarks(doc, [
      ["1", rect("r1", 10)],
      ["2", rect("r2", 10)],
    ]);
    const moved: RectShape = { ...(doc.getShape("r1") as RectShape), x: 60 };
    doc.transact("Move", (tx) => tx.update(moved));
    expect(xOf(doc, "r1")).toBe(60);

    expect(doc.undo()).toBe(true);
    expect(xOf(doc, "r1")).toBe(10);
    expect(doc.getShape("r2")).toBeDefined();

    doc.undo();
    expect(doc.getShape("r2")).toBeUndefined();
    expect(doc.getShape("r1")).toBeDefined();

    doc.undo();
    expect(doc.getShape("r1")).toBeUndefined();
    expect(doc.canUndo()).toBe(false);

    doc.redo();
    expect(ids(doc.getPageShapes("1"))).toEqual(["r1"]);
    expect(doc.getShape("r2")).toBeUndefined();
    doc.redo();
    expect(doc.getShape("r2")).toBeDefined();
    doc.redo();
    expect(xOf(doc, "r1")).toBe(60);
    expect(doc.canRedo()).toBe(false);
  });

  it("a new edit clears redo", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("r1")]]);
    doc.undo();
    expect(doc.canRedo()).toBe(true);
    addMarks(doc, [["1", rect("r2")]]);
    expect(doc.canRedo()).toBe(false);
  });

  it("deleteSelected across two pages is one transaction; undo restores both and the selection", () => {
    const { doc } = makeDoc();
    addMarks(doc, [
      ["1", rect("a1")],
      ["2", rect("a2")],
      ["2", rect("keep")],
    ]);
    doc.select(["a1", "a2"]);
    const before = doc.history.undoCount;
    const events = record(doc, ["shapesChange", "change", "historyChange", "selectionChange"]);

    expect(doc.deleteSelected()).toBe(true);
    expect(doc.history.undoCount).toBe(before + 1);
    expect(ids(doc.getAllShapes())).toEqual(["keep"]);
    expect(doc.getSelection().ids).toEqual([]);
    expect(events.count("shapesChange")).toBe(2);
    expect(events.count("change")).toBe(1);
    expect(events.count("selectionChange")).toBe(1);

    doc.undo();
    expect(ids(doc.getAllShapes()).sort()).toEqual(["a1", "a2", "keep"]);
    expect(doc.getSelection().ids).toEqual(["a1", "a2"]);

    doc.redo();
    expect(ids(doc.getAllShapes())).toEqual(["keep"]);
  });

  it("delete removes only the selection, on any page, and skips non-deletable marks", () => {
    const { doc } = makeDoc();
    addMarks(doc, [
      ["1", rect("a1")],
      ["2", rect("a2")],
      ["2", rect("pin", 50, 50, 10, 10, { behavior: "pinned" })],
    ]);
    doc.select(["a2", "pin"]);
    doc.command("delete");
    expect(ids(doc.getAllShapes()).sort()).toEqual(["a1", "pin"]);
    expect(doc.getSelection().ids).toEqual(["pin"]);
  });

  it("setPageShapes records no history, keeps surviving selection; undo never removes host shapes", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("mine")]]);
    doc.select(["mine"]);
    const undoCount = doc.history.undoCount;

    const mine = doc.getShape("mine")!;
    const changed = doc.setPageShapes("1", [mine, rect("hostA", 70, 70)]);
    expect(changed).toBe(true);
    expect(doc.history.undoCount).toBe(undoCount);
    expect(doc.getSelection().ids).toEqual(["mine"]);
    expect(doc.getShape("mine")).toBe(mine);

    doc.setPageShapes("1", [rect("hostA", 70, 70)]);
    expect(doc.getSelection().ids).toEqual([]);
    expect(doc.history.undoCount).toBe(undoCount);

    // undoing the add of "mine" does not remove what the host added since
    doc.setPageShapes("1", [mine, rect("hostA", 70, 70)]);
    doc.undo();
    expect(ids(doc.getPageShapes("1"))).toEqual(["hostA"]);
  });

  it("setPageShapes is idempotent: same data emits nothing", () => {
    const { doc } = makeDoc();
    doc.setPageShapes("1", [rect("a"), rect("b")]);
    const events = record(doc, ["shapesChange", "change"]);
    expect(doc.setPageShapes("1", [rect("a"), rect("b")])).toBe(false);
    expect(events.log).toEqual([]);
    expect(doc.setPageShapes("1", [rect("b"), rect("a")])).toBe(true);
    expect(ids(doc.getPageShapes("1"))).toEqual(["b", "a"]);
  });

  it("setPageShapes with history:true is an undoable step", () => {
    const { doc } = makeDoc();
    doc.setPageShapes("1", [rect("a")], { history: true });
    expect(doc.canUndo()).toBe(true);
    doc.undo();
    expect(doc.getPageShapes("1")).toHaveLength(0);
  });

  it("history survives unregistering and re-registering a page, and views coming and going", () => {
    const { doc } = makeDoc();
    addMarks(doc, [
      ["1", rect("r1")],
      ["2", rect("r2")],
    ]);
    const view = fakeView();
    const detach = doc.attachView("2", view);
    detach();
    doc.removePage("2");
    expect(doc.getPageInfo("2")).toBeUndefined();
    expect(doc.canUndo()).toBe(true);
    doc.definePage("2", { width: 100, height: 200 });
    doc.attachView("2", fakeView());

    expect(doc.history.undoCount).toBe(2);
    doc.undo();
    expect(doc.getShape("r2")).toBeUndefined();
    doc.undo();
    expect(doc.getShape("r1")).toBeUndefined();
    doc.redo();
    doc.redo();
    expect(ids(doc.getAllShapes()).sort()).toEqual(["r1", "r2"]);
  });

  it("removePage with discardShapes empties and forgets the page without history", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["2", rect("r2")]]);
    doc.select(["r2"]);
    const undoCount = doc.history.undoCount;
    doc.removePage("2", { discardShapes: true });
    expect(doc.getPageShapes("2")).toHaveLength(0);
    expect(doc.getSelection().ids).toEqual([]);
    expect(doc.history.undoCount).toBe(undoCount);
    expect(() => doc.undo()).not.toThrow();
  });

  it("untracked (backdrop) marks never enter history", () => {
    const { doc } = makeDoc();
    doc.transact("Highlights", (tx) => tx.add("1", rect("h", 0, 0, 5, 5, { behavior: "backdrop" })));
    expect(doc.canUndo()).toBe(false);
    expect(doc.getShape("h")).toBeDefined();
  });

  it("maxEntries trims the oldest", () => {
    const { doc } = makeDoc({ history: { maxEntries: 2 } });
    addMarks(doc, [
      ["1", rect("r1")],
      ["1", rect("r2")],
      ["1", rect("r3")],
    ]);
    expect(doc.history.undoCount).toBe(2);
    doc.undo();
    doc.undo();
    expect(doc.canUndo()).toBe(false);
    expect(ids(doc.getPageShapes("1"))).toEqual(["r1"]);
  });

  it("per-page mode undoes the latest entry that touches the page", () => {
    const { doc } = makeDoc({ history: { mode: "per-page" } });
    addMarks(doc, [
      ["1", rect("r1")],
      ["2", rect("r2")],
      ["1", rect("r3")],
    ]);
    expect(doc.undo("2")).toBe(true);
    expect(ids(doc.getAllShapes()).sort()).toEqual(["r1", "r3"]);
    expect(doc.canUndo("2")).toBe(false);
    expect(doc.undo("1")).toBe(true);
    expect(ids(doc.getAllShapes())).toEqual(["r1"]);
    expect(doc.redo("2")).toBe(true);
    expect(ids(doc.getAllShapes()).sort()).toEqual(["r1", "r2"]);
  });

  it("per-page mode defaults to the active page", () => {
    const { doc } = makeDoc({ history: { mode: "per-page" } });
    addMarks(doc, [
      ["1", rect("r1")],
      ["2", rect("r2")],
    ]);
    doc.setActivePage("1");
    doc.undo();
    expect(ids(doc.getAllShapes())).toEqual(["r2"]);
  });

  it("readOnly: every mutation and undo is a no-op, host sync still applies", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("r1")]]);
    doc.select(["r1"]);
    doc.setReadOnly(true);

    expect(doc.transact("x", (tx) => tx.add("1", rect("zz")))).toBeNull();
    expect(doc.deleteSelected()).toBe(false);
    expect(doc.undo()).toBe(false);
    expect(doc.command({ nudge: [1, 0] })).toBe(false);
    expect(ids(doc.getAllShapes())).toEqual(["r1"]);

    doc.setPageShapes("1", [rect("r1"), rect("fromHost")]);
    expect(ids(doc.getAllShapes())).toEqual(["r1", "fromHost"]);
  });

  it("a throwing transaction leaves no trace", () => {
    const { doc } = makeDoc();
    expect(() =>
      doc.transact("boom", (tx) => {
        tx.add("1", rect("a"));
        throw new Error("boom");
      })
    ).toThrow("boom");
    expect(doc.getAllShapes()).toHaveLength(0);
    expect(doc.canUndo()).toBe(false);
  });

  it("nudge bursts coalesce into one entry; a later burst is a new entry", () => {
    const { doc, clock } = makeDoc();
    addMarks(doc, [["1", rect("r1", 10)]]);
    doc.select(["r1"]);
    doc.command({ nudge: [1, 0] });
    clock.t += 100;
    doc.command({ nudge: [1, 0] });
    clock.t += 100;
    doc.command({ nudge: [10, 0] });
    expect(xOf(doc, "r1")).toBe(22);
    expect(doc.history.undoCount).toBe(2);
    doc.undo();
    expect(xOf(doc, "r1")).toBe(10);

    doc.redo();
    clock.t += 5_000;
    doc.command({ nudge: [1, 0] });
    expect(doc.history.undoCount).toBe(3);
  });

  it("undo while a gesture runs is refused", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("r1")]]);
    const g = doc.beginGesture("1");
    expect(doc.undo()).toBe(false);
    g?.cancel();
    expect(doc.undo()).toBe(true);
  });

  it("emits historyChange and historyApplied with page ids", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["2", rect("r2")]]);
    const events = record(doc, ["historyChange", "historyApplied", "shapesChange"]);
    doc.undo();
    const applied = events.log.find((e) => e[0] === "historyApplied")?.[1] as {
      kind: string;
      pageIds: string[];
      label: string;
    };
    expect(applied).toMatchObject({ kind: "undo", pageIds: ["2"], label: "Add" });
    expect(events.count("historyChange")).toBe(1);
    const state = events.log.find((e) => e[0] === "historyChange")?.[1];
    expect(state).toMatchObject({ canUndo: false, canRedo: true, redoLabel: "Add", redoPageIds: ["2"] });
  });

  it("DocumentHistory standalone: coalesce guard after undo", () => {
    const h = new DocumentHistory({ coalesceMs: 1000 });
    const mk = (id: number, time: number) => ({
      id,
      label: "n",
      patches: [],
      selectionBefore: [],
      selectionAfter: [],
      pageIds: [],
      origin: "user",
      time,
      coalesceKey: "k",
    });
    h.record(mk(1, 0));
    const u = h.takeUndo();
    if (u) h.pushUndo(u);
    h.record(mk(2, 10));
    expect(h.undoCount).toBe(2);
  });
});
