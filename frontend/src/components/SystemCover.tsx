import type { GameSystem } from "@ttrpg-club/shared";

/**
 * A system's cover art filling its container — or, until one is uploaded, a band tile
 * with the name, so a grid of systems looks finished from day one. `thumb` is the
 * admin-list size, where only the initial fits.
 */
export function SystemCover({
  system,
  size = "tile",
}: {
  system: Pick<GameSystem, "name" | "imageUrl">;
  size?: "tile" | "thumb";
}) {
  if (system.imageUrl) {
    return <img src={system.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />;
  }
  if (size === "thumb") {
    return (
      <div className="flex h-full w-full items-center justify-center bg-band font-display font-bold text-band-accent" aria-hidden="true">
        {system.name.charAt(0)}
      </div>
    );
  }
  return (
    <div className="flex h-full w-full flex-col justify-end bg-band p-4" aria-hidden="true">
      <span className="mb-2.5 block h-0.5 w-8 bg-band-accent" />
      <span className="font-display text-lg leading-tight font-bold text-band-ink [overflow-wrap:anywhere]">
        {system.name}
      </span>
    </div>
  );
}
