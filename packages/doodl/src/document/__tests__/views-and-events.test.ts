import { describe, expect, it } from "vitest";
import { createAnnotationDocument } from "../annotation-document";
import { addMarks, fakeView, ids, makeDoc, rect, record } from "./helpers";

describe("events fire once per transaction", () => {
  it("a three-mark, two-page transaction: shapesChange per page, one change, one selectionChange, one historyChange", () => {
    const { doc } = makeDoc();
    const events = record(doc, ["shapesChange", "change", "selectionChange", "historyChange"]);
    const tx = doc.transact("Paste", (b) => {
      b.add("1", rect("a"));
      b.add("1", rect("b"));
      b.add("2", rect("c"));
      b.select(["a", "c"]);
    });
    expect(events.count("shapesChange")).toBe(2);
    expect(events.count("change")).toBe(1);
    expect(events.count("selectionChange")).toBe(1);
    expect(events.count("historyChange")).toBe(1);

    const sel = events.log.find((e) => e[0] === "selectionChange")?.[1] as {
      ids: string[];
      byPage: Map<string, string[]>;
    };
    expect(sel.ids).toEqual(["a", "c"]);
    expect(sel.byPage.get("1")).toEqual(["a"]);
    expect(sel.byPage.get("2")).toEqual(["c"]);

    const change = events.log.find((e) => e[0] === "change")?.[1] as {
      pageIds: string[];
      transactionId: number;
    };
    expect(change.pageIds).toEqual(["1", "2"]);
    expect(change.transactionId).toBe(tx?.id);
  });

  it("a delete that also drops the selection emits selectionChange once", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("a")], ["2", rect("b")]]);
    doc.select(["a", "b"]);
    const events = record(doc, ["selectionChange", "shapesChange"]);
    doc.deleteSelected();
    expect(events.count("selectionChange")).toBe(1);
    expect(events.count("shapesChange")).toBe(2);
  });

  it("nested transact joins the outer one", () => {
    const { doc } = makeDoc();
    const events = record(doc, ["change"]);
    doc.transact("outer", (b) => {
      b.add("1", rect("a"));
      doc.transact("inner", (b2) => b2.add("2", rect("b")));
    });
    expect(events.count("change")).toBe(1);
    expect(doc.history.undoCount).toBe(1);
  });

  it("tool, style and readOnly changes emit once, and only on change", () => {
    const { doc } = makeDoc();
    const events = record(doc, ["toolChange", "styleChange", "readOnlyChange", "activePageChange"]);
    doc.setTool("rect");
    doc.setTool("rect");
    doc.setReadOnly(true);
    doc.setReadOnly(true);
    doc.setActivePage(2);
    doc.setActivePage(2);
    expect(events.count("toolChange")).toBe(1);
    expect(events.count("readOnlyChange")).toBe(1);
    expect(events.count("activePageChange")).toBe(1);
  });

  it("a throwing listener does not stop the others", () => {
    const { doc } = makeDoc();
    let heard = 0;
    doc.on("toolChange", () => {
      throw new Error("listener");
    });
    doc.on("toolChange", () => {
      heard++;
    });
    expect(() => doc.setTool("rect")).toThrow("listener");
    expect(heard).toBe(1);
    expect(doc.tool).toBe("rect");
  });

  it("unsubscribe works", () => {
    const { doc } = makeDoc();
    let n = 0;
    const off = doc.on("toolChange", () => {
      n++;
    });
    doc.setTool("rect");
    off();
    doc.setTool("ellipse");
    expect(n).toBe(1);
  });
});

describe("views, locate and ping", () => {
  it("attach and detach leave state and history unchanged; only affected pages are invalidated", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["1", rect("a1")], ["2", rect("a2")]]);
    doc.select(["a1"]);
    const v1 = fakeView();
    const v2 = fakeView();
    const d1 = doc.attachView("1", v1);
    const d2 = doc.attachView("2", v2);
    const undoCount = doc.history.undoCount;
    const snapshot = JSON.stringify(doc.getAllShapes());
    v1.invalidations = 0;
    v2.invalidations = 0;

    doc.click({ kind: "shape", id: "a2" });
    // page 1 lost its handles, page 2 gained them
    expect(v1.invalidations).toBeGreaterThan(0);
    expect(v2.invalidations).toBeGreaterThan(0);

    v1.invalidations = 0;
    v2.invalidations = 0;
    doc.transact("Move", (b) => b.update({ ...doc.getShape("a1")!, x: 40 } as never));
    expect(v1.invalidations).toBeGreaterThan(0);
    expect(v2.invalidations).toBe(0);

    d1();
    d2();
    expect(doc.viewCount("1")).toBe(0);
    doc.attachView("1", fakeView());
    expect(doc.history.undoCount).toBe(undoCount + 1);
    expect(doc.getSelection().ids).toEqual(["a2"]);
    expect(JSON.stringify(doc.getAllShapes())).not.toBe(snapshot);
    doc.undo();
    expect(JSON.stringify(doc.getAllShapes())).toBe(snapshot);
  });

  it("a ping for an unmounted page is queued and delivered when its view attaches", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["3", rect("far")]]);
    expect(doc.ping("far")).toBe(true);
    expect(doc.pendingPingIds("3")).toEqual(["far"]);

    const view = fakeView();
    doc.attachView("3", view);
    expect(view.pings).toEqual(["far"]);
    expect(doc.pendingPingIds("3")).toEqual([]);

    doc.ping("far");
    expect(view.pings).toEqual(["far", "far"]);
    expect(doc.pendingPingIds("3")).toEqual([]);
  });

  it("queued pings drop marks that no longer exist and repeat pings collapse", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["3", rect("x")], ["3", rect("y")]]);
    doc.ping("x");
    doc.ping("y");
    doc.ping("x");
    expect(doc.pendingPingIds("3")).toEqual(["y", "x"]);
    doc.setPageShapes("3", [doc.getShape("y")!]);
    const view = fakeView();
    doc.attachView("3", view);
    expect(view.pings).toEqual(["y"]);
  });

  it("ping for an unknown id returns false", () => {
    const { doc } = makeDoc();
    expect(doc.ping("nope")).toBe(false);
  });

  it("locate emits page id and bounds, selects and pings on request", () => {
    const { doc } = makeDoc();
    addMarks(doc, [["2", rect("t", 12, 14, 30, 40)]]);
    const events = record(doc, ["locate", "selectionChange"]);
    expect(doc.locate("t", { ping: true, select: true })).toBe(true);
    const loc = events.log.find((e) => e[0] === "locate")?.[1] as {
      id: string;
      pageId: string;
      bounds: { x: number; y: number; width: number; height: number };
      ping: boolean;
    };
    expect(loc.pageId).toBe("2");
    expect(loc.bounds).toEqual({ x: 12, y: 14, width: 30, height: 40 });
    expect(loc.ping).toBe(true);
    expect(doc.getSelection().ids).toEqual(["t"]);
    expect(doc.activePageId).toBe("2");
    expect(doc.pendingPingIds("2")).toEqual(["t"]);
  });

  it("locate of an unknown id is refused with a warning", () => {
    const { doc, warnings } = makeDoc();
    expect(doc.locate("nope")).toBe(false);
    expect(warnings.some((w) => w.includes("nope"))).toBe(true);
  });
});

describe("document basics", () => {
  it("normalises numeric page ids and tags marks with pageId", () => {
    const doc = createAnnotationDocument({ pages: [{ id: 5, width: 10, height: 10 }] });
    doc.setPageShapes(5, [rect("a")]);
    expect(doc.getPageShapes("5")[0]?.pageId).toBe("5");
    expect(doc.getPageInfo(5)).toEqual({ id: "5", width: 10, height: 10 });
    expect(doc.getPageIds()).toEqual(["5"]);
  });

  it("initialShapes load without history", () => {
    const { doc } = makeDoc({ initialShapes: [[1, [rect("a")]], ["2", [rect("b")]]] });
    expect(ids(doc.getAllShapes())).toEqual(["a", "b"]);
    expect(doc.canUndo()).toBe(false);
  });

  it("page lists are replaced, not mutated, and versions bump", () => {
    const { doc } = makeDoc();
    const v0 = doc.getPageVersion("1");
    addMarks(doc, [["1", rect("a")]]);
    const first = doc.getPageShapes("1");
    addMarks(doc, [["1", rect("b")]]);
    expect(first).toHaveLength(1);
    expect(doc.getPageShapes("1")).toHaveLength(2);
    expect(doc.getPageVersion("1")).toBeGreaterThan(v0);
    expect(doc.getPageVersion("2")).toBe(0);
  });

  it("warns on a duplicate selectable id across pages, but not for backdrop duplicates", () => {
    const { doc, warnings } = makeDoc();
    doc.setPageShapes("1", [rect("dup", 0, 0, 5, 5, { behavior: "backdrop" })]);
    doc.setPageShapes("2", [rect("dup", 0, 0, 5, 5, { behavior: "backdrop" })]);
    doc.getShape("dup");
    expect(warnings).toEqual([]);

    doc.setPageShapes("1", [rect("sel")]);
    doc.setPageShapes("2", [rect("sel")]);
    doc.getShape("sel");
    expect(warnings.some((w) => w.includes("duplicate"))).toBe(true);
  });

  it("the first page is active; removing it moves the active page on", () => {
    const { doc } = makeDoc();
    expect(doc.activePageId).toBe("1");
    doc.removePage("1");
    expect(doc.activePageId).toBe("2");
  });

  it("amend and shapesChange meta: host sync has a null transaction id", () => {
    const { doc } = makeDoc();
    const events = record(doc, ["shapesChange"]);
    doc.setPageShapes("1", [rect("a")]);
    expect((events.log[0]?.[3] as { transactionId: number | null; origin: string })).toMatchObject({
      transactionId: null,
      origin: "host",
    });
  });
});
