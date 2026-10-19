/**
 * Default PDF.js worker configuration (jsDelivr CDN).
 *
 * Bundlers (Vite 8 + optimizeDeps/aliasing, Next, …) frequently break the
 * `import … from "pdfjs-dist/build/pdf.worker.min.mjs?url"` pattern, and the
 * worker version must match the `pdfjs-dist` API version exactly. Pointing
 * `GlobalWorkerOptions.workerSrc` at the version-pinned CDN build sidesteps
 * both problems, so every consumer can share one helper instead of copying
 * the URL template.
 *
 * `react-pdf` itself assigns the bare specifier `pdf.worker.mjs` on import;
 * pdf.js may also fall back to `./pdf.worker.mjs`. Neither resolves in a
 * Vite/browser ESM app, so those placeholders are treated as unset.
 */

import { pdfjs } from "react-pdf";

const PDF_WORKER_CDN_BASE = "https://cdn.jsdelivr.net/npm/pdfjs-dist";

/** Bare / relative placeholders that are not a usable worker URL. */
const PLACEHOLDER_WORKER_SRC = new Set([
  "pdf.worker.mjs",
  "./pdf.worker.mjs",
  "pdf.worker.min.mjs",
  "./pdf.worker.min.mjs",
]);

/**
 * Build the jsDelivr worker URL for a given `pdfjs-dist` version (defaults to
 * the version bundled with the active `react-pdf`, so the worker always
 * matches the API).
 */
export function pdfWorkerCdnUrl(version: string = pdfjs.version): string {
  return `${PDF_WORKER_CDN_BASE}@${version}/build/pdf.worker.min.mjs`;
}

function isUsableWorkerSrc(value: string): boolean {
  if (value.length === 0 || PLACEHOLDER_WORKER_SRC.has(value)) {
    return false;
  }
  // Absolute http(s) CDN / asset URLs, or same-origin paths Vite emitted.
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/") ||
    value.startsWith("blob:") ||
    value.startsWith("data:")
  );
}

export interface ConfigureDefaultPdfWorkerOptions {
  /** Overwrite an already-configured `workerSrc` (default: `false`). */
  force?: boolean;
  /** Pin a specific `pdfjs-dist` version (default: the bundled `pdfjs.version`). */
  version?: string;
}

/**
 * Point `pdfjs.GlobalWorkerOptions.workerSrc` at the version-pinned jsDelivr
 * CDN worker. Idempotent and non-clobbering for real consumer configs: a
 * usable existing `workerSrc` is left untouched unless `force` is set.
 * react-pdf / pdf.js placeholder bare specifiers are overwritten.
 *
 * @returns the resolved `workerSrc` (existing value when left untouched).
 */
export function configureDefaultPdfWorker(
  options: ConfigureDefaultPdfWorkerOptions = {},
): string {
  const { force = false, version } = options;
  const current = pdfjs.GlobalWorkerOptions.workerSrc;
  const alreadySet =
    typeof current === "string" && isUsableWorkerSrc(current);
  if (alreadySet && !force) {
    return current;
  }
  const url = pdfWorkerCdnUrl(version);
  pdfjs.GlobalWorkerOptions.workerSrc = url;
  return url;
}
