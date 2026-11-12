/**
 * The site's public address and search-result text. Server-safe (no React), so
 * metadata, robots.ts and sitemap.ts can share it at build time.
 */

export const SITE_URL = "https://doodl.n-uf.com";

/** Google shows about 60 characters of a title and 155 of a description. */
export const SITE_TITLE = "DOODL: canvas drawing and annotation for the web";
export const SITE_DESCRIPTION =
  "Draw and annotate in the browser: freehand, shapes and text markup on a canvas or on PDF pages, with JSON export. The DOODL library studio by n-uf.";

/** Share image: a 1200×630 capture of the studio's sample PDF with sample marks (public/og.png). */
export const SHARE_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "The DOODL studio showing a sample PDF page marked up with a highlight, a rectangle, an ellipse and a freehand line",
};

/** Open Graph fields shared by the layout and the home (which sets its own og:url, see app/page.tsx). */
export const OPEN_GRAPH = {
  type: "website" as const,
  siteName: "DOODL",
  locale: "en",
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  images: [SHARE_IMAGE],
};

/** Pages that hold a visitor's own drawings or settings, or internal demos: kept out of search. */
export const PRIVATE_PATHS = ["/gallery", "/settings", "/button-demo"] as const;
