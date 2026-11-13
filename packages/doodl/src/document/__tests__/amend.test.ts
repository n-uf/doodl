import { describe, expect, it } from "vitest";
import { ids, makeDoc, rect, record } from "./helpers";

describe("amendTransaction", () => {
  function drawWithTransactionId() {
    const ctx = makeDoc();
    const events = record(ctx.doc, ["shapesChange"]);
    const g = ctx.doc.beginGesture("1", { kind: "draw" });
    g?.setPreview([rect("mark")]);
    const tx = g?.commit();
    return { ...ctx, tx: tx!, events };
  }

  it("every commit carries a transactionId on shapesChange", () => {
    const { tx, events } = drawWithTransactionId();
    const meta = events.log[0]?.[3] as { transactionId: number; origin: string; label: string };
    expect(meta.transactionId).toBe(tx.id);
    expect(meta.origin).toBe("user");
    expect(meta.label).toBe("Draw");
  });

  it("amend after a draw: one undo removes both, one redo restores both", () => {
    const { doc, tx, events } = drawWithTransactionId();
    events.clear();

    const ok = doc.amendTransaction(tx.id, {
      add: [
        { pageId: 1, shape: rect("hit1", 40, 40, 5, 5, { behavior: "backdrop" }) },
        { pageId: 2, shape: rect("hit2", 40, 40, 5, 5, { behavior: "backdrop" }) },
      ],
    });
    expect(ok).toBe(true);
    expect(ids(doc.getAllShapes()).sort()).toEqual(["hit1", "hit2", "mark"]);
    // one shapesChange per touched page, same id; amend does not add an entry
    expect(events.count("shapesChange")).toBe(2);
    for (const e of events.log) {
      expect((e[3] as { transactionId: number }).transactionId).toBe(tx.id);
    }
    expect(doc.history.undoCount).toBe(1);

    doc.undo();
    expect(doc.getAllShapes()).toHaveLength(0);
    doc.redo();
    expect(ids(doc.getAllShapes()).sort()).toEqual(["hit1", "hit2", "mark"]);
    // after redo the entry is the latest again and can be amended again
    expect(doc.amendTransaction(tx.id, (b) => b.remove("hit2"))).toBe(true);
    doc.undo();
    expect(doc.getAllShapes()).toHaveLength(0);
    doc.redo();
    expect(ids(doc.getAllShapes()).sort()).toEqual(["hit1", "mark"]);
  });

  it("amend with the builder form on a single page", () => {
    const { doc, tx } = drawWithTransactionId();
    expect(doc.amendTransaction(tx.id, (b) => b.add("1", rect("extra", 1, 1, 2, 2)))).toBe(true);
    doc.undo();
    expect(doc.getAllShapes()).toHaveLength(0);
  });

  it("refuses a stale id (not the latest entry)", () => {
    const { doc, tx } = drawWithTransactionId();
    doc.transact("Second", (b) => b.add("2", rect("second")));
    expect(doc.amendTransaction(tx.id, { add: [{ pageId: 1, shape: rect("late") }] })).toBe(false);
    expect(doc.getShape("late")).toBeUndefined();
  });

  it("refuses an id already undone, and an unknown id", () => {
    const { doc, tx } = drawWithTransactionId();
    doc.undo();
    expect(doc.amendTransaction(tx.id, { add: [{ pageId: 1, shape: rect("late") }] })).toBe(false);
    expect(doc.amendTransaction(9999, { add: [{ pageId: 1, shape: rect("late") }] })).toBe(false);
    expect(doc.getAllShapes()).toHaveLength(0);
  });

  it("refuses when the commit recorded no history entry", () => {
    const { doc } = makeDoc();
    const t = doc.transact("Backdrop", (b) => b.add("1", rect("h", 0, 0, 3, 3, { behavior: "backdrop" })));
    expect(t).not.toBeNull();
    expect(doc.amendTransaction(t!.id, (b) => b.add("1", rect("x")))).toBe(false);
  });

  it("amend is allowed for tracked and untracked marks and bypasses the tracked filter", () => {
    const { doc, tx } = drawWithTransactionId();
    doc.amendTransaction(tx.id, (b) => b.add("3", rect("derived", 0, 0, 4, 4, { behavior: "backdrop" })));
    doc.undo();
    expect(doc.getShape("derived")).toBeUndefined();
  });
});
