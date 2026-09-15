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
