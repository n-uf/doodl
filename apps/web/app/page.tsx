import React from "react";
import { About } from "@/components/about";
import { Studio } from "@/components/studio";

/**
 * Home: the studio (a client component, one screen tall) and, below it, the About text as
 * server HTML with the page's <h1>, so search engines see what DOODL is without running JavaScript.
 */
export default function HomePage(): React.ReactElement {
  return (
    <>
      <Studio />
      <About />
    </>
  );
}
