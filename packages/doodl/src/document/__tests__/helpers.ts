import { createRectShape } from "../../shapes/rect/types";
import type { RectShape } from "../../shapes/rect/types";
import { registerBuiltinShapes } from "../../shapes/register-builtins";
import type { DrawShape } from "../../shapes/common/types/shape";
import { AnnotationDocument } from "../annotation-document";
import type {
  AnnotationDocumentOptions,
  DocumentEventName,
  DocumentEvents,
  DocumentPageView,
  DocShape,
} from "../types";

registerBuiltinShapes();

export function rect(
  id: string,
  x = 10,
  y = 10,
  w = 20,
  h = 20,
  extra: Partial<DrawShape> = {}
): RectShape {
  return { ...createRectShape(x, y, w, h), id, ...extra } as RectShape;
}

/** A document with pages "1", "2", "3" (100 x 200 each) and a manual clock. */
export function makeDoc(options: AnnotationDocumentOptions = {}) {
  const clock = { t: 1_000 };
  const warnings: string[] = [];
  const doc = new AnnotationDocument({
    pages: [
      { id: 1, width: 100, height: 200 },
      { id: 2, width: 100, height: 200 },
      { id: 3, width: 100, height: 200 },
    ],
    now: () => clock.t,
    warn: (m) => warnings.push(m),
    ...options,
  });
  return { doc, clock, warnings };
}

/** Record every event of the given names as `[name, ...args]`. */
export function record(doc: AnnotationDocument, names: DocumentEventName[]) {
  const log: unknown[][] = [];
  for (const name of names) {
    doc.on(name, ((...args: unknown[]) => {
      log.push([name, ...args]);
    }) as DocumentEvents[typeof name]);
  }
  return {
    log,
    count: (name: DocumentEventName) => log.filter((e) => e[0] === name).length,
    clear: () => {
      log.length = 0;
    },
  };
}

/** A fake page view that counts what the document does to it. */
export function fakeView() {
  const view: DocumentPageView & { invalidations: number; pings: string[] } = {
    invalidations: 0,
    pings: [],
    invalidate() {
      view.invalidations++;
    },
    ping(id) {
      view.pings.push(id);
    },
  };
  return view;
}

export const ids = (shapes: readonly DocShape[]): string[] => shapes.map((s) => s.id);

/** Add marks one per transaction (one history entry each). */
export function addMarks(
  doc: AnnotationDocument,
  marks: [pageId: string, shape: DrawShape][]
): void {
  for (const [pageId, shape] of marks) {
    doc.transact("Add", (tx) => tx.add(pageId, shape));
  }
}
