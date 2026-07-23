const ADJECTIVES = [
  "Silent", "Wandering", "Crimson", "Shadow", "Lucky", "Grim", "Mystic", "Rowdy",
  "Ancient", "Clever", "Reckless", "Nimble", "Stormy", "Feral", "Cunning", "Bold",
];

const NOUNS = [
  "Raven", "Goblin", "Paladin", "Wizard", "Rogue", "Dragon", "Wanderer", "Ranger",
  "Golem", "Sentinel", "Nomad", "Cleric", "Bard", "Warlock", "Druid", "Knight",
];

/**
 * Deterministic per-user nickname so an anonymized participant reads the same
 * way everywhere (rather than a fresh random name on every request).
 */
export function nicknameFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const unsigned = hash >>> 0;
  const adjective = ADJECTIVES[unsigned % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(unsigned / ADJECTIVES.length) % NOUNS.length];
  return `${adjective} ${noun}`;
}
