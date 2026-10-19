import { describe, expect, it } from "vitest";

import { getShapeModuleByType, getShapeTypes } from "../common/registry";
import { registerBuiltinShapes } from "../register-builtins";

describe("registerBuiltinShapes", () => {
  it("registers first-party shape modules including rect", () => {
    registerBuiltinShapes();

    const types = getShapeTypes();
    expect(types).toEqual(
      expect.arrayContaining([
        "rect",
        "ellipse",
        "polygon",
        "freehand",
        "text",
        "text-highlight",
        "region",
      ]),
    );
    expect(getShapeModuleByType("rect")).toBeDefined();
  });

  it("is idempotent", () => {
    registerBuiltinShapes();
    registerBuiltinShapes();
    expect(getShapeModuleByType("rect")).toBeDefined();
  });
});
