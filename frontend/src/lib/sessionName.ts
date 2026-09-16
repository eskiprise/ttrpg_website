import { formatGameTitle, normalizeForMatch } from "@ttrpg-club/shared";

/**
 * Suggesting the next session's name from the game master's previous one in the same
 * system: "D&D. На межі. Сесія #16. День відкритих дверей" → "На межі. Сесія #17".
 * The system name is dropped (the poll adds it back), the counter goes up by one, and
 * whatever followed the counter — that session's own episode title — is left for the
 * game master to write.
 */

interface MatchableSystem {
  name: string;
  aliases?: string[];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches the system's name at the start of a title however it was punctuated there
 * ("D&D: ", "D&D. ", "D&D - "), plus the separator that follows it.
 */
function prefixPattern(alias: string): RegExp | null {
  const words = alias.split(/[^\p{L}\p{N}&]+/u).filter(Boolean).map(escapeRegExp);
  if (words.length === 0) return null;
  return new RegExp(`^\\s*${words.join("[^\\p{L}\\p{N}]+")}\\s*[:.–—-]?\\s*`, "iu");
}

/** The title without its leading system name — "D&D. На межі…" → "На межі…". */
export function stripSystemPrefix(title: string, system: MatchableSystem): string {
  const candidates = [system.name, ...(system.aliases ?? [])]
    .filter((candidate) => normalizeForMatch(candidate).length > 0)
    .sort((a, b) => b.length - a.length);

  for (const candidate of candidates) {
    const pattern = prefixPattern(candidate);
    const stripped = pattern ? title.replace(pattern, "") : title;
    if (pattern && stripped !== title) return stripped.trim();
  }
  return title.trim();
}

/** Trailing punctuation left behind after cutting a title short. */
const TRAILING_JUNK = /[\s.,;:–—-]+$/u;

/** "Сесія #16", "Гра 8", "Session 3" — the counter GMs actually number sessions with. */
const COUNTER = /(сесі[яію]|гра|гри|session|game|епізод|episode)\s*[#№]?\s*(\d+)/giu;
const LAST_NUMBER = /(\d+)(?!.*\d)/su;

export function suggestNextSessionName(previousQuestionText: string, system: MatchableSystem): string {
  const base = stripSystemPrefix(formatGameTitle(previousQuestionText), system);

  // Prefer a real session counter; only then fall back to the last number anywhere,
  // so "Кров та Неон" doesn't get a random digit bumped when there's no counter at all.
  const counters = [...base.matchAll(COUNTER)];
  const match = counters.length > 0 ? counters[counters.length - 1] : base.match(LAST_NUMBER);
  if (!match || match.index === undefined) return base;

  const numberText = counters.length > 0 ? match[2] : match[1];
  const numberStart = base.lastIndexOf(numberText, match.index + match[0].length);
  const next = String(Number(numberText) + 1);
  return (base.slice(0, numberStart) + next).trim().replace(TRAILING_JUNK, "");
}
