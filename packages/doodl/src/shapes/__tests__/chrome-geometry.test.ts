import { describe, expect, it } from "vitest";

import { underlineBelowRect } from "../freehand/chrome";
import { isValidStyle } from "../common/utils/validation";

const RECT = { x: 10, y: 20, width: 100, height: 30 };
const STYLE = { stroke: "#000", strokeWidth: 2 };

describe("underlineBelowRect", () => {
  it("places a full-width line below the rect bottom + gap", () => {
    const shape = underlineBelowRect(RECT, STYLE, { gap: 3 });
    expect(shape).not.toBeNull();
    const y = RECT.y + RECT.height + 3;
    expect(shape?.points).toEqual([
      { x: 10, y },
      { x: 110, y },
    ]);
    // Sharp, not smoothed.
    expect(shape?.pathMode).toBe("linear");
  });

  it("insets both sides before measuring", () => {
    const shape = underlineBelowRect(RECT, STYLE, { inset: 2 });
    expect(shape?.points[0]?.x).toBe(12);
    expect(shape?.points[1]?.x).toBe(108);
  });

  it("caps to maxWidth, start-aligned by default", () => {
    const shape = underlineBelowRect(RECT, STYLE, { maxWidth: 40, inset: 2 });
    expect(shape?.points[0]?.x).toBe(12);
    expect(shape?.points[1]?.x).toBe(52);
  });

  it("centers and end-aligns a capped line", () => {
    const centered = underlineBelowRect(RECT, STYLE, {
      maxWidth: 40,
      align: "center",
    });
    // span [10,110], length 40, slack 60 → start 40
    expect(centered?.points[0]?.x).toBe(40);
    expect(centered?.points[1]?.x).toBe(80);

    const end = underlineBelowRect(RECT, STYLE, { maxWidth: 40, align: "end" });
    expect(end?.points[0]?.x).toBe(70);
    expect(end?.points[1]?.x).toBe(110);
  });

  it("returns null when the inset span collapses", () => {
    expect(underlineBelowRect(RECT, STYLE, { inset: 60 })).toBeNull();
  });
});

describe("isValidStyle — corner-bracket outline", () => {
  it("accepts style + armLength on the outline", () => {
    expect(
      isValidStyle({
        stroke: "#000",
        outline: {
          stroke: "#7aa5f8",
          style: "corner-bracket",
          armLength: 10,
          offset: 3,
        },
      }),
    ).toBe(true);
  });

  it("rejects an unknown outline style", () => {
    expect(
      isValidStyle({ outline: { stroke: "#000", style: "dashes" } }),
    ).toBe(false);
  });
});
