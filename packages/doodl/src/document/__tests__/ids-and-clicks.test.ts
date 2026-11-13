import { describe, expect, it } from "vitest";
import type { RectShape } from "../../shapes/rect/types";
import { applyClick, SelectionModel } from "../document-selection";
import { addMarks, ids, makeDoc, rect, record } from "./helpers";

describe("adding a selectable id that lives on another page", () => {
  it("warns and updates that mark in place on its own page", () => {
    const { doc, warnings } = makeDoc();
    addMarks(doc, [["1", rect("m", 10)]]);
    doc.transact("Add", (b) => b.add("2", rect("m", 55)));
    expect(doc.getPageShapes("2")).toHaveLength(0);
    expect(doc.pageOf("m")).toBe("1");
    expect((doc.getShape("m") as RectShape).x).toBe(55);
    expect(warnings.some((w) => w.includes('"m"') && w.includes("page 1"))).toBe(true);
    // one undo reverts the in-place update
    doc.undo();
    expect((doc.getShape("m") as RectShape).x).toBe(10);
  });

  it("backdrop duplicates stay per page", () => {
    const { doc, warnings } = makeDoc();
    doc.transact("a", (b) => b.add("1", rect("bd", 0, 0, 3, 3, { behavior: "backdrop" })), {
      history: false,
    });
    doc.transact("b", (b) => b.add("2", rect("bd", 0, 0, 3, 3, { behavior: "backdrop" })), {
      history: false,
    });
    expect(doc.getPageShapes("1")).toHaveLength(1);
    expect(doc.getPageShapes("2")).toHaveLength(1);
    expect(warnings).toEqual([]);
  });

  it("a selectable add next to a backdrop with the same id is allowed", () => {
    const { doc } = makeDoc();
    doc.setPageShapes("1", [rect("x", 0, 0, 3, 3, { behavior: "backdrop" })]);
    doc.transact("Add", (b) => b.add("2", rect("x")));
    expect(doc.getPageShapes("2")).toHaveLength(1);
    expect(doc.pageOf("x")).toBe("2");
  });
});

describe("id index is kept per changed page", () => {
  it("pageOf follows adds, moves between pages by sync, removals, and claim switches", () => {
    const { doc } = makeDoc();
    doc.setPageShapes("1", [rect("dup", 0, 0, 3, 3, { behavior: "backdrop" }), rect("a")]);
    expect(doc.pageOf("dup")).toBe("1");
    doc.setPageShapes("2", [rect("dup")]);
    expect(doc.pageOf("dup")).toBe("2"); // the selectable claim wins
    doc.setPageShapes("2", []);
    expect(doc.pageOf("dup")).toBe("1");
    doc.setPageShapes("1", [rect("a")]);
    expect(doc.pageOf("dup")).toBeUndefined();

    doc.setPageShapes("3", [rect("a")]);
    expect(doc.pageOf("a")).toBe("1"); // first selectable claimant keeps it
    doc.setPageShapes("1", []);
    expect(doc.pageOf("a")).toBe("3");
    doc.undo(); // nothing recorded; no throw
    expect(doc.pageOf("a")).toBe("3");
  });

  it("undo and redo keep the index right", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("u")]]);
    doc.undo();
    expect(doc.pageOf("u")).toBeUndefined();
    doc.redo();
    expect(doc.pageOf("u")).toBe("1");
  });
});

describe("clicks on backdrop marks and Shift on empty paper", () => {
  it("a click on a backdrop mark acts as a click on the paper of its page", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("mine")]]);
    doc.setPageShapes("2", [rect("hit", 0, 0, 5, 5, { behavior: "backdrop" })]);
    doc.select(["mine"]);
    expect(doc.activePageId).toBe("1");

    expect(doc.click({ kind: "shape", id: "hit" })).toBe(true);
    expect(doc.getSelection().ids).toEqual([]);
    expect(doc.activePageId).toBe("2");
  });

  it("an unknown id is ignored", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("mine")]]);
    doc.select(["mine"]);
    expect(doc.click({ kind: "shape", id: "nope" })).toBe(false);
    expect(doc.getSelection().ids).toEqual(["mine"]);
  });

  it("Shift on empty paper, a backdrop mark or the gap keeps the selection; plain clicks clear it", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("a")], ["2", rect("b")]]);
    doc.setPageShapes("3", [rect("hit", 0, 0, 5, 5, { behavior: "backdrop" })]);
    doc.select(["a", "b"]);

    expect(doc.click({ kind: "paper", pageId: 1 }, { shift: true })).toBe(false);
    expect(doc.click({ kind: "gap" }, { shift: true })).toBe(false);
    expect(doc.click({ kind: "shape", id: "hit" }, { shift: true })).toBe(false);
    expect(doc.getSelection().ids).toEqual(["a", "b"]);

    expect(doc.click({ kind: "paper", pageId: 1 })).toBe(true);
    expect(doc.getSelection().ids).toEqual([]);
  });

  it("applyClick is pure about it", () => {
    const m = new SelectionModel(["x"]);
    expect(applyClick(m, { kind: "gap" }, { shift: true })).toBe(false);
    expect(applyClick(m, { kind: "paper", pageId: "1" }, { shift: true })).toBe(false);
    expect(m.ids()).toEqual(["x"]);
    expect(applyClick(m, { kind: "gap" })).toBe(true);
  });

  it("selection events still fire once for the backdrop click that clears", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("a")]]);
    doc.setPageShapes("2", [rect("hit", 0, 0, 5, 5, { behavior: "backdrop" })]);
    doc.select(["a"]);
    const events = record(doc, ["selectionChange"]);
    doc.click({ kind: "shape", id: "hit" });
    expect(events.count("selectionChange")).toBe(1);
    expect(ids(doc.getAllShapes()).sort()).toEqual(["a", "hit"]);
  });
});
