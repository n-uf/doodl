import { describe, expect, it } from "vitest";
import type { RectShape } from "../../shapes/rect/types";
import { addMarks, makeDoc, rect } from "./helpers";

describe("a throwing shapesChange listener during a host sync", () => {
  it("still ends the nudge burst, so two nudges around the sync are two undo steps", () => {
    const { doc, clock } = makeDoc();
    addMarks(doc, [["1", rect("a", 10)]]);
    doc.select(["a"]);
    doc.command({ nudge: [1, 0] });
    clock.t += 50;

    const off = doc.on("shapesChange", (_page, _shapes, meta) => {
      if (meta.origin === "host") throw new Error("listener");
    });
    expect(() => doc.setPageShapes("2", [rect("hostMark")])).toThrow("listener");
    off();
    expect(doc.getShape("hostMark")).toBeDefined();

    clock.t += 50;
    doc.command({ nudge: [1, 0] });
    expect(doc.undoCount).toBe(3); // add, nudge, nudge
    doc.undo();
    expect((doc.getShape("a") as RectShape).x).toBe(11);
  });
});

describe("page versions only ever increase", () => {
  it("removePage with discardShapes keeps the version, and re-adding never reuses a seen value", () => {
    const { doc } = makeDoc();
    const seen = new Set<number>();
    const note = () => {
      const v = doc.getPageVersion("2");
      return v;
    };
    seen.add(note());
    doc.setPageShapes("2", [rect("a")]);
    const v1 = note();
    seen.add(v1);
    doc.setPageShapes("2", [rect("a"), rect("b")]);
    const v2 = note();
    seen.add(v2);
    expect(v2).toBeGreaterThan(v1);

    doc.removePage("2", { discardShapes: true });
    const v3 = note();
    expect(v3).toBeGreaterThan(v2);
    expect(seen.has(v3)).toBe(false);
    seen.add(v3);

    doc.definePage("2", { width: 100, height: 200 });
    doc.setPageShapes("2", [rect("c")]);
    const v4 = note();
    expect(v4).toBeGreaterThan(v3);
    expect(seen.has(v4)).toBe(false);
  });
});
