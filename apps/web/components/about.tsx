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
const doodl = createDoodl({ canvas: canvasElement });`;

const LINK = "text-amber-400 underline decoration-amber-400/40 underline-offset-4 hover:decoration-amber-400";
const CODE = "block overflow-x-auto border border-zinc-800 bg-black px-4 py-3 text-xs leading-relaxed text-zinc-300";

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
        <p className="mb-3 text-[10px] tracking-widest text-zinc-400">{"// ABOUT DOODL"}</p>
        <h1 className="mb-6 text-2xl font-bold tracking-tighter text-zinc-100 sm:text-3xl">
          Canvas drawing and annotation for the web
        </h1>
        <p className="mb-4">
          DOODL is a library for drawing and annotating in the browser. It covers freehand drawing, shapes and text markup,
          on a canvas or on PDF pages, and exports your marks as JSON. The studio above is built with it, so you can try
          the tools there.
        </p>

        <h2 className="mb-3 mt-10 text-xs font-bold tracking-widest text-zinc-200">PACKAGES</h2>
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

        <h2 className="mb-3 mt-10 text-xs font-bold tracking-widest text-zinc-200">INSTALL AND USE</h2>
        <pre className="mb-3">
          <code className={CODE}>{INSTALL}</code>
        </pre>
        <pre className="mb-4">
          <code className={CODE}>{USAGE}</code>
        </pre>
        <p className="mb-10">
          React 19 is a peer dependency. DOODL is young and still changing: its API and the saved-drawing JSON are not
          final, so pin an exact version.
        </p>

        <p className="flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-800 pt-6 text-xs">
          <External href={REPO_URL}>DOODL on GitHub</External>
          <External href={NPM_URL}>@n-uf/doodl on npm</External>
          <External href={NUF_URL}>n-uf.com</External>
        </p>
        <p className="mt-4 text-xs text-zinc-400">Licence: PolyForm Perimeter 1.0.1.</p>
      </div>
    </section>
  );
}
