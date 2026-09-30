// Runs as "postbuild" (frontend/package.json), after `vite build` — writes dist/robots.txt
// and dist/sitemap.xml straight into the already-built output, so they ship to S3 with
// the rest of dist/ without any change to the deploy step itself.
//
// SITE_ENV distinguishes prod from dev the same way index.html's GA snippet already does
// (checking the hostname) — except robots.txt is a static file, so the check has to
// happen at build time instead. dev.dnaclub.com.ua is a real public CloudFront domain
// with nothing else stopping it from being crawled, so anything other than
// SITE_ENV=production blocks indexing entirely rather than risking a dev/prod duplicate
// in Google's index.
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");

// Vite loads frontend/.env for `vite build` itself, but this script runs as its own
// process afterwards and doesn't inherit that — so for a local `npm run build`, load it
// here too. In CI, deploy-frontend.yml already sets these as real env vars, and .env
// doesn't exist there, so this is a no-op.
try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // No .env file, or an older Node without loadEnvFile — fall back to process.env as-is.
}

const SITE_URL = "https://dnaclub.com.ua";
const isProduction = process.env.SITE_ENV === "production";
const apiBaseUrl = process.env.VITE_API_BASE_URL;

// Every public, list/detail page a visitor can reach without signing in — except
// /game-log/:pollId, deliberately left out: hundreds of one-off session write-ups would
// dilute crawl budget for no real search value, unlike a game master's or a system's own
// page, which are the enduring keyword-rich content that's actually worth indexing.
const STATIC_PATHS = ["/", "/about", "/game-masters", "/game-systems", "/game-log", "/statistics", "/signup"];

async function fetchJson(apiPath) {
  const res = await fetch(`${apiBaseUrl}${apiPath}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${apiPath} responded ${res.status}`);
  return res.json();
}

// Never fails the build: if the API is briefly down during a deploy, the sitemap just
// ships with the static paths and a warning, rather than blocking the whole release.
async function dynamicPaths() {
  if (!apiBaseUrl) return [];
  const paths = [];
  try {
    const { gameMasters } = await fetchJson("/game-masters");
    paths.push(...gameMasters.map((gm) => `/game-masters/${gm.userId}`));
  } catch (err) {
    console.warn(`[generate-seo-files] skipping game masters in sitemap: ${err.message}`);
  }
  try {
    const { systems } = await fetchJson("/game-systems");
    paths.push(...systems.map((s) => `/game-systems/${s.systemId}`));
  } catch (err) {
    console.warn(`[generate-seo-files] skipping game systems in sitemap: ${err.message}`);
  }
  return paths;
}

function writeRobots() {
  const lines = isProduction
    ? [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /telegram",
        "Disallow: /profile",
        "",
        `Sitemap: ${SITE_URL}/sitemap.xml`,
      ]
    : ["User-agent: *", "Disallow: /"];
  writeFileSync(path.join(distDir, "robots.txt"), `${lines.join("\n")}\n`);
}

function writeSitemap(paths) {
  const urls = paths.map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`).join("\n");
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urls}\n` +
    "</urlset>\n";
  writeFileSync(path.join(distDir, "sitemap.xml"), xml);
}

if (!existsSync(distDir)) {
  console.warn("[generate-seo-files] dist/ not found — did the build run first? Skipping.");
  process.exit(0);
}

writeRobots();
if (isProduction) {
  const paths = [...STATIC_PATHS, ...(await dynamicPaths())];
  writeSitemap(paths);
  console.log(`[generate-seo-files] wrote robots.txt and sitemap.xml (${paths.length} URLs)`);
} else {
  console.log("[generate-seo-files] SITE_ENV is not \"production\" — wrote a Disallow-all robots.txt, no sitemap.xml");
}
