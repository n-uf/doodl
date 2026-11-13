import { describe, expect, it } from "vitest";
import type { RectShape } from "../../shapes/rect/types";
import { addMarks, ids, makeDoc, rect, record } from "./helpers";

describe("nudge swallows the key while an editable mark is selected", () => {
  it("returns true when the move clamps to nothing, and records no entry", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("edge", 80, 10, 20, 20)]]); // right edge on the page edge (100)
    doc.select(["edge"]);
    const entries = doc.undoCount;
    expect(doc.command({ nudge: [10, 0] })).toBe(true);
    expect(doc.undoCount).toBe(entries);
    expect((doc.getShape("edge") as RectShape).x).toBe(80);
  });

  it("returns false with nothing selected, only non-editable marks, or a zero step", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("a")]]);
    expect(doc.command({ nudge: [1, 0] })).toBe(false);
    doc.setPageShapes("1", [rect("anch", 10, 10, 10, 10, { behavior: "anchored" })]);
    doc.select(["anch"]);
    expect(doc.command({ nudge: [1, 0] })).toBe(false);
    doc.setPageShapes("1", [rect("a")]);
    doc.select(["a"]);
    expect(doc.command({ nudge: [0, 0] })).toBe(false);
  });
});

describe("beginGesture makes its page active", () => {
  it("sets the active page once the lock is taken, and emits activePageChange once", () => {
    const { doc } = makeDoc();
    expect(doc.activePageId).toBe("1");
    const events = record(doc, ["activePageChange"]);
    const g = doc.beginGesture("3", { kind: "draw" });
    expect(g).not.toBeNull();
    expect(doc.activePageId).toBe("3");
    expect(events.count("activePageChange")).toBe(1);
    g?.cancel();
    expect(doc.activePageId).toBe("3");
  });

  it("a refused gesture does not move the active page", () => {
    const { doc } = makeDoc();
    doc.beginGesture("1");
    expect(doc.beginGesture("2")).toBeNull();
    expect(doc.activePageId).toBe("1");
  });

  it("the page is already active when gestureChange fires", () => {
    const { doc } = makeDoc();
    let seen: string | null = null;
    doc.on("gestureChange", (g) => {
      if (g) seen = doc.activePageId;
    });
    doc.beginGesture("2");
    expect(seen).toBe("2");
  });
});

describe("a gesture commit never re-adds a mark the host removed meanwhile", () => {
  it("drops the moved copy of a removed mark but still adds genuinely new marks", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("m", 10)], ["1", rect("keep", 40)]]);
    doc.select(["m", "keep"]);
    const g = doc.beginGesture("1", { kind: "move" })!;
    const moved = (id: string): RectShape => ({ ...(doc.getShape(id) as RectShape), x: 70 });
    g.setPreview([moved("m"), moved("keep"), rect("fresh", 5, 5, 4, 4)]);

    // the host drops "m" during the drag
    doc.setPageShapes("1", doc.getPageShapes("1").filter((s) => s.id !== "m"));
    expect(doc.getShape("m")).toBeUndefined();

    g.commit({ select: "keep" });
    expect(doc.getShape("m")).toBeUndefined();
    expect((doc.getShape("keep") as RectShape).x).toBe(70);
    expect(ids(doc.getPageShapes("1")).sort()).toEqual(["fresh", "keep"]);
  });

  it("a gesture whose only shape was removed commits nothing", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("m", 10)]]);
    const g = doc.beginGesture("1", { kind: "move" })!;
    const moved: RectShape = { ...(doc.getShape("m") as RectShape), x: 70 };
    g.setPreview([moved]);
    doc.setPageShapes("1", []);
    const entries = doc.undoCount;
    expect(g.commit()).toBeNull();
    expect(doc.getAllShapes()).toHaveLength(0);
    expect(doc.undoCount).toBe(entries);
  });
});
