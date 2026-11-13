import { describe, expect, it } from "vitest";
import { SelectionModel, applyClick, groupByPage } from "../document-selection";
import { addMarks, makeDoc, rect, record } from "./helpers";

function twoPageDoc() {
  const ctx = makeDoc();
  addMarks(ctx.doc, [
    ["1", rect("a1")],
    ["1", rect("b1", 50, 50)],
    ["2", rect("a2")],
    ["2", rect("b2", 50, 50)],
  ]);
  return ctx;
}

describe("document selection", () => {
  it("select on page 1 then on page 2 leaves only the page-2 mark, one event per step", () => {
    const { doc } = twoPageDoc();
    const events = record(doc, ["selectionChange"]);

    doc.click({ kind: "shape", id: "a1" });
    expect(doc.getSelection().ids).toEqual(["a1"]);
    expect(events.count("selectionChange")).toBe(1);

    doc.click({ kind: "shape", id: "a2" });
    const sel = doc.getSelection();
    expect(sel.ids).toEqual(["a2"]);
    expect([...sel.byPage.keys()]).toEqual(["2"]);
    expect(events.count("selectionChange")).toBe(2);

    const last = events.log[1]?.[1] as { ids: string[]; byPage: Map<string, string[]>; origin: string };
    expect(last.ids).toEqual(["a2"]);
    expect(last.byPage.get("2")).toEqual(["a2"]);
    expect(last.origin).toBe("user");
  });

  it("shift adds across pages and toggles one off", () => {
    const { doc } = twoPageDoc();
    doc.click({ kind: "shape", id: "a1" });
    doc.click({ kind: "shape", id: "a2" }, { shift: true });
    const sel = doc.getSelection();
    expect(sel.ids).toEqual(["a1", "a2"]);
    expect(sel.byPage.get("1")).toEqual(["a1"]);
    expect(sel.byPage.get("2")).toEqual(["a2"]);

    doc.click({ kind: "shape", id: "a1" }, { shift: true });
    expect(doc.getSelection().ids).toEqual(["a2"]);
  });

  it("empty paper, the gap and Escape deselect; clicks outside the root keep it", () => {
    const { doc } = twoPageDoc();
    doc.select(["a1", "a2"]);

    expect(doc.click({ kind: "outside" })).toBe(false);
    expect(doc.getSelection().ids).toEqual(["a1", "a2"]);

    doc.click({ kind: "paper", pageId: 1 });
    expect(doc.getSelection().ids).toEqual([]);

    doc.select(["a1", "a2"]);
    doc.click({ kind: "gap" });
    expect(doc.getSelection().ids).toEqual([]);

    doc.select(["b1"]);
    expect(doc.command("escape")).toBe(true);
    expect(doc.getSelection().ids).toEqual([]);
    expect(doc.command("escape")).toBe(false);
  });

  it("select drops unknown ids with a warning, and non-selectable marks", () => {
    const { doc, warnings } = twoPageDoc();
    doc.setPageShapes("3", [rect("ghost", 0, 0, 5, 5, { behavior: "backdrop" })]);
    doc.select(["a1", "nope", "ghost"]);
    expect(doc.getSelection().ids).toEqual(["a1"]);
    expect(warnings.filter((w) => w.includes("nope") || w.includes("ghost"))).toHaveLength(2);
  });

  it("modes: add and toggle", () => {
    const { doc } = twoPageDoc();
    doc.select(["a1"]);
    doc.select(["b2"], { mode: "add" });
    expect(doc.getSelection().ids).toEqual(["a1", "b2"]);
    doc.select(["a1"], { mode: "toggle" });
    expect(doc.getSelection().ids).toEqual(["b2"]);
  });

  it("a click makes its page active; programmatic select follows the selection", () => {
    const { doc } = twoPageDoc();
    expect(doc.activePageId).toBe("1");
    doc.click({ kind: "shape", id: "a2" });
    expect(doc.activePageId).toBe("2");
    doc.click({ kind: "paper", pageId: 3 });
    expect(doc.activePageId).toBe("3");
    doc.click({ kind: "gap" });
    expect(doc.activePageId).toBe("3");
    doc.select(["a1"]);
    expect(doc.activePageId).toBe("1");
    doc.setActivePage(2);
    expect(doc.activePageId).toBe("2");
  });

  it("preserveGroup keeps a multi-selection when pressing on a selected mark", () => {
    const { doc } = twoPageDoc();
    doc.select(["a1", "b1"]);
    expect(doc.click({ kind: "shape", id: "a1" }, { preserveGroup: true })).toBe(false);
    expect(doc.getSelection().ids).toEqual(["a1", "b1"]);
    expect(doc.click({ kind: "shape", id: "a1" })).toBe(true);
    expect(doc.getSelection().ids).toEqual(["a1"]);
  });

  it("marks on an unmounted page can stay selected", () => {
    const { doc } = twoPageDoc();
    doc.select(["a2"]);
    expect(doc.viewCount("2")).toBe(0);
    expect(doc.getSelection().byPage.get("2")).toEqual(["a2"]);
  });

  it("SelectionModel and applyClick are pure", () => {
    const m = new SelectionModel(["x"]);
    expect(m.add(["x"])).toBe(false);
    expect(m.toggle(["y"])).toBe(true);
    expect(m.ids()).toEqual(["x", "y"]);
    expect(applyClick(m, { kind: "gap" })).toBe(true);
    expect(applyClick(m, { kind: "gap" })).toBe(false);
    expect(groupByPage(["a", "b", "c"], (id) => (id === "c" ? undefined : id === "a" ? "1" : "2"))).toEqual(
      new Map([["1", ["a"]], ["2", ["b"]]])
    );
  });

  it("readOnly: selection works", () => {
    const { doc } = twoPageDoc();
    doc.setReadOnly(true);
    doc.click({ kind: "shape", id: "a1" });
    expect(doc.getSelection().ids).toEqual(["a1"]);
    expect(doc.command("escape")).toBe(true);
  });
});
