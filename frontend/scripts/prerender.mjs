// Prerendering: runs after generate-seo-files.mjs (postbuild), only when PRERENDER=1 —
// the deploy workflow sets it; a local `npm run build` skips it. Opens every page in the
// sitemap in headless Chrome, waits for it to fetch its data, and saves the rendered
// HTML as dist/_pre/<path>.html. CloudFront (aws_infra's frontend function) serves that
// file for the page's real URL, so search engines and AI crawlers get the page's text
// and links without running any JavaScript, and visitors see the page at first paint.
// In the browser, main.tsx swaps the static copy for the live app once it has its data.
//
// Never fails the build: with no Chrome, or the API down, pages are simply left out and
// fall back to the plain SPA shell, exactly as before prerendering existed.
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchSiteData, sitePaths, systemPath } from "./generate-seo-files.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const outDir = path.join(distDir, "_pre");

const SITE_URL = "https://dnaclub.com.ua";
const CONCURRENCY = 4;
const PAGE_TIMEOUT_MS = 20_000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".txt": "text/plain",
  ".xml": "application/xml",
};

function log(message) {
  console.log(`[prerender] ${message}`);
}

/** Shows up as an annotation on the GitHub Actions run, not just a line in the log. */
function warn(message) {
  console.warn(process.env.GITHUB_ACTIONS ? `::warning title=prerender::${message}` : `[prerender] ${message}`);
}

function escapeAttr(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function escapeText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/** Replaces the content of an existing <meta> in the shell (they're spread over lines). */
function setMeta(html, attr, value) {
  if (value == null) return html;
  const pattern = new RegExp(`(<meta\\s+${attr}\\s+content=")[^"]*(")`);
  if (!pattern.test(html)) return html.replace("</head>", `  <meta ${attr} content="${escapeAttr(value)}" />\n  </head>`);
  return html.replace(pattern, `$1${escapeAttr(value)}$2`);
}

/** The SPA shell, filled in with one page's head tags and rendered markup. */
function compose(shell, snap) {
  let html = shell.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeText(snap.title)}</title>`);
  html = setMeta(html, 'name="description"', snap.description);
  html = setMeta(html, 'property="og:title"', snap.ogTitle);
  html = setMeta(html, 'property="og:description"', snap.ogDescription);
  html = setMeta(html, 'property="og:url"', snap.ogUrl);
  html = html.replace("</head>", `  <link rel="canonical" href="${escapeAttr(snap.canonical)}" />\n  </head>`);
  return html.replace('<div id="root"></div>', `<div id="root" data-prerendered>${snap.root}</div>`);
}

/**
 * For a page's old address (a system's id, or a slug it had before): an instant meta
 * refresh, which Google treats as a permanent redirect — the closest a static file gets
 * to a 301 without the CDN having to know every old address.
 */
function redirectStub(target) {
  const url = `${SITE_URL}${target}`;
  return `<!doctype html>
<html lang="uk">
  <head>
    <meta charset="UTF-8" />
    <title>Dice &amp; Adventures Club</title>
    <link rel="canonical" href="${escapeAttr(url)}" />
    <meta http-equiv="refresh" content="0; url=${escapeAttr(target)}" />
  </head>
  <body>
    <a href="${escapeAttr(target)}">${escapeText(url)}</a>
  </body>
</html>
`;
}

function outFile(route) {
  return path.join(outDir, route === "/" ? "index.html" : `${route.slice(1)}.html`);
}

async function writeOut(route, html) {
  const file = outFile(route);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}

/**
 * dist/ over HTTP, with the SPA fallback — plus /__api/*, a same-origin pass-through to
 * the real API: the API only allows the site's own origins (CORS), not this server's.
 */
async function startServer(apiBaseUrl, shell) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/__api/")) {
      if (req.method !== "GET") {
        res.writeHead(405).end();
        return;
      }
      try {
        const upstream = await fetch(`${apiBaseUrl}${url.pathname.slice("/__api".length)}${url.search}`, {
          signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        });
        res.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") ?? "application/json" });
        res.end(Buffer.from(await upstream.arrayBuffer()));
      } catch {
        res.writeHead(502).end();
      }
      return;
    }
    const file = path.join(distDir, decodeURIComponent(url.pathname));
    if (file.startsWith(distDir + path.sep) && path.extname(file) && existsSync(file)) {
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
      res.end(await readFile(file));
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[".html"] }).end(shell);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function renderPage(context, origin, route) {
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (err) => problems.push(`script error: ${err.message}`));
  page.on("response", (res) => {
    if (res.url().includes("/__api/") && res.status() >= 400) problems.push(`API ${res.status()} ${res.url()}`);
  });
  page.on("requestfailed", (req) => {
    if (req.url().includes("/__api/")) problems.push(`API request failed ${req.url()}`);
  });
  try {
    await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__APP_SETTLED__ === true, null, { timeout: PAGE_TIMEOUT_MS });
    const snap = await page.evaluate(() => {
      const meta = (selector) => document.querySelector(selector)?.getAttribute("content") ?? null;
      return {
        title: document.title,
        description: meta('meta[name="description"]'),
        ogTitle: meta('meta[property="og:title"]'),
        ogDescription: meta('meta[property="og:description"]'),
        ogUrl: meta('meta[property="og:url"]'),
        robots: meta('meta[name="robots"]'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
        root: document.getElementById("root")?.innerHTML ?? "",
      };
    });
    // A page that came out broken or "not found" is worse as static HTML than none at
    // all — without a file, the URL just gets the SPA shell, as before prerendering.
    if (problems.length) throw new Error(problems.join("; "));
    if (snap.robots?.includes("noindex")) throw new Error("page marked itself noindex");
    if (snap.canonical !== `${SITE_URL}${route}`) throw new Error(`canonical is ${snap.canonical}`);
    if (!snap.root.trim()) throw new Error("nothing rendered");
    return snap;
  } finally {
    await page.close();
  }
}

if (process.env.PRERENDER !== "1") {
  log("PRERENDER is not 1 — skipping (it's a deploy-time step; the build itself is complete).");
  process.exit(0);
}
if (!existsSync(path.join(distDir, "index.html"))) {
  warn("dist/index.html not found — did the build run first? Skipping.");
  process.exit(0);
}
const apiBaseUrl = process.env.VITE_API_BASE_URL;
if (!apiBaseUrl) {
  warn("VITE_API_BASE_URL is not set — skipping.");
  process.exit(0);
}

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch (err) {
  warn(`playwright-core is not installed (${err.message}) — skipping.`);
  process.exit(0);
}

const shell = await readFile(path.join(distDir, "index.html"), "utf8");
const data = await fetchSiteData();
const routes = sitePaths(data);
const server = await startServer(apiBaseUrl, shell);
const origin = `http://127.0.0.1:${server.address().port}`;

let browser;
try {
  // The machine's own Chrome (preinstalled on GitHub's ubuntu runners) — no browser download.
  browser = await chromium.launch({ channel: "chrome" });
} catch (err) {
  warn(`couldn't start Chrome (${err.message.split("\n")[0]}) — skipping.`);
  server.close();
  process.exit(0);
}

const context = await browser.newContext({
  locale: "uk-UA",
  timezoneId: "Europe/Kyiv",
  viewport: { width: 1280, height: 900 },
  colorScheme: "light",
});
// Route the app's API calls through the same-origin pass-through above.
await context.addInitScript((base) => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) =>
    typeof input === "string" && input.startsWith(base)
      ? originalFetch(`/__api${input.slice(base.length)}`, init)
      : originalFetch(input, init);
}, apiBaseUrl);
// Images, fonts and the Google Calendar/Maps embeds don't change the markup — skip them.
await context.route("**/*", (route) => {
  const request = route.request();
  const type = request.resourceType();
  const external = !request.url().startsWith(origin);
  if (type === "image" || type === "media" || type === "font" || (external && type === "document")) return route.abort();
  return route.continue();
});

let written = 0;
const failed = [];
const queue = [...routes];
async function worker() {
  for (let route = queue.shift(); route !== undefined; route = queue.shift()) {
    try {
      const snap = await renderPage(context, origin, route);
      await writeOut(route, compose(shell, snap));
      written += 1;
    } catch (err) {
      failed.push(`${route}: ${err.message.split("\n")[0]}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// Old system addresses: the id-based URLs from before slugs, and slugs since changed.
let redirects = 0;
for (const system of data.systems) {
  const target = systemPath(system);
  const oldPaths = [system.systemId, ...(system.previousSlugs ?? [])]
    .map((segment) => `/game-systems/${segment}`)
    .filter((oldPath) => oldPath !== target);
  for (const oldPath of oldPaths) {
    await writeOut(oldPath, redirectStub(target));
    redirects += 1;
  }
}

await browser.close();
server.close();

log(`wrote ${written}/${routes.length} pages and ${redirects} redirects to dist/_pre/`);
for (const failure of failed) warn(`skipped ${failure}`);
