import { describe, expect, it } from "vitest";
import {
  computeFitHeightScale,
  computeFitModeScale,
  computeFitPageScale,
  computeFitWidthScale,
  isFitScaleActive,
  PDF_FIT_SCALE_EPSILON,
  resolveFitScale,
  resolveMeasuredAvailableSize,
} from "./fit-scale";

describe("fit-scale (uniform, axis-correct)", () => {
  const page = { width: 600, height: 900 };
  const viewport = { width: 800, height: 450 };

  it("fitWidth uses available.width / page.width only", () => {
    expect(computeFitWidthScale(viewport.width, page.width)).toBeCloseTo(
      800 / 600,
    );
    // Must not accidentally use height in the width formula
    expect(computeFitWidthScale(viewport.width, page.width)).not.toBeCloseTo(
      viewport.height / page.width,
    );
    expect(computeFitWidthScale(viewport.width, page.width)).not.toBeCloseTo(
      viewport.width / page.height,
    );
  });

  it("fitHeight uses available.height / page.height only", () => {
    expect(computeFitHeightScale(viewport.height, page.height)).toBeCloseTo(
      450 / 900,
    );
    expect(computeFitHeightScale(viewport.height, page.height)).not.toBeCloseTo(
      viewport.width / page.height,
    );
    expect(computeFitHeightScale(viewport.height, page.height)).not.toBeCloseTo(
      viewport.height / page.width,
    );
  });

  it("fitPage is min of the two uniform scales (contain)", () => {
    const scaleX = computeFitWidthScale(viewport.width, page.width);
    const scaleY = computeFitHeightScale(viewport.height, page.height);
    expect(
      computeFitPageScale(
        viewport.width,
        viewport.height,
        page.width,
        page.height,
      ),
    ).toBeCloseTo(Math.min(scaleX, scaleY));
  });

  it("fitWidth and fitHeight are not swapped for a portrait page", () => {
    const fitW = computeFitWidthScale(viewport.width, page.width);
    const fitH = computeFitHeightScale(viewport.height, page.height);
    // Portrait page in a wide-short viewport: width fit zooms in, height fit zooms out
    expect(fitW).toBeGreaterThan(1);
    expect(fitH).toBeLessThan(1);
    expect(fitW).not.toBeCloseTo(fitH);
  });

  it("computeFitModeScale dispatches to the matching axis formula", () => {
    expect(
      computeFitModeScale(
        "width",
        viewport.width,
        viewport.height,
        page.width,
        page.height,
      ),
    ).toBeCloseTo(computeFitWidthScale(viewport.width, page.width));
    expect(
      computeFitModeScale(
        "height",
        viewport.width,
        viewport.height,
        page.width,
        page.height,
      ),
    ).toBeCloseTo(computeFitHeightScale(viewport.height, page.height));
    expect(
      computeFitModeScale(
        "page",
        viewport.width,
        viewport.height,
        page.width,
        page.height,
      ),
    ).toBeCloseTo(
      computeFitPageScale(
        viewport.width,
        viewport.height,
        page.width,
        page.height,
      ),
    );
  });

  it("isFitScaleActive tolerates epsilon and rejects zoom steps", () => {
    const target = 1.25;
    expect(isFitScaleActive(target, target)).toBe(true);
    expect(isFitScaleActive(target + PDF_FIT_SCALE_EPSILON, target)).toBe(
      true,
    );
    expect(isFitScaleActive(target + PDF_FIT_SCALE_EPSILON * 2, target)).toBe(
      false,
    );
    expect(isFitScaleActive(target - 0.25, target)).toBe(false);
  });
});

describe("resolveFitScale (clamped, resize-tracking core)", () => {
  const page = { width: 600, height: 900 };
  const clampRange = { min: 0.25, max: 3 };

  it("matches the unclamped mode formula inside the clamp range", () => {
    const available = { width: 800, height: 450 };
    expect(resolveFitScale("width", available, page, clampRange)).toBeCloseTo(
      computeFitWidthScale(available.width, page.width),
    );
    expect(resolveFitScale("height", available, page, clampRange)).toBeCloseTo(
      computeFitHeightScale(available.height, page.height),
    );
    expect(resolveFitScale("page", available, page, clampRange)).toBeCloseTo(
      computeFitPageScale(
        available.width,
        available.height,
        page.width,
        page.height,
      ),
    );
  });

  it("clamps to the [min, max] range", () => {
    // Very wide container → fit-width would exceed max, gets clamped down.
    expect(
      resolveFitScale("width", { width: 6000, height: 450 }, page, clampRange),
    ).toBe(3);
    // Very small container → fit-page below min, gets clamped up.
    expect(
      resolveFitScale("page", { width: 30, height: 30 }, page, clampRange),
    ).toBe(0.25);
  });

  it("returns null when the policy's axis is unmeasurable (≤ 0)", () => {
    expect(
      resolveFitScale("width", { width: 0, height: 450 }, page, clampRange),
    ).toBeNull();
    expect(
      resolveFitScale("height", { width: 800, height: 0 }, page, clampRange),
    ).toBeNull();
    // fit-page needs BOTH axes.
    expect(
      resolveFitScale("page", { width: 800, height: 0 }, page, clampRange),
    ).toBeNull();
    expect(
      resolveFitScale("page", { width: 0, height: 450 }, page, clampRange),
    ).toBeNull();
  });

  it("recomputes a larger width fit as the container grows (resize tracking)", () => {
    const narrow = resolveFitScale(
      "width",
      { width: 600, height: 450 },
      page,
      clampRange,
    );
    const wide = resolveFitScale(
      "width",
      { width: 1200, height: 450 },
      page,
      clampRange,
    );
    expect(narrow).toBeCloseTo(1);
    expect(wide).toBeCloseTo(2);
    expect(wide).toBeGreaterThan(narrow ?? 0);
  });
});

describe("resolveMeasuredAvailableSize (measure box + insets)", () => {
  const metrics = {
    clientWidth: 800,
    clientHeight: 600,
    paddingX: 24,
    paddingY: 24,
  };

  it('"content" subtracts the container CSS padding on both axes', () => {
    expect(resolveMeasuredAvailableSize(metrics, "content")).toEqual({
      width: 800 - 24,
      height: 600 - 24,
    });
  });

  it('"client" ignores the container CSS padding (edge-to-edge)', () => {
    expect(resolveMeasuredAvailableSize(metrics, "client")).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("subtracts extra insets under either box", () => {
    const insets = { width: 2, height: 2 };
    expect(resolveMeasuredAvailableSize(metrics, "content", insets)).toEqual({
      width: 800 - 24 - 2,
      height: 600 - 24 - 2,
    });
    expect(resolveMeasuredAvailableSize(metrics, "client", insets)).toEqual({
      width: 800 - 2,
      height: 600 - 2,
    });
  });

  it("client minus content equals the CSS padding on each axis", () => {
    const content = resolveMeasuredAvailableSize(metrics, "content");
    const client = resolveMeasuredAvailableSize(metrics, "client");
    expect(client.width - content.width).toBe(metrics.paddingX);
    expect(client.height - content.height).toBe(metrics.paddingY);
  });

  it("treats missing inset axes as zero", () => {
    expect(
      resolveMeasuredAvailableSize(metrics, "client", { height: 2 }),
    ).toEqual({ width: 800, height: 598 });
  });
});
