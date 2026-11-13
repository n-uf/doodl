/**
 * Two-page fixture for browser repro tests.
 *
 * Two plain divs stacked with a gap (no PDF), each hosting a
 * `PageAnnotationLayer` the way consumers mount one today: one layer per
 * page, controlled `shapes`, `onShapesChange` written back to host state.
 * The fixture only observes through the public API (`onShapesChange` and the
 * controller getters).
 */

import type { DrawShape, DrawTool } from "@n-uf/doodl";
import React, { useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PageAnnotationLayer } from "../page-annotation-layer";
import type { PageAnnotationController } from "../page-annotation-controller";

export const PAGE_WIDTH = 300;
export const PAGE_HEIGHT = 200;
export const PAGE_GAP = 40;

export type PageNumber = 1 | 2;

/** One `onShapesChange` notification of a page's layer. */
export interface FixtureEvent {
  page: PageNumber;
  shapes: DrawShape[];
}

export interface TwoPageFixtureProps {
  scale: number;
  tool: DrawTool;
  controllerRefs: [
    React.MutableRefObject<PageAnnotationController | null>,
    React.MutableRefObject<PageAnnotationController | null>,
  ];
  /** Every `onShapesChange` notification, in order. */
  log: FixtureEvent[];
}

function Page(props: {
  page: PageNumber;
  scale: number;
  tool: DrawTool;
  controllerRef: React.MutableRefObject<PageAnnotationController | null>;
  log: FixtureEvent[];
}): React.ReactElement {
  const { page, scale, tool, controllerRef, log } = props;
  const [shapes, setShapes] = useState<DrawShape[]>([]);

  return (
    <div
      data-testid={`page-${page}`}
      style={{
        position: "relative",
        width: Math.round(PAGE_WIDTH * scale),
        height: Math.round(PAGE_HEIGHT * scale),
        background: "#fff",
        boxShadow: "0 0 0 1px #888",
      }}
    >
      <PageAnnotationLayer
        pageWidth={PAGE_WIDTH}
        pageHeight={PAGE_HEIGHT}
        scale={scale}
        tool={tool}
        shapes={shapes}
        controllerRef={controllerRef}
        style_={{ position: "absolute" }}
        onShapesChange={(next) => {
          log.push({ page, shapes: next });
          setShapes(next);
        }}
      />
    </div>
  );
}

export function TwoPageFixture(props: TwoPageFixtureProps): React.ReactElement {
  const { scale, tool, controllerRefs, log } = props;
  return (
    <div
      data-testid="doc-root"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: PAGE_GAP,
        padding: 20,
        width: "fit-content",
      }}
    >
      <Page
        page={1}
        scale={scale}
        tool={tool}
        controllerRef={controllerRefs[0]}
        log={log}
      />
      <Page
        page={2}
        scale={scale}
        tool={tool}
        controllerRef={controllerRefs[1]}
        log={log}
      />
    </div>
  );
}

export interface MountedFixture {
  /** Every `onShapesChange` notification, in order. */
  log: FixtureEvent[];
  /** The controller the layer of that page exposes through `controllerRef`. */
  controller(page: PageNumber): PageAnnotationController;
  /** The canvas element a page's layer currently draws on. */
  canvas(page: PageNumber): HTMLCanvasElement;
  /** Re-render with a new tool and/or scale (what a toolbar or zoom does). */
  update(next: { scale?: number; tool?: DrawTool }): Promise<void>;
  unmount(): void;
}

async function until<T>(read: () => T | null | undefined): Promise<T> {
  const deadline = Date.now() + 5000;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) throw new Error("fixture: timed out waiting");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Mount the two-page fixture into `document.body` and wait until both layers are live. */
export async function mountTwoPageFixture(
  initial: { scale?: number; tool?: DrawTool } = {},
): Promise<MountedFixture> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root: Root = createRoot(host);

  const log: FixtureEvent[] = [];
  const controllerRefs: TwoPageFixtureProps["controllerRefs"] = [
    { current: null },
    { current: null },
  ];
  let state = { scale: initial.scale ?? 1, tool: initial.tool ?? "rect" };

  const render = (): void => {
    root.render(
      <TwoPageFixture
        scale={state.scale}
        tool={state.tool}
        controllerRefs={controllerRefs}
        log={log}
      />,
    );
  };

  const canvasOf = (page: PageNumber): HTMLCanvasElement | null =>
    host.querySelector<HTMLCanvasElement>(`[data-testid="page-${page}"] canvas`);

  render();
  await until(() => controllerRefs[0].current && controllerRefs[1].current);
  await until(() => canvasOf(1) && canvasOf(2));
  // The layer pushes the tool to the controller in an effect after mount.
  await until(() => controllerRefs[0].current?.getTool() === state.tool);

  return {
    log,
    controller: (page) => {
      const controller = controllerRefs[page - 1]!.current;
      if (!controller) throw new Error(`no controller for page ${page}`);
      return controller;
    },
    canvas: (page) => {
      const canvas = canvasOf(page);
      if (!canvas) throw new Error(`no canvas for page ${page}`);
      return canvas;
    },
    update: async (next) => {
      state = { ...state, ...next };
      render();
      await until(
        () =>
          controllerRefs[0].current?.getTool() === state.tool &&
          controllerRefs[1].current?.getTool() === state.tool &&
          controllerRefs[0].current?.getScale() === state.scale &&
          controllerRefs[1].current?.getScale() === state.scale,
      );
      // Let any canvas re-attach (effects keyed on the canvas size) settle.
      await new Promise((resolve) => setTimeout(resolve, 50));
    },
    unmount: () => {
      root.unmount();
      host.remove();
    },
  };
}
