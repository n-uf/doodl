import { describe, expect, it } from "vitest";
import type { PolygonShape } from "../../shapes/polygon/types";
import type { RectShape } from "../../shapes/rect/types";
import { GestureLock } from "../gesture-lock";
import { addMarks, ids, makeDoc, rect, record } from "./helpers";

describe("gesture lock", () => {
  it("refuses a second gesture, on any page, until the first ends", () => {
    const { doc } = makeDoc();
    const events = record(doc, ["gestureChange"]);
    const first = doc.beginGesture("1", { kind: "draw", pointerId: 7 });
    expect(first).not.toBeNull();
    expect(doc.gesture?.pointerId).toBe(7);

    expect(doc.beginGesture("2", { kind: "draw" })).toBeNull();
    expect(doc.beginGesture("1", { kind: "move" })).toBeNull();

    first?.cancel();
    expect(first?.active).toBe(false);
    expect(doc.gesture).toBeNull();
    expect(doc.beginGesture("2", { kind: "draw" })).not.toBeNull();
    expect(events.count("gestureChange")).toBe(3);
  });

  it("GestureLock alone: only the holder releases", () => {
    const lock = new GestureLock();
    const a = lock.tryBegin("1");
    expect(a).not.toBeNull();
    expect(lock.tryBegin("2")).toBeNull();
    expect(lock.release(999)).toBe(false);
    expect(lock.release(a!.id)).toBe(true);
    expect(lock.locked).toBe(false);
  });

  it("a finished gesture cannot be committed or previewed again", () => {
    const { doc } = makeDoc();
    const g = doc.beginGesture("1")!;
    g.setPreview([rect("a")]);
    expect(g.commit()).not.toBeNull();
    expect(g.commit()).toBeNull();
    g.setPreview([rect("b")]);
    expect(doc.getPageShapes("1")).toHaveLength(1);
  });
});

describe("gesture preview and commit", () => {
  it("previews emit no shapesChange and no history; commit emits one per page and one entry", () => {
    const { doc } = makeDoc();
    const events = record(doc, ["shapesChange", "change", "gesturePreview", "historyChange"]);
    const g = doc.beginGesture("1", { kind: "draw" })!;

    g.setPreview([rect("m", 1, 1, 5, 5)]);
    g.setPreview([rect("m", 1, 1, 15, 15)]);
    g.setPreview([rect("m", 1, 1, 25, 25)]);
    expect(events.count("shapesChange")).toBe(0);
    expect(events.count("historyChange")).toBe(0);
    expect(events.count("gesturePreview")).toBe(3);
    expect(doc.history.undoCount).toBe(0);
    expect(doc.getPageShapes("1")).toHaveLength(0);
    expect(g.shapes).toHaveLength(1);
    expect(g.shapes[0]?.pageId).toBe("1");

    const tx = g.commit();
    expect(tx).not.toBeNull();
    expect(events.count("shapesChange")).toBe(1);
    expect(events.count("change")).toBe(1);
    expect(doc.history.undoCount).toBe(1);
    expect((doc.getShape("m") as RectShape).width).toBe(25);
    // the preview is cleared at the end
    const last = events.log.filter((e) => e[0] === "gesturePreview").at(-1)?.[1] as { shapes: unknown[] };
    expect(last.shapes).toEqual([]);
  });

  it("a newly drawn mark becomes the selection and clears marks on other pages", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["2", rect("old")]]);
    doc.select(["old"]);
    const g = doc.beginGesture("1")!;
    g.setPreview([rect("new")]);
    g.commit();
    expect(doc.getSelection().ids).toEqual(["new"]);
    expect([...doc.getSelection().byPage.keys()]).toEqual(["1"]);
    // undo restores the selection from before the draw
    doc.undo();
    expect(doc.getSelection().ids).toEqual(["old"]);
  });

  it("a move gesture updates in place, keeps the selection, and one undo reverts it", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("r", 10)]]);
    doc.select(["r"]);
    const g = doc.beginGesture("1", { kind: "move" })!;
    const moved: RectShape = { ...(doc.getShape("r") as RectShape), x: 70 };
    g.setPreview([moved]);
    g.commit();
    expect((doc.getShape("r") as RectShape).x).toBe(70);
    expect(doc.getSelection().ids).toEqual(["r"]);
    expect(doc.history.undoCount).toBe(2);
    doc.undo();
    expect((doc.getShape("r") as RectShape).x).toBe(10);
  });

  it("shapes in a gesture land on the gesture's page (clamp to the start page)", () => {
    const { doc } = makeDoc();
    const g = doc.beginGesture("1")!;
    g.setPreview([rect("m", 0, 0, 5, 5, { pageId: "2" })]);
    g.commit();
    expect(doc.pageOf("m")).toBe("1");
    expect(doc.getPageShapes("2")).toHaveLength(0);
  });

  it("readOnly refuses to commit a gesture", () => {
    const { doc } = makeDoc();
    const g = doc.beginGesture("1")!;
    g.setPreview([rect("m")]);
    doc.setReadOnly(true);
    expect(g.active).toBe(false);
    expect(doc.getAllShapes()).toHaveLength(0);
    expect(doc.gesture).toBeNull();
  });
});

describe("polygon on page change", () => {
  const pts = [
    { x: 10, y: 10 },
    { x: 50, y: 10 },
    { x: 30, y: 40 },
  ];

  it("finishes with 3+ points when the person clicks on another page", () => {
    const { doc } = makeDoc();
    const poly = doc.beginGesture("1", { kind: "polygon" })!;
    for (const p of pts) poly.addPoint(p);

    const next = doc.beginGesture("2", { kind: "polygon" });
    expect(next).not.toBeNull();
    expect(poly.active).toBe(false);
    const shapes = doc.getPageShapes("1");
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.type).toBe("polygon");
    expect((shapes[0] as PolygonShape).points).toHaveLength(3);
    expect(doc.getSelection().ids).toEqual([shapes[0]?.id]);
    expect(doc.gesture?.pageId).toBe("2");
  });

  it("drops it with fewer than 3 points", () => {
    const { doc } = makeDoc();
    const poly = doc.beginGesture("1", { kind: "polygon" })!;
    poly.addPoint(pts[0]!);
    poly.addPoint(pts[1]!);
    const next = doc.beginGesture("2", { kind: "polygon" });
    expect(next).not.toBeNull();
    expect(doc.getAllShapes()).toHaveLength(0);
    expect(doc.history.undoCount).toBe(0);
  });

  it("clicks on the same page do not restart it; another kind of gesture on the same page is refused", () => {
    const { doc } = makeDoc();
    const poly = doc.beginGesture("1", { kind: "polygon" })!;
    expect(doc.beginGesture("1", { kind: "polygon" })).toBeNull();
    expect(poly.active).toBe(true);
  });

  it("a non-polygon gesture is never finished by a gesture on another page", () => {
    const { doc } = makeDoc();
    const drag = doc.beginGesture("1", { kind: "draw" })!;
    expect(doc.beginGesture("2")).toBeNull();
    expect(drag.active).toBe(true);
  });

  it("changing tool finishes an open polygon", () => {
    const { doc } = makeDoc();
    doc.setTool("polygon");
    const poly = doc.beginGesture("1", { kind: "polygon" })!;
    for (const p of pts) poly.addPoint(p);
    doc.setTool("select");
    expect(poly.active).toBe(false);
    expect(ids(doc.getPageShapes("1"))).toHaveLength(1);
  });
});
