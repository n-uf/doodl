/**
 * The site's public address and search-result text. Server-safe (no React), so
 * metadata, robots.ts and sitemap.ts can share it at build time.
 */

export const SITE_URL = "https://doodl.n-uf.com";

/** Google shows about 60 characters of a title and 155 of a description. */
export const SITE_TITLE = "DOODL: canvas drawing and annotation for the web";
export const SITE_DESCRIPTION =
  "Draw and annotate in the browser: freehand, shapes and text markup on a canvas or on PDF pages, with JSON export. The DOODL library studio by n-uf.";

/** Pages that hold a visitor's own drawings or settings, or internal demos: kept out of search. */
export const PRIVATE_PATHS = ["/gallery", "/settings", "/button-demo"] as const;
