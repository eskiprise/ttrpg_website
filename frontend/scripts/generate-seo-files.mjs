// Runs as "postbuild" (frontend/package.json), after `vite build` — writes dist/robots.txt,
// dist/sitemap.xml and dist/llms.txt straight into the already-built output, so they ship
// to S3 with the rest of dist/ without any change to the deploy step itself.
//
// SITE_ENV distinguishes prod from dev the same way index.html's GA snippet already does
// (checking the hostname) — except robots.txt is a static file, so the check has to
// happen at build time instead. dev.dnaclub.com.ua is a real public CloudFront domain
// with nothing else stopping it from being crawled, so anything other than
// SITE_ENV=production blocks indexing entirely rather than risking a dev/prod duplicate
// in Google's index.
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
// scripts/prerender.mjs imports this list too: the pages in the sitemap are exactly the
// pages that get a prerendered static HTML.
export const STATIC_PATHS = ["/", "/about", "/game-masters", "/game-systems", "/game-log", "/statistics", "/signup"];

async function fetchJson(apiPath) {
  const res = await fetch(`${apiBaseUrl}${apiPath}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${apiPath} responded ${res.status}`);
  return res.json();
}

/** A system's page path: its readable slug once the API serves one, else its id. */
export function systemPath(system) {
  return `/game-systems/${system.slug ?? system.systemId}`;
}

// Never fails the build: if the API is briefly down during a deploy, the sitemap just
// ships with the static paths and a warning, rather than blocking the whole release.
export async function fetchSiteData() {
  const data = { gameMasters: [], systems: [] };
  if (!apiBaseUrl) return data;
  try {
    data.gameMasters = (await fetchJson("/game-masters")).gameMasters;
  } catch (err) {
    console.warn(`[generate-seo-files] skipping game masters: ${err.message}`);
  }
  try {
    data.systems = (await fetchJson("/game-systems")).systems;
  } catch (err) {
    console.warn(`[generate-seo-files] skipping game systems: ${err.message}`);
  }
  return data;
}

export function sitePaths({ gameMasters, systems }) {
  return [
    ...STATIC_PATHS,
    ...gameMasters.map((gm) => `/game-masters/${gm.userId}`),
    ...systems.map(systemPath),
  ];
}

function writeRobots() {
  const lines = isProduction
    ? [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /telegram",
        "Disallow: /profile",
        // The prerendered copies of the pages, served under their real URLs (see
        // scripts/prerender.mjs) — reached directly, they'd only be duplicates.
        "Disallow: /_pre/",
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

// llms.txt (llmstxt.org): a plain-Markdown summary of the club for AI assistants and
// AI search, which often read a site without running its JavaScript. The facts mirror the
// home page's copy (uk.json) — keep the two in step when prices, hours or the address change.
function writeLlmsTxt({ systems }) {
  const bySessions = [...systems].sort((a, b) => (b.sessionCount ?? 0) - (a.sessionCount ?? 0));
  const lines = [
    "# Dice & Adventures Club",
    "",
    "> Клуб настільних рольових ігор (НРІ) у Вінниці, Україна. Граємо в D&D (Dungeons & Dragons, ДнД) " +
      "та ще понад 20 систем; ігри кілька разів на тиждень — від ваншотів до кампаній. Новачкам раді: " +
      "правила пояснюємо під час гри.",
    "",
    "- Адреса: вул. Дмитра Майбороди, 2А, Вінниця",
    "- Клуб відкритий щодня з 9:00 до 24:00; ігри зазвичай у будні з 19:00 до 23:00, а у вихідні — у будь-яку годину дня, за домовленістю гравців і майстра",
    "- Вартість: перша гра безкоштовна, далі 500 грн на місяць (покриває оренду клубу)",
    "- Вік: від 16 років",
    "- З собою нічого не потрібно: кубики, книги правил і аркуші персонажів є в клубі",
    "- Крім рольових ігор, гравці збираються пограти й в інші настільні ігри (шахи, Northgard та ін.) — можна запропонувати свою",
    "- Записатися на гру: https://t.me/Guchara",
    "",
    "## Сторінки",
    "",
    `- [Головна](${SITE_URL}/): про клуб, часті питання, розклад найближчих ігор`,
    `- [Про клуб](${SITE_URL}/about): історія клубу, фото та відео з ігор`,
    `- [Ігри](${SITE_URL}/game-systems): усі системи, у які ми граємо, і скільки ігор зіграно в кожній`,
    `- [Майстри](${SITE_URL}/game-masters): хто веде ігри`,
    `- [Історія ігор](${SITE_URL}/game-log): кожна зіграна гра з оцінками гравців`,
    `- [Статистика](${SITE_URL}/statistics): клуб у цифрах`,
    `- [Приєднатися](${SITE_URL}/signup): заявка на вступ до клубу`,
  ];
  if (bySessions.length > 0) {
    lines.push("", "## Системи", "");
    for (const s of bySessions) {
      const count = s.sessionCount ? ` — зіграно ігор: ${s.sessionCount}` : "";
      lines.push(`- [${s.name}](${SITE_URL}${systemPath(s)})${count}`);
    }
  }
  writeFileSync(path.join(distDir, "llms.txt"), `${lines.join("\n")}\n`);
}

// Only when run as the postbuild script itself — prerender.mjs imports the helpers above.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!existsSync(distDir)) {
    console.warn("[generate-seo-files] dist/ not found — did the build run first? Skipping.");
    process.exit(0);
  }

  writeRobots();
  if (isProduction) {
    const data = await fetchSiteData();
    const paths = sitePaths(data);
    writeSitemap(paths);
    writeLlmsTxt(data);
    console.log(`[generate-seo-files] wrote robots.txt, sitemap.xml (${paths.length} URLs) and llms.txt`);
  } else {
    console.log("[generate-seo-files] SITE_ENV is not \"production\" — wrote a Disallow-all robots.txt, no sitemap.xml");
  }
}
