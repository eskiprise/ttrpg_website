import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TelegramGameSummary } from "@ttrpg-club/shared";
import { formatGameTitle } from "../lib/gameTitle";

/** One session in a list — title, date, GM, player count, and its rating chip. */
export function GameRow({ game }: { game: TelegramGameSummary }) {
  const { t, i18n } = useTranslation();
  return (
    <Link
      to={`/game-log/${game.pollId}`}
      className="flex items-start gap-4 border-b border-border px-5 py-4 text-ink transition-colors last:border-b-0 hover:bg-surface-2 hover:no-underline"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-lg leading-snug font-bold">{formatGameTitle(game.questionText)}</span>
        <span className="mt-1 block text-sm text-ink-muted">
          {new Date(game.createdAt).toLocaleDateString(i18n.language, { dateStyle: "long" })} ·{" "}
          {t("gameLog.dm")} {game.gmDisplayName} · {t("gameLog.playerCount", { count: game.playerCount })}
        </span>
      </span>
      {game.averageScore !== null && (
        <span className="flex-shrink-0 rounded-md bg-band px-2 py-1 font-numeric text-sm font-bold tracking-[-0.02em] text-band-accent tabular-nums">
          {game.averageScore.toFixed(1)}
        </span>
      )}
    </Link>
  );
}

export function GameRowList({ games }: { games: TelegramGameSummary[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {games.map((game) => (
        <GameRow key={game.pollId} game={game} />
      ))}
    </div>
  );
}
