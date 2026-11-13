import { describe, expect, it } from "vitest";
import { createPolygonShape } from "../../shapes/polygon/types";
import type { PolygonShape } from "../../shapes/polygon/types";
import { makeDoc } from "./helpers";

const clicks = [
  { x: 10, y: 10 },
  { x: 50, y: 10 },
  { x: 30, y: 40 },
];

describe("polygon policy with a preview set (Q12)", () => {
  it("2 clicks plus a preview with a cursor vertex are dropped on page change", () => {
    const { doc } = makeDoc();
    const poly = doc.beginGesture("1", { kind: "polygon" })!;
    poly.addPoint(clicks[0]!);
    poly.addPoint(clicks[1]!);
    poly.setPreview([createPolygonShape([clicks[0]!, clicks[1]!, { x: 80, y: 80 }])]);

    expect(doc.beginGesture("2", { kind: "polygon" })).not.toBeNull();
    expect(poly.active).toBe(false);
    expect(doc.getAllShapes()).toHaveLength(0);
    expect(doc.canUndo()).toBe(false);
  });

  it("3 clicks plus a preview with a cursor vertex commit the 3 clicks, keeping the preview's id and style", () => {
    const { doc } = makeDoc();
    const poly = doc.beginGesture("1", { kind: "polygon" })!;
    for (const p of clicks) poly.addPoint(p);
    const preview = createPolygonShape([...clicks, { x: 99, y: 99 }], {
      ...doc.style,
      stroke: "#123456",
    });
    preview.id = "preview-id";
    poly.setPreview([preview]);

    doc.beginGesture("2", { kind: "polygon" });
    const shapes = doc.getPageShapes("1");
    expect(shapes).toHaveLength(1);
    const committed = shapes[0] as PolygonShape;
    expect(committed.id).toBe("preview-id");
    expect(committed.points).toEqual(clicks);
    expect(committed.style.stroke).toBe("#123456");
  });

  it("commit() directly with a preview and 2 clicks drops it", () => {
    const { doc } = makeDoc();
    const poly = doc.beginGesture("1", { kind: "polygon" })!;
    poly.addPoint(clicks[0]!);
    poly.addPoint(clicks[1]!);
    poly.setPreview([createPolygonShape(clicks)]);
    expect(poly.commit()).toBeNull();
    expect(doc.getAllShapes()).toHaveLength(0);
    expect(doc.gesture).toBeNull();
  });
});
