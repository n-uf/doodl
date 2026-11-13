/**
 * Document commands: a pure handler over an AnnotationDocument, with no DOM.
 * A key binder maps keys to these; hosts wire their own buttons to
 * `doc.command(...)`; tests run them in node.
 */

import { getShapeBounds, transformShape } from "../shapes/common/dispatch";
import { isEditable } from "../types/behavior";
import type { Bounds } from "../types/geometry";
import type { AnnotationDocument } from "./annotation-document";
import type { DocShape, DocumentCommand, PageId } from "./types";

/** Nudge distance in page units, and with Shift. */
export const NUDGE_STEP = 1;
export const NUDGE_STEP_SHIFT = 10;

/**
 * Run a command. Returns true when it did something (the key binder then swallows
 * the key); false leaves the key to the host (for example arrows for page navigation
 * when nothing is selected).
 */
export function runDocumentCommand(
  doc: AnnotationDocument,
  command: DocumentCommand
): boolean {
  if (typeof command === "string") {
    switch (command) {
      case "delete":
        return doc.deleteSelected();
      case "undo":
        return doc.undo();
      case "redo":
        return doc.redo();
      case "escape":
        return escapeCommand(doc);
      case "selectAll":
        return doc.selectAll();
    }
  }
  if ("nudge" in command) return nudgeSelection(doc, command.nudge[0], command.nudge[1]);
  if ("undo" in command) return doc.undo(command.undo);
  return doc.redo(command.redo);
}

/** Escape cancels the gesture if one is running, else clears the selection. */
function escapeCommand(doc: AnnotationDocument): boolean {
  const gesture = doc.gesture;
  if (gesture) {
    gesture.cancel();
    return true;
  }
  return doc.clearSelection("user");
}

/**
 * Move the editable selected marks by (dx, dy), as one coalesced transaction.
 * Each page's marks move together and are clamped so their union stays inside
 * that page (a union already outside is only allowed to move back in).
 */
function nudgeSelection(doc: AnnotationDocument, dx: number, dy: number): boolean {
  if (doc.readOnly || doc.gesture) return false;
  const { byPage } = doc.getSelection();
  if (byPage.size === 0 || (dx === 0 && dy === 0)) return false;

  const moves: { shape: DocShape; dx: number; dy: number }[] = [];
  for (const [pageId, ids] of byPage) {
    const shapes = ids
      .map((id) => doc.getShape(id))
      .filter((s): s is DocShape => !!s && isEditable(s.behavior));
    if (shapes.length === 0) continue;
    const [cx, cy] = clampDelta(doc, pageId, shapes, dx, dy);
    if (cx === 0 && cy === 0) continue;
    for (const shape of shapes) moves.push({ shape, dx: cx, dy: cy });
  }
  if (moves.length === 0) return false;

  const tx = doc.transact(
    "Nudge",
    (b) => {
      for (const m of moves) b.update(transformShape(m.shape, { x: m.dx, y: m.dy }));
    },
    { origin: "user", coalesceKey: "nudge" }
  );
  return tx !== null;
}

function clampDelta(
  doc: AnnotationDocument,
  pageId: PageId,
  shapes: readonly DocShape[],
  dx: number,
  dy: number
): [number, number] {
  const page = doc.getPageInfo(pageId);
  if (!page) return [dx, dy];
  const union = unionBounds(shapes.map((s) => getShapeBounds(s)));
  const right = union.x + union.width;
  const bottom = union.y + union.height;
  const lowX = union.x > 0 ? -union.x : 0;
  const highX = right < page.width ? page.width - right : 0;
  const lowY = union.y > 0 ? -union.y : 0;
  const highY = bottom < page.height ? page.height - bottom : 0;
  return [
    Math.min(Math.max(dx, lowX), highX),
    Math.min(Math.max(dy, lowY), highY),
  ];
}

function unionBounds(list: readonly Bounds[]): Bounds {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of list) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
