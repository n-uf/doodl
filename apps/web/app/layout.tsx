import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { StudioProvider } from "@/components/providers";
import { OPEN_GRAPH, SHARE_IMAGE, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "./site";
import "./globals.css";

/**
 * Self-hosted by next/font (downloaded at build, served from this site): no render-blocking request to Google Fonts.
 * Its @font-face rules are named "JetBrains Mono", which globals.css uses by name (see the note there).
 */
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

// PDF.js styles
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  // The home sets its own canonical, with the trailing slash (see app/page.tsx); the other pages inherit this one.
  alternates: { canonical: "/" },
  openGraph: { ...OPEN_GRAPH, url: "/" },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [SHARE_IMAGE.url] },
  // Google wants a square SVG or a PNG whose side is a multiple of 48; /favicon.ico is the root fallback.
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-96.png", type: "image/png", sizes: "96x96" },
      { url: "/favicon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

/** n-uf, who makes DOODL; the same node id on every n-uf site */
const ORG = { "@type": "Organization", "@id": "https://n-uf.com/#org", name: "n-uf", url: "https://n-uf.com", sameAs: ["https://github.com/n-uf"] };

/** Structured data (JSON-LD) for search engines and AI tools: this site, the library it shows, and n-uf. */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "DOODL", url: `${SITE_URL}/`, description: SITE_DESCRIPTION, publisher: { "@id": ORG["@id"] } },
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
    <html lang="en" className={jetbrainsMono.variable} suppressHydrationWarning>
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

