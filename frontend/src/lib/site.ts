/**
 * The canonical prod origin — used for `<link rel="canonical">` and JSON-LD, same as
 * `og:url`/`og:image` in index.html already hardcode it. Deliberately always prod, even
 * in a dev build: a dev URL should never look like the canonical source of a page.
 */
export const SITE_URL = "https://dnaclub.com.ua";
