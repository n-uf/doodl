import type { MetadataRoute } from "next";
import { SITE_URL } from "./site";

/** Only the studio itself: the gallery and settings hold a visitor's own data (see PRIVATE_PATHS). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 }];
}
