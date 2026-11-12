import React from "react";

/**
 * What DOODL is and how to install it, as plain server-rendered HTML below the studio.
 * Facts come from the repository and package READMEs. This is the page's only <h1>.
 */

const REPO_URL = "https://github.com/n-uf/doodl";
const NPM_URL = "https://www.npmjs.com/package/@n-uf/doodl";
const NUF_URL = "https://n-uf.com";

const PACKAGES: { name: string; text: string }[] = [
  { name: "@n-uf/doodl", text: "the framework-agnostic core: rendering, hit-testing, transforms and JSON serialization." },
  { name: "@n-uf/doodl-react", text: "React bindings and a page annotation layer." },
  { name: "@n-uf/doodl-react-pdf", text: "PDF annotation components and hooks for React, using react-pdf and pdfjs-dist." },
  { name: "@n-uf/doodl-go", text: "a ready-made drawing UI shell, the one used in the studio above." },
];

const INSTALL = `pnpm add @n-uf/doodl @n-uf/doodl-react react react-dom`;

const USAGE = `import { createDoodl } from "@n-uf/doodl";
const doodl = createDoodl(canvasElement);`;

/**
 * The questions below the install notes. The same strings feed the visible text and the FAQPage JSON-LD, so the
 * markup repeats the page word for word. A `backtick` span renders as <code> on the page and loses its ticks in the JSON-LD.
 * Facts come from the repository and package READMEs and package.json files only.
 */
const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I annotate a PDF in React?",
    a: "Use `@n-uf/doodl-react-pdf`, which provides PDF annotation components and hooks for React on top of react-pdf and `@n-uf/doodl`. It needs `react`, `react-dom`, `react-pdf` and `pdfjs-dist` as peer dependencies. Call `configureDefaultPdfWorker()` once before you render a PDF, and import the browser-only components dynamically to avoid SSR issues.",
  },
  {
    q: "Does DOODL work without React?",
    a: "Yes. `@n-uf/doodl` is the framework-agnostic core, a vanilla-first canvas drawing and annotation library for the web. Install it with `pnpm add @n-uf/doodl` and start with `createDoodl(canvasElement)`. It covers rendering, hit-testing, transforms and JSON serialization, while React support lives in a separate package, `@n-uf/doodl-react`.",
  },
  {
    q: "How are drawings saved?",
    a: "DOODL serializes drawings to JSON. In `@n-uf/doodl` the saved document is a `DrawingState` with a `version` field; for PDFs, `usePdfAnnotations` from `@n-uf/doodl-react-pdf` gives per-page `SerializedPageAnnotations`. This JSON is not final, so a new release may need saved drawings converted. Pin an exact version.",
  },
  {
    q: "Which shapes and tools does DOODL have?",
    a: "DOODL has select, rectangle, ellipse, polygon, freehand, highlight, text, text highlight and text unhighlight tools. Their shortcut keys follow `TOOL_CONFIGS` in `@n-uf/doodl`: V, R, O, P, F, H, T, M and U in that order. `toToolItems()` from `@n-uf/doodl-react/tool-items` turns doodl's annotation tool definitions (five of these by default) into toolbar items.",
  },
  {
    q: "How stable is DOODL?",
    a: "DOODL is young and still changing: its API and the saved-drawing JSON are not final. Version numbers are dates (YY.M.R), not semantic versions, so any release may break things, including saved drawings that need converting. Pin an exact version and read the CHANGELOG before you upgrade. The licence is PolyForm Perimeter 1.0.1.",
  },
];

/** A FAQ answer with its `backtick` spans as <code>. */
function Answer({ text }: { text: string }): React.ReactElement {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="text-zinc-200">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** FAQPage structured data for the home: the same questions and answers as the visible text. */
const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a.replaceAll("`", "") },
  })),
};

// On a phone (max-sm) the text is 14 px at least and the footer links are 44 px tall
const LINK =
  "text-amber-400 underline decoration-amber-400/40 underline-offset-4 hover:decoration-amber-400 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center";
const CODE =
  "block overflow-x-auto border border-zinc-800 bg-black px-4 py-3 text-xs leading-relaxed text-zinc-300 max-sm:text-sm";

function External({ href, children }: { href: string; children: React.ReactNode }): React.ReactElement {
  return (
    <a href={href} target="_blank" rel="noopener" className={LINK}>
      {children}
    </a>
  );
}

export function About(): React.ReactElement {
  return (
    <section id="about" aria-label="About DOODL" className="scroll-mt-4 border-t border-zinc-800 font-mono text-zinc-400">
      <div className="mx-auto max-w-3xl px-6 py-14 text-sm leading-relaxed sm:py-20">
        <p className="mb-3 text-[10px] tracking-widest text-zinc-400 max-sm:text-sm">{"// ABOUT DOODL"}</p>
        <h1 className="mb-6 text-2xl font-bold tracking-tighter text-zinc-100 sm:text-3xl">
          Canvas drawing and annotation for the web
        </h1>
        <p className="mb-4">
          DOODL is a library for drawing and annotating in the browser. It covers freehand drawing, shapes and text markup,
          on a canvas or on PDF pages, and exports your marks as JSON. The studio above is built with it, so you can try
          the tools there.
        </p>

        <h2 className="mb-3 mt-10 text-xs font-bold tracking-widest text-zinc-200 max-sm:text-sm">PACKAGES</h2>
        <ul className="mb-4 space-y-2">
          {PACKAGES.map((p) => (
            <li key={p.name}>
              <code className="text-zinc-200">{p.name}</code>: {p.text}
            </li>
          ))}
        </ul>
        <p className="mb-4">
          In React, <code className="text-zinc-200">@n-uf/doodl-react</code> adds the drawing layer. To annotate PDF pages in
          React, add <code className="text-zinc-200">@n-uf/doodl-react-pdf</code> as well.
        </p>

        <h2 className="mb-3 mt-10 text-xs font-bold tracking-widest text-zinc-200 max-sm:text-sm">INSTALL AND USE</h2>
        <pre className="mb-3">
          <code className={CODE}>{INSTALL}</code>
        </pre>
        <pre className="mb-4">
          <code className={CODE}>{USAGE}</code>
        </pre>
        <p className="mb-4">
          The React packages need React 19 (<code className="text-zinc-200">react</code> and{" "}
          <code className="text-zinc-200">react-dom</code>) as peer dependencies; the PDF ones also need{" "}
          <code className="text-zinc-200">react-pdf</code> and <code className="text-zinc-200">pdfjs-dist</code>. DOODL is
          young and still changing: its API and the saved-drawing JSON are not final, so pin an exact version.
        </p>

        <h2 className="mb-3 mt-10 text-xs font-bold tracking-widest text-zinc-200 max-sm:text-sm">QUESTIONS</h2>
        <div className="mb-10 space-y-6">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="mb-2 font-bold text-zinc-200">{f.q}</h3>
              <p>
                <Answer text={f.a} />
              </p>
            </div>
          ))}
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD).replace(/</g, "\\u003c") }}
        />

        <p className="flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-800 pt-6 text-xs max-sm:text-sm">
          <External href={REPO_URL}>DOODL on GitHub</External>
          <External href={NPM_URL}>@n-uf/doodl on npm</External>
          <External href={NUF_URL}>n-uf.com</External>
        </p>
        <p className="mt-4 text-xs text-zinc-400 max-sm:text-sm">Licence: PolyForm Perimeter 1.0.1.</p>
      </div>
    </section>
  );
}
