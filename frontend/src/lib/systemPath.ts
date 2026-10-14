import type { GameSystem } from "@ttrpg-club/shared";

/**
 * A system page's URL — by its readable slug ("/game-systems/dnd"); by id only if the
 * system came from a backend that doesn't send slugs yet.
 */
export function systemPath(system: Pick<GameSystem, "systemId" | "slug">): string {
  return `/game-systems/${system.slug || system.systemId}`;
}
