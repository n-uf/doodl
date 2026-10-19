/**
 * First-party shape registration harness.
 *
 * Shape modules self-register via `registerShape()` at import time, but those
 * calls are easy for bundlers to drop when `sideEffects: false` and nothing
 * references the module exports. This file keeps the registration graph
 * reachable from the package entry and from annotation viewers.
 */

import "./ellipse/module";
import "./freehand/module";
import "./polygon/module";
import "./rect/module";
import "./region/module";
import "./text-highlight/module";
import "./text/module";

import { getShapeTypes } from "./common/registry";

let registered = false;

/**
 * Ensure built-in shape modules are registered.
 *
 * Safe to call multiple times. Prefer relying on package-entry auto-registration;
 * call explicitly from app/viewer init when consuming a tree-shaken build.
 */
export function registerBuiltinShapes(): void {
  if (registered) return;
  // Side-effect imports above perform registration. Re-checking types guards
  // against a broken graph (empty registry after import).
  if (getShapeTypes().length === 0) {
    throw new Error(
      "doodl: builtin shape modules failed to register (empty registry)",
    );
  }
  registered = true;
}

// Register when this module is evaluated (package entry / annotation layers).
registerBuiltinShapes();
