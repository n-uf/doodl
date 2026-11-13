import { describe, expect, it } from "vitest";
import { addMarks, makeDoc, rect } from "./helpers";

describe("stable snapshots for useSyncExternalStore", () => {
  it("getSelection returns the same object until the selection changes", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("a")], ["2", rect("b")]]);
    const empty = doc.getSelection();
    expect(doc.getSelection()).toBe(empty);

    doc.select(["a"]);
    const one = doc.getSelection();
    expect(one).not.toBe(empty);
    expect(doc.getSelection()).toBe(one);

    // unrelated changes keep the snapshot
    doc.setTool("rect");
    doc.setActivePage("2");
    doc.setPageShapes("3", [rect("c")]);
    expect(doc.getSelection()).toBe(one);

    // selecting the same thing again keeps it too
    doc.select(["a"]);
    expect(doc.getSelection()).toBe(one);

    doc.select(["b"], { mode: "add" });
    const two = doc.getSelection();
    expect(two).not.toBe(one);
    expect(two.ids).toEqual(["a", "b"]);
    expect(doc.getSelection()).toBe(two);
  });

  it("a page change of a selected id replaces the snapshot (byPage differs)", () => {
    const { doc } = makeDoc();
    doc.setPageShapes("1", [rect("a")]);
    doc.select(["a"]);
    const before = doc.getSelection();
    doc.setPageShapes("1", []);
    doc.setPageShapes("2", [rect("a")]);
    doc.select(["a"]);
    const after = doc.getSelection();
    expect(after).not.toBe(before);
    expect(after.byPage.get("2")).toEqual(["a"]);
  });

  it("historyState returns the same object until it changes", () => {
    const { doc } = makeDoc();
    const initial = doc.historyState();
    expect(doc.historyState()).toBe(initial);
    expect(initial.canUndo).toBe(false);

    addMarks(doc, [["1", rect("a")]]);
    const afterAdd = doc.historyState();
    expect(afterAdd).not.toBe(initial);
    expect(afterAdd.canUndo).toBe(true);
    expect(doc.historyState()).toBe(afterAdd);

    // changes that leave the state as it was keep the object
    doc.select(["a"]);
    doc.setTool("rect");
    expect(doc.historyState()).toBe(afterAdd);

    doc.undo();
    const afterUndo = doc.historyState();
    expect(afterUndo).not.toBe(afterAdd);
    expect(afterUndo.canRedo).toBe(true);
    expect(doc.historyState()).toBe(afterUndo);
  });

  it("an amend that adds a page changes the state; per-page mode follows the active page", () => {
    const { doc } = makeDoc({ history: { mode: "per-page" } });
    const tx = doc.transact("Add", (b) => b.add("1", rect("a")))!;
    doc.setActivePage("1");
    const s1 = doc.historyState();
    doc.amendTransaction(tx.id, (b) => b.add("2", rect("d", 0, 0, 3, 3, { behavior: "backdrop" })));
    const s2 = doc.historyState();
    expect(s2).not.toBe(s1);
    expect(s2.undoPageIds).toEqual(["1", "2"]);

    doc.setActivePage("3");
    expect(doc.historyState().canUndo).toBe(false);
    doc.setActivePage("1");
    expect(doc.historyState()).toEqual(s2);
  });

  it("the snapshot types are read-only", () => {
    const { doc } = makeDoc();
    const sel = doc.getSelection();
    // @ts-expect-error ids is a readonly array
    sel.ids.push("x");
    // @ts-expect-error byPage is a ReadonlyMap
    sel.byPage.set("1", []);
    expect(true).toBe(true);
  });
});
