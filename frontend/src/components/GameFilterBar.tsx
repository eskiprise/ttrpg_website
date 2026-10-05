import { useTranslation } from "react-i18next";
import type { GameSystemWithCount, PublicGameMaster } from "@ttrpg-club/shared";

export interface GameFilterValues {
  /** Title search — only offered where `showSearch` is set (the Game Log). */
  q: string;
  from: string;
  to: string;
  gmUserId: string;
  systemId: string;
  minScore: string;
  maxScore: string;
}

export const EMPTY_GAME_FILTERS: GameFilterValues = {
  q: "",
  from: "",
  to: "",
  gmUserId: "",
  systemId: "",
  minScore: "",
  maxScore: "",
};

const SCORE_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * Date range + GM + system + score-range filter, shared by the Game Log and Statistics
 * pages so both look and behave the same. A CSS grid rather than flex-wrap: six fields
 * divide evenly at every breakpoint (3+3, 2+2+2, or all 6 in a row), so nothing is ever
 * left wrapping alone next to the buttons — the exact thing flex-wrap did to "Оцінка до".
 * Apply/Reset sit on their own row below for the same reason.
 */
export function GameFilterBar({
  value,
  onChange,
  onApply,
  onReset,
  busy,
  gameMasters,
  systems,
  showSearch = false,
}: {
  value: GameFilterValues;
  onChange: (next: GameFilterValues) => void;
  onApply: () => void;
  onReset: () => void;
  busy?: boolean;
  gameMasters: PublicGameMaster[];
  systems: GameSystemWithCount[];
  showSearch?: boolean;
}) {
  const { t } = useTranslation();

  function set<K extends keyof GameFilterValues>(key: K, v: string) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {showSearch && (
          <label className="col-span-full flex flex-col gap-1 text-sm text-ink-muted">
            {t("statistics.filterSearch")}
            <input
              type="text"
              className="w-full"
              maxLength={100}
              autoComplete="off"
              enterKeyHint="search"
              placeholder={t("statistics.filterSearchPlaceholder")}
              value={value.q}
              onChange={(e) => set("q", e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onApply();
              }}
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("statistics.from")}
          <input
            type="date"
            className={`w-full ${value.from ? "" : "date-empty"}`}
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => set("from", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("statistics.to")}
          <input
            type="date"
            className={`w-full ${value.to ? "" : "date-empty"}`}
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => set("to", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("statistics.filterGm")}
          <select className="w-full" value={value.gmUserId} onChange={(e) => set("gmUserId", e.target.value)}>
            <option value="">{t("statistics.filterGmAll")}</option>
            {gameMasters.map((gm) => (
              <option key={gm.userId} value={gm.userId}>
                {gm.firstName} {gm.lastName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("statistics.filterSystem")}
          <select className="w-full" value={value.systemId} onChange={(e) => set("systemId", e.target.value)}>
            <option value="">{t("statistics.filterSystemAll")}</option>
            {systems.map((system) => (
              <option key={system.systemId} value={system.systemId}>
                {system.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("statistics.filterMinScore")}
          <select className="w-full" value={value.minScore} onChange={(e) => set("minScore", e.target.value)}>
            <option value="">{t("statistics.filterScoreAny")}</option>
            {SCORE_OPTIONS.map((n) => (
              <option key={n} value={n} disabled={value.maxScore !== "" && n > Number(value.maxScore)}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("statistics.filterMaxScore")}
          <select className="w-full" value={value.maxScore} onChange={(e) => set("maxScore", e.target.value)}>
            <option value="">{t("statistics.filterScoreAny")}</option>
            {SCORE_OPTIONS.map((n) => (
              <option key={n} value={n} disabled={value.minScore !== "" && n < Number(value.minScore)}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={onApply}>
          {t("statistics.apply")}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={onReset}>
          {t("statistics.reset")}
        </button>
      </div>
    </div>
  );
}
