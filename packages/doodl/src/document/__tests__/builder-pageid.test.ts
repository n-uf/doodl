import { describe, expect, it } from "vitest";
import { ids, makeDoc, rect, record } from "./helpers";

function twoBackdrops() {
  const ctx = makeDoc();
  const t = ctx.doc.transact("Add", (b) => b.add("1", rect("mark")))!;
  ctx.doc.setPageShapes("1", [
    ...ctx.doc.getPageShapes("1"),
    rect("hl", 0, 0, 3, 3, { behavior: "backdrop" }),
  ]);
  ctx.doc.setPageShapes("2", [rect("hl", 50, 50, 3, 3, { behavior: "backdrop" })]);
  return { ...ctx, t };
}

describe("builder update/remove/get take an optional pageId", () => {
  it("target one page's mark when a backdrop id repeats", () => {
    const { doc } = twoBackdrops();
    doc.transact(
      "Edit",
      (b) => {
        expect(b.get("hl", "2")?.pageId).toBe("2");
        expect(b.get("hl", "3")).toBeUndefined();
        b.update({ ...rect("hl", 7, 7, 3, 3, { behavior: "backdrop" }) }, 2);
        expect(b.remove("hl", 1)).toBe(true);
        expect(b.remove("hl", 3)).toBe(false);
      },
      { history: false }
    );
    expect(doc.getPageShapes("1").map((s) => s.id)).toEqual(["mark"]);
    expect(doc.getPageShapes("2")).toHaveLength(1);
    expect(doc.getPageShapes("2")[0]).toMatchObject({ x: 7, y: 7 });
  });

  it("an explicit pageId never falls back to another page", () => {
    const { doc } = twoBackdrops();
    let ok = true;
    doc.transact("x", (b) => {
      ok = b.update(rect("mark", 9), 2);
    });
    expect(ok).toBe(false);
    expect(doc.getShape("mark")).toMatchObject({ x: 10 });
  });

  it("without pageId behaviour is unchanged (shape's pageId, then the owner)", () => {
    const { doc } = twoBackdrops();
    doc.transact("x", (b) => b.update(rect("mark", 33)));
    expect(doc.getShape("mark")).toMatchObject({ x: 33 });
  });

  it("amendTransaction patch forms accept { pageId, shape } and { pageId, id }", () => {
    const { doc, t } = twoBackdrops();
    expect(
      doc.amendTransaction(t.id, {
        update: [{ pageId: 2, shape: rect("hl", 60, 60, 3, 3, { behavior: "backdrop" }) }],
        remove: [{ pageId: 1, id: "hl" }],
      })
    ).toBe(true);
    expect(ids(doc.getPageShapes("1"))).toEqual(["mark"]);
    expect(doc.getPageShapes("2")[0]).toMatchObject({ x: 60 });
    // one undo reverts the mark and the amended changes together
    doc.undo();
    expect(ids(doc.getPageShapes("1"))).toEqual(["hl"]);
    expect(doc.getPageShapes("2")[0]).toMatchObject({ x: 50 });
  });

  it("amendTransaction plain forms still work", () => {
    const { doc, t } = twoBackdrops();
    expect(doc.amendTransaction(t.id, { update: [rect("mark", 20)], remove: ["hl"] })).toBe(true);
    expect(doc.getShape("mark")).toMatchObject({ x: 20 });
  });
});

describe("amend that only changes the selection", () => {
  it("applies it, emits selectionChange, and rides along with undo and redo", () => {
    const { doc } = makeDoc();
    const g = doc.beginGesture("1")!;
    g.setPreview([rect("mark")]);
    const t = g.commit()!;
    expect(doc.getSelection().ids).toEqual(["mark"]);
    const events = record(doc, ["selectionChange", "shapesChange", "change"]);

    expect(doc.amendTransaction(t.id, (b) => b.select([]))).toBe(true);
    expect(doc.getSelection().ids).toEqual([]);
    expect(events.count("selectionChange")).toBe(1);
    expect(events.count("shapesChange")).toBe(0);
    expect((events.log[0]?.[1] as { origin: string }).origin).toBe("host");

    doc.undo();
    expect(doc.getAllShapes()).toHaveLength(0);
    doc.redo();
    expect(ids(doc.getAllShapes())).toEqual(["mark"]);
    expect(doc.getSelection().ids).toEqual([]); // the amended selection-after
  });

  it("a no-op amend is accepted without events", () => {
    const { doc } = makeDoc();
    const t = doc.transact("Add", (b) => b.add("1", rect("a")))!;
    const events = record(doc, ["selectionChange", "shapesChange", "change", "historyChange"]);
    expect(doc.amendTransaction(t.id, () => {})).toBe(true);
    expect(events.log).toEqual([]);
  });
});

describe("amending from a shapesChange listener", () => {
  it("fires change twice for the one id; amend only for a person's commit", () => {
    const { doc } = makeDoc();
    const changes: { transactionId: number | null; origin: string }[] = [];
    doc.on("change", (e) => changes.push({ transactionId: e.transactionId, origin: e.origin }));
    let amended = 0;
    doc.on("shapesChange", (pageId, _shapes, meta) => {
      if (meta.origin !== "user" || meta.transactionId === null || pageId !== "1") return;
      if (doc.getShape("derived")) return;
      doc.amendTransaction(meta.transactionId, (b) =>
        b.add("1", rect("derived", 0, 0, 3, 3, { behavior: "backdrop" }))
      );
      amended++;
    });

    doc.transact("Add", (b) => b.add("1", rect("mark")));
    expect(amended).toBe(1);
    expect(changes).toHaveLength(2);
    expect(changes[0]?.transactionId).toBe(changes[1]?.transactionId);

    doc.undo(); // origin "undo": the listener ignores it
    expect(doc.getAllShapes()).toHaveLength(0);
    expect(amended).toBe(1);
    doc.redo();
    expect(ids(doc.getAllShapes()).sort()).toEqual(["derived", "mark"]);
  });
});
