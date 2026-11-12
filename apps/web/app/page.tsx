import type { Metadata } from "next";
import React from "react";
import { About } from "@/components/about";
import { Studio } from "@/components/studio";
import { OPEN_GRAPH, SITE_URL } from "./site";

// Next's metadata API strips the root canonical's trailing slash, but the sitemap lists "https://doodl.n-uf.com/".
// So the home turns the metadata canonical off and renders its own <link> below (React hoists it into <head>).
// og:url has the same problem, so the home drops it from its metadata (openGraph here replaces the layout's whole
// object, hence the shared fields) and writes the tag below.
export const metadata: Metadata = { alternates: { canonical: null }, openGraph: OPEN_GRAPH };

/**
 * Home: the studio (a client component, one screen tall) and, below it, the About text as
 * server HTML with the page's <h1>, so search engines see what DOODL is without running JavaScript.
 */
export default function HomePage(): React.ReactElement {
  return (
    <>
      <link rel="canonical" href={`${SITE_URL}/`} />
      <meta property="og:url" content={`${SITE_URL}/`} />
      <Studio />
      <About />
    </>
  );
}
