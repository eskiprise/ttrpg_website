import { useEffect } from "react";
import { SITE_URL } from "../lib/site";

function setMeta(attr: "name" | "property", key: string, content: string) {
  let tag = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setCanonical(href: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", href);
}

/**
 * Sets this page's <title>, meta description, OG title/description/url and canonical
 * link — and, with `noindex`, asks search engines to leave the page out (a "not found"
 * page is still served with HTTP 200 by the static host, so this is how Google learns
 * it isn't a real page). No react-helmet-async — for a handful of tags, a plain DOM
 * write is simpler than a dependency + <HelmetProvider> wrapper. No cleanup: the next
 * page's own useSeo call overwrites these on mount. The prerender step
 * (scripts/prerender.mjs) snapshots whatever this wrote into each page's static HTML.
 */
export function useSeo({
  title,
  description,
  path,
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}) {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setCanonical(url);
    const robots = document.querySelector('meta[name="robots"]');
    if (noindex) setMeta("name", "robots", "noindex");
    else robots?.remove();
  }, [title, description, path, noindex]);
}
