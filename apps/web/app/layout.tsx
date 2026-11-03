import type { Metadata } from "next";
import { StudioProvider } from "@/components/providers";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "./site";
import "./globals.css";

// PDF.js styles
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "DOODL", locale: "en", url: "/", title: SITE_TITLE, description: SITE_DESCRIPTION },
  twitter: { card: "summary", title: SITE_TITLE, description: SITE_DESCRIPTION },
  icons: {
    icon: "/favicon.ico",
  },
};

/** n-uf, who makes DOODL; the same node id on every n-uf site */
const ORG = { "@type": "Organization", "@id": "https://n-uf.com/#org", name: "n-uf", url: "https://n-uf.com", sameAs: ["https://github.com/n-uf"] };

/** Structured data (JSON-LD) for search engines and AI tools: this site, the library it shows, and n-uf. */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "DOODL", url: SITE_URL, description: SITE_DESCRIPTION, publisher: { "@id": ORG["@id"] } },
    {
      "@type": "SoftwareSourceCode",
      name: "DOODL",
      description: "Canvas drawing and annotation library for the web: freehand, shapes, text markup, PDF pages, JSON export.",
      url: SITE_URL,
      codeRepository: "https://github.com/n-uf/doodl",
      programmingLanguage: "TypeScript",
      runtimePlatform: "React",
      author: { "@id": ORG["@id"] },
    },
    ORG,
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c") }}
        />
      </head>
      <body className="antialiased">
        <StudioProvider>{children}</StudioProvider>
      </body>
    </html>
  );
}

