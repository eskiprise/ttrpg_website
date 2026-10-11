/**
 * Mapping a Telegram poll to the game system it was played in. Polls carry no system
 * id — only the GM's free-text title, e.g. "Оцінка (Daggerheart: Dark Retrieval - «Мости» #2)"
 * — but GMs lead that title with the system's name, so the prefix identifies it.
 * Used by the backend (session counts per system) and the frontend (display titles).
 */

/**
 * /rate polls are created with a questionText like "Оцінка (Session name)" (see
 * handle_poll_command in ttrpg_poll_bot) — that wrapping makes sense as the actual
 * Telegram poll's question, but reads redundantly as a page/list title, so strip it
 * for display. Falls back to the raw text for anything that doesn't match (e.g. a
 * poll created before this convention, if any).
 */
export function formatGameTitle(questionText: string): string {
  const match = questionText.match(/^Оцінка\s*\((.+)\)$/);
  return match ? match[1] : questionText;
}

/**
 * Folds the spelling noise GMs actually produce so it can't defeat a match: case,
 * diacritics ("Mörk" = "Mork"), and punctuation ("D&D: …", "D&D. …", "ROOT:", "Root №1").
 * `&` survives because "D&D" without it is just "d d".
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}&]+/gu, " ")
    .trim();
}

interface MatchableSystem {
  systemId: string;
  name: string;
  aliases?: string[];
}

/**
 * Returns a function mapping a poll's questionText to the systemId it belongs to, or
 * null. A poll matches when its normalized title equals, or starts with (as whole
 * words), the system's name or one of its aliases; when several systems match, the
 * longest name/alias wins — so "Mork Borg: …" can't be claimed by a system aliased
 * just "Mork". Built once per request, then applied to every poll.
 */
export function createSystemMatcher(systems: MatchableSystem[]): (questionText: string) => string | null {
  const candidates = systems
    .flatMap((system) =>
      [system.name, ...(system.aliases ?? [])].map((text) => ({
        systemId: system.systemId,
        prefix: normalizeForMatch(text),
      }))
    )
    .filter((c) => c.prefix.length > 0)
    .sort((a, b) => b.prefix.length - a.prefix.length);

  return (questionText) => {
    const title = normalizeForMatch(formatGameTitle(questionText));
    const hit = candidates.find((c) => title === c.prefix || title.startsWith(`${c.prefix} `));
    return hit?.systemId ?? null;
  };
}

/**
 * The part of an unmatched title an admin would most likely want as an alias:
 * everything before the first separator GMs use between system and session
 * ("ShadowCity: Кров та Неон" → "ShadowCity", "Остання справа - гра #1" → "Остання справа").
 */
export function titlePrefix(questionText: string): string {
  const title = formatGameTitle(questionText);
  return title.split(/\s*[:–—]\s*|\s+-\s+|\s*[№#]/)[0].trim() || title;
}

// Ukrainian → Latin per the official 2010 transliteration (КМУ №55), the one passports
// and road signs use. The pairs are [at the start of a word, anywhere else]: є/ї/й/ю/я
// are spelled differently at the start of a word ("Яр" → "Yar", "Маяк" → "Maiak").
const TRANSLIT: Record<string, string | [string, string]> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: ["ye", "ie"], ж: "zh", з: "z",
  и: "y", і: "i", ї: ["yi", "i"], й: ["y", "i"], к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ь: "", ю: ["yu", "iu"], я: ["ya", "ia"],
  // Not Ukrainian, but they turn up in system names typed on a Russian layout.
  ы: "y", э: "e", ё: "yo", ъ: "",
};

/**
 * A readable URL segment for a name: "D&D" → "dnd", "Клинки в пітьмі" → "klynky-v-pitmi",
 * "Mörk Borg" → "mork-borg". Lowercase Latin letters, digits and single hyphens only;
 * "" when nothing usable is left (the caller falls back to the id).
 */
export function slugify(text: string): string {
  const latin = text
    .toLowerCase()
    // "D&D", "R&R": an ampersand between two single letters reads as part of the name.
    .replace(/\b(\p{L})\s*&\s*(\p{L})\b/gu, "$1n$2")
    .replace(/&/g, " and ")
    // Apostrophes vanish inside a word ("п'ять" → "piat"), as the official rules have it.
    .replace(/['’ʼ`]/g, "")
    .replace(/\p{L}/gu, (char, offset: number, whole: string) => {
      const rule = TRANSLIT[char];
      if (rule === undefined) return char;
      if (typeof rule === "string") return rule;
      const wordStart = offset === 0 || !/\p{L}/u.test(whole[offset - 1]);
      return wordStart ? rule[0] : rule[1];
    })
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}
