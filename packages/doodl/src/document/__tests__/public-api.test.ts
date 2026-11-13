import { describe, expect, it } from "vitest";
import * as api from "../../index";
import type {
  AnnotationDocument,
  DocumentChangeEvent,
  DocumentSelectionChangeEvent,
  DocumentTransaction,
} from "../../index";

describe("public API of the document model", () => {
  it("exports the factory and toPageId, and keeps the internals private", () => {
    expect(typeof api.createAnnotationDocument).toBe("function");
    expect(api.toPageId(7)).toBe("7");
    const exported = api as Record<string, unknown>;
    for (const internal of [
      "AnnotationDocument",
      "SelectionModel",
      "GestureLock",
      "DocumentHistory",
      "applyClick",
      "groupByPage",
      "makeSelection",
      "runDocumentCommand",
      "NUDGE_STEP",
      "NUDGE_STEP_SHIFT",
      "DEFAULT_COALESCE_MS",
      "DEFAULT_MAX_HISTORY_ENTRIES",
    ]) {
      expect(exported[internal], internal).toBeUndefined();
    }
  });

  it("the factory builds a working document typed as AnnotationDocument", () => {
    const doc: AnnotationDocument = api.createAnnotationDocument({
      pages: [{ id: 1, width: 10, height: 10 }],
    });
    const seen: DocumentChangeEvent[] = [];
    const sel: DocumentSelectionChangeEvent[] = [];
    doc.on("change", (e) => seen.push(e));
    doc.on("selectionChange", (e) => sel.push(e));
    const tx: DocumentTransaction | null = doc.transact("x", (b) =>
      b.add(1, { id: "a", type: "rect", style: doc.style })
    );
    expect(tx?.label).toBe("x");
    expect(seen).toHaveLength(1);
    expect(sel).toHaveLength(0);
  });
});
