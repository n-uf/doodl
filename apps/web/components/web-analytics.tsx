"use client";

import { Analytics } from "@vercel/analytics/next";

/**
 * Vercel Web Analytics (cookieless, no consent banner). It only loads in a production build; the
 * component skips development mode by itself. Every event's URL is sent without its query string,
 * which can carry ids or tokens. This is a client component because the layout is a server component
 * and cannot pass a function (beforeSend) to Analytics, which is a client component.
 */
export function WebAnalytics(): React.ReactElement {
  return (
    <Analytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        url.search = "";
        return { ...event, url: url.toString() };
      }}
    />
  );
}
