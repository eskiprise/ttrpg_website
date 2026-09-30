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
 * Sets this page's <title>, meta description, OG title/description and canonical link.
 * No react-helmet-async — for a handful of tags with no SSR involved, a plain DOM write
 * is simpler than a dependency + <HelmetProvider> wrapper. No cleanup: the next page's
 * own useSeo call overwrites these on mount, so there's nothing to restore on unmount.
 */
export function useSeo({ title, description, path }: { title: string; description: string; path: string }) {
  useEffect(() => {
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setCanonical(`${SITE_URL}${path}`);
  }, [title, description, path]);
}
