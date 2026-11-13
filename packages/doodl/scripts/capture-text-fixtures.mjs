#!/usr/bin/env node
/**
 * Capture per-character boxes from a real PDF.js text layer, as small JSON fixtures for the
 * word-snap tests (src/shapes/common/utils/__tests__/fixtures/*.json).
 *
 * It serves pdfjs-dist (the version pinned by the repo) and the PDF from a throwaway local
 * server, renders every page's text layer with `pdfjs.TextLayer` in headless Chromium, finds
 * each target phrase, and keeps only the visual line that holds it: the line's characters
 * (character, box, text-node index) in layer-relative CSS pixels at scale 1.
 *
 * Usage (from the repo root):
 *   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright \
 *     node packages/doodl/scripts/capture-text-fixtures.mjs [--pdf <file.pdf>] [--out <dir>]
 *
 * Playwright is not a dependency of this repo: point PLAYWRIGHT_MODULE at any installed
 * `playwright` / `playwright-core` package whose Chromium is installed (default: `playwright`
 * resolved from the current directory).
 */

import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const DEFAULT_PDF =
  "/opt/projects/pdfized/pdf-n-uf/apps/web/public/AtlasFinancialSystems-BlueForgeSoftwareEng-SoftwareDevelopmentAgreement-SAMPLE_XS.pdf";
const DEFAULT_OUT = path.resolve(
  here,
  "../src/shapes/common/utils/__tests__/fixtures"
);

/** Fixture name -> phrase that must appear on the kept line. */
const TARGETS = [
  { name: "registered-address", phrase: "Registered Address: 575 Lexington" },
  { name: "software-development", phrase: "SOFTWARE DEVELOPMENT" },
  { name: "jonathan-whitman", phrase: "Jonathan R. Whitman" },
];

const SCALE = 1.5;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const pdfPath = path.resolve(arg("pdf", DEFAULT_PDF));
const outDir = path.resolve(arg("out", DEFAULT_OUT));
if (!existsSync(pdfPath)) throw new Error(`PDF not found: ${pdfPath}`);

// pdfjs-dist, resolved the way apps/web does.
const requireFromWeb = createRequire(path.join(repoRoot, "apps/web/package.json"));
const pdfjsDir = path.dirname(requireFromWeb.resolve("pdfjs-dist/package.json"));
const pdfjsVersion = requireFromWeb("pdfjs-dist/package.json").version;

// Playwright (CommonJS entry; an absolute directory path in PLAYWRIGHT_MODULE works too).
const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const chromium = pw.chromium ?? pw.default?.chromium;

const PAGE_HTML = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/pdfjs/web/pdf_viewer.css">
<style>body{margin:0}#host{position:relative}</style></head><body><div id="host"></div></body></html>`;

const MIME = { ".mjs": "text/javascript", ".js": "text/javascript", ".css": "text/css", ".pdf": "application/pdf" };

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/") {
    res.setHeader("content-type", "text/html");
    res.end(PAGE_HTML);
    return;
  }
  let file = null;
  if (url.pathname === "/doc.pdf") file = pdfPath;
  else if (url.pathname.startsWith("/pdfjs/")) {
    file = path.join(pdfjsDir, url.pathname.slice("/pdfjs/".length));
    if (!file.startsWith(pdfjsDir)) file = null;
  }
  if (!file || !existsSync(file)) {
    res.statusCode = 404;
    res.end();
    return;
  }
  res.setHeader("content-type", MIME[path.extname(file)] ?? "application/octet-stream");
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1800 } });
  await page.goto(`http://127.0.0.1:${port}/`);

  const result = await page.evaluate(
    async ({ targets, scale }) => {
      const pdfjs = await import("/pdfjs/build/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/build/pdf.worker.min.mjs";
      const doc = await pdfjs.getDocument("/doc.pdf").promise;
      const host = document.getElementById("host");
      const found = {};

      for (let p = 1; p <= doc.numPages && Object.keys(found).length < targets.length; p++) {
        const pdfPage = await doc.getPage(p);
        const viewport = pdfPage.getViewport({ scale });
        host.innerHTML = "";
        const layer = document.createElement("div");
        layer.className = "textLayer";
        layer.style.setProperty("--scale-factor", String(scale));
        layer.style.setProperty("--total-scale-factor", String(scale));
        // pdf_viewer.css sizes the layer with round(down, ..., var(--scale-round-*)).
        layer.style.setProperty("--scale-round-x", "1px");
        layer.style.setProperty("--scale-round-y", "1px");
        host.appendChild(layer);
        const tl = new pdfjs.TextLayer({
          textContentSource: pdfPage.streamTextContent(),
          container: layer,
          viewport,
        });
        await tl.render();
        await document.fonts.ready;

        const layerRect = layer.getBoundingClientRect();
        const walker = document.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
        const chars = [];
        let nodeIndex = 0;
        for (let n = walker.nextNode(); n; n = walker.nextNode(), nodeIndex++) {
          const text = n.textContent ?? "";
          for (let i = 0; i < text.length; i++) {
            const r = document.createRange();
            r.setStart(n, i);
            r.setEnd(n, i + 1);
            const b = r.getBoundingClientRect();
            chars.push({
              c: text[i],
              r: [b.left - layerRect.left, b.top - layerRect.top, b.right - layerRect.left, b.bottom - layerRect.top],
              n: nodeIndex,
            });
          }
        }
        const full = chars.map((c) => c.c).join("");

        for (const t of targets) {
          if (found[t.name]) continue;
          const at = full.indexOf(t.phrase);
          if (at < 0) continue;
          const anchor = chars.slice(at, at + t.phrase.length);
          const cy = (c) => (c.r[1] + c.r[3]) / 2;
          const midY = anchor.reduce((s, c) => s + cy(c), 0) / anchor.length;
          const height = anchor[0].r[3] - anchor[0].r[1];
          // Whole text nodes (blank-only spans included) with a char on the same line.
          const rowNodes = new Set();
          for (const c of chars) {
            if (Math.abs(cy(c) - midY) < height / 2) rowNodes.add(c.n);
          }
          const line = chars.filter((c) => rowNodes.has(c.n));
          const remap = new Map([...rowNodes].sort((a, b) => a - b).map((n, i) => [n, i]));
          found[t.name] = {
            phrase: t.phrase,
            page: p,
            scale,
            chars: line.map((c) => ({
              c: c.c,
              r: c.r.map((v) => Math.round(v * 100) / 100),
              n: remap.get(c.n),
            })),
          };
        }
      }
      return found;
    },
    { targets: TARGETS, scale: SCALE }
  );

  mkdirSync(outDir, { recursive: true });
  for (const t of TARGETS) {
    const fx = result[t.name];
    if (!fx) throw new Error(`phrase not found in the PDF text layer: ${t.phrase}`);
    const file = path.join(outDir, `${t.name}.json`);
    const meta = {
      source: path.basename(pdfPath),
      pdfjs: pdfjsVersion,
      note: "per-character boxes of one text-layer line: c = character, r = [left, top, right, bottom] in layer pixels, n = text-node (span) index",
      phrase: fx.phrase,
      page: fx.page,
      scale: fx.scale,
    };
    // One character per line keeps the fixture small and its diffs readable.
    const head = JSON.stringify(meta, null, 1).replace(/\n}$/, "");
    const rows = fx.chars.map((c) => `  ${JSON.stringify(c)}`).join(",\n");
    writeFileSync(file, `${head},\n "chars": [\n${rows}\n ]\n}\n`);
    console.log(`${t.name}: page ${fx.page}, ${fx.chars.length} chars -> ${file}`);
  }
} finally {
  await browser.close();
  server.close();
}
