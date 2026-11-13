import { describe, expect, it } from "vitest";
import type { RectShape } from "../../shapes/rect/types";
import { addMarks, ids, makeDoc, rect } from "./helpers";

describe("document commands", () => {
  it("selectAll takes the active page only", () => {
    const { doc } = makeDoc();
    addMarks(doc, [
      ["1", rect("a1")],
      ["1", rect("b1")],
      ["2", rect("a2")],
    ]);
    doc.setPageShapes("1", [...doc.getPageShapes("1"), rect("bd", 0, 0, 3, 3, { behavior: "backdrop" })]);

    doc.setActivePage("1");
    expect(doc.command("selectAll")).toBe(true);
    expect(doc.getSelection().ids).toEqual(["a1", "b1"]);

    doc.setActivePage("2");
    doc.command("selectAll");
    expect(doc.getSelection().ids).toEqual(["a2"]);

    doc.setActivePage("3");
    expect(doc.command("selectAll")).toBe(false);
    expect(doc.getSelection().ids).toEqual(["a2"]);
  });

  it("delete with an empty selection is left to the host", () => {
    const { doc } = makeDoc();
    expect(doc.command("delete")).toBe(false);
  });

  it("undo and redo commands", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("a")]]);
    expect(doc.command("undo")).toBe(true);
    expect(doc.command("undo")).toBe(false);
    expect(doc.command("redo")).toBe(true);
    expect(ids(doc.getAllShapes())).toEqual(["a"]);
  });

  it("escape cancels a running gesture first, then clears the selection", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("a")]]);
    doc.select(["a"]);
    const g = doc.beginGesture("1")!;
    g.setPreview([rect("tmp")]);

    expect(doc.command("escape")).toBe(true);
    expect(g.active).toBe(false);
    expect(doc.getSelection().ids).toEqual(["a"]);
    expect(doc.getShape("tmp")).toBeUndefined();

    expect(doc.command("escape")).toBe(true);
    expect(doc.getSelection().ids).toEqual([]);
  });

  describe("nudge", () => {
    it("moves the selection on every page, as one entry", () => {
      const { doc } = makeDoc();
      addMarks(doc, [
        ["1", rect("a1", 10, 10)],
        ["2", rect("a2", 30, 30)],
      ]);
      doc.select(["a1", "a2"]);
      const entries = doc.undoCount;
      expect(doc.command({ nudge: [1, 2] })).toBe(true);
      expect(doc.getShape("a1")).toMatchObject({ x: 11, y: 12 });
      expect(doc.getShape("a2")).toMatchObject({ x: 31, y: 32 });
      expect(doc.undoCount).toBe(entries + 1);
      doc.undo();
      expect(doc.getShape("a1")).toMatchObject({ x: 10, y: 10 });
      expect(doc.getShape("a2")).toMatchObject({ x: 30, y: 30 });
    });

    it("leaves the key to the host with an empty selection", () => {
      const { doc } = makeDoc();
      addMarks(doc, [["1", rect("a1")]]);
      expect(doc.command({ nudge: [1, 0] })).toBe(false);
    });

    it("clamps each page's group inside the page", () => {
      const { doc } = makeDoc();
      // page is 100 x 200; this mark's right edge is at 95
      addMarks(doc, [["1", rect("edge", 75, 10, 20, 20)]]);
      doc.select(["edge"]);
      expect(doc.command({ nudge: [10, 0] })).toBe(true);
      expect((doc.getShape("edge") as RectShape).x).toBe(80);
      expect(doc.command({ nudge: [10, 0] })).toBe(false);
      expect((doc.getShape("edge") as RectShape).x).toBe(80);
      expect(doc.command({ nudge: [-1000, 0] })).toBe(true);
      expect((doc.getShape("edge") as RectShape).x).toBe(0);
    });

    it("moves a group together, keeping relative positions at the clamp", () => {
      const { doc } = makeDoc();
      addMarks(doc, [
        ["1", rect("l", 0, 10, 10, 10)],
        ["1", rect("r", 50, 10, 10, 10)],
      ]);
      doc.select(["l", "r"]);
      doc.command({ nudge: [-5, 0] });
      expect((doc.getShape("l") as RectShape).x).toBe(0);
      expect((doc.getShape("r") as RectShape).x).toBe(50);
      doc.command({ nudge: [100, 0] });
      expect((doc.getShape("r") as RectShape).x).toBe(90);
      expect((doc.getShape("l") as RectShape).x).toBe(40);
    });

    it("skips marks that are not editable", () => {
      const { doc } = makeDoc();
      addMarks(doc, [["1", rect("anch", 10, 10, 10, 10, { behavior: "anchored" })]]);
      doc.select(["anch"]);
      expect(doc.command({ nudge: [1, 0] })).toBe(false);
    });

    it("moves marks on pages with no registered size without clamping", () => {
      const { doc } = makeDoc();
      doc.setPageShapes("9", [rect("far", 5, 5)]);
      doc.select(["far"]);
      expect(doc.command({ nudge: [-50, 0] })).toBe(true);
      expect((doc.getShape("far") as RectShape).x).toBe(-45);
    });
  });
});
