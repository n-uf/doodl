import { describe, expect, it } from "vitest";

import {
  alignedEllipseRadii,
  alignedStrokeRect,
  inflateRect,
  resolveStyleLength,
  styleRenderPadding,
} from "../common/utils/stroke";
import { isValidStyle } from "../common/utils/validation";

describe("resolveStyleLength", () => {
  it("returns page units unchanged when not screen-space", () => {
    expect(resolveStyleLength(2, false, 1.5)).toBe(2);
  });

  it("divides by scale for screen-space lengths", () => {
    expect(resolveStyleLength(2, true, 2)).toBe(1);
  });
});

describe("alignedStrokeRect", () => {
  const base = { x: 10, y: 20, width: 100, height: 40 };

  it("keeps geometry for center align", () => {
    expect(alignedStrokeRect(base, 4, "center", 2)).toEqual({
      rect: base,
      cornerRadius: 2,
    });
  });

  it("outsets by half stroke for outside align", () => {
    expect(alignedStrokeRect(base, 4, "outside", 2)).toEqual({
      rect: { x: 8, y: 18, width: 104, height: 44 },
      cornerRadius: 4,
    });
  });

  it("insets by half stroke for inside align", () => {
    expect(alignedStrokeRect(base, 4, "inside", 6)).toEqual({
      rect: { x: 12, y: 22, width: 96, height: 36 },
      cornerRadius: 4,
    });
  });
});

describe("alignedEllipseRadii", () => {
  it("inflates for outside and deflates for inside", () => {
    expect(alignedEllipseRadii(10, 8, 4, "outside")).toEqual({
      rx: 12,
      ry: 10,
    });
    expect(alignedEllipseRadii(10, 8, 4, "inside")).toEqual({
      rx: 8,
      ry: 6,
    });
  });
});

describe("inflateRect", () => {
  it("expands uniformly", () => {
    expect(inflateRect({ x: 0, y: 0, width: 10, height: 10 }, 3)).toEqual({
      x: -3,
      y: -3,
      width: 16,
      height: 16,
    });
  });
});

describe("styleRenderPadding", () => {
  it("accounts for outside stroke and outline offset", () => {
    const pad = styleRenderPadding(
      {
        strokeWidth: 2,
        strokeAlign: "outside",
        screenSpaceStroke: true,
        outline: { stroke: "#fff", strokeWidth: 2, offset: 3 },
      },
      1
    );
    expect(pad).toBeGreaterThanOrEqual(2 + 3 + 2);
  });
});

describe("isValidStyle", () => {
  it("accepts extended style fields", () => {
    expect(
      isValidStyle({
        stroke: "#000",
        strokeAlign: "outside",
        screenSpaceStroke: true,
        strokeLineCap: "round",
        strokeLineJoin: "bevel",
        miterLimit: 4,
        strokeDashOffset: 1,
        cornerRadius: 2,
        outline: {
          stroke: "#7aa5f8",
          strokeWidth: 2,
          offset: 3,
          glow: { color: "rgba(122,165,248,0.3)", blur: 12 },
        },
        shadow: { color: "rgba(0,0,0,0.2)", blur: 4, offsetX: 1, offsetY: 1 },
      })
    ).toBe(true);
  });

  it("rejects invalid strokeAlign", () => {
    expect(isValidStyle({ strokeAlign: "middle" })).toBe(false);
  });
});
