import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { useTelegramApp } from "./TelegramAppContext";

const RATINGS = Array.from({ length: 10 }, (_, i) => i + 1);

function RatingRow({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-sm text-ink-muted">{help}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            className={`min-w-9 ${value === r ? "" : "secondary"}`}
            onClick={() => onChange(r)}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TelegramFeedbackForm() {
  const { t } = useTranslation();
  const { pollId } = useParams<{ pollId: string }>();
  const { initData } = useTelegramApp();

  const [adventureRating, setAdventureRating] = useState<number | null>(null);
  const [tableRating, setTableRating] = useState<number | null>(null);
  const [gmRating, setGmRating] = useState<number | null>(null);
  const [selfRating, setSelfRating] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [revealIdentity, setRevealIdentity] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const allRated = Boolean(adventureRating && tableRating && gmRating && selfRating);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pollId || !allRated) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/telegram/feedback", {
        method: "POST",
        body: {
          initData,
          pollId,
          adventureRating,
          tableRating,
          gmRating,
          selfRating,
          feedbackText: feedbackText.trim() || undefined,
          revealIdentity,
        },
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  if (!pollId) return <p className="text-accent">{t("common.somethingWrong")}</p>;

  if (submitted) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold">{t("telegramApp.feedbackThanksTitle")}</h1>
        <p className="text-ink-muted">{t("telegramApp.feedbackThanksBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <h1 className="text-xl font-bold">{t("telegramApp.feedbackTitle")}</h1>

      <RatingRow
        label={t("telegramApp.feedbackAdventureLabel")}
        help={t("telegramApp.feedbackAdventureHelp")}
        value={adventureRating}
        onChange={setAdventureRating}
      />
      <RatingRow
        label={t("telegramApp.feedbackTableLabel")}
        help={t("telegramApp.feedbackTableHelp")}
        value={tableRating}
        onChange={setTableRating}
      />
      <RatingRow
        label={t("telegramApp.feedbackGmLabel")}
        help={t("telegramApp.feedbackGmHelp")}
        value={gmRating}
        onChange={setGmRating}
      />
      <RatingRow
        label={t("telegramApp.feedbackSelfLabel")}
        help={t("telegramApp.feedbackSelfHelp")}
        value={selfRating}
        onChange={setSelfRating}
      />

      <label className="flex flex-col gap-1">
        <span className="font-semibold">{t("telegramApp.feedbackTextLabel")}</span>
        <span className="text-sm text-ink-muted">{t("telegramApp.feedbackTextHelp")}</span>
        <textarea rows={4} value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} />
      </label>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={revealIdentity}
          onChange={(e) => setRevealIdentity(e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm">{t("telegramApp.feedbackRevealLabel")}</span>
      </label>

      {error && <p className="text-accent">{error}</p>}
      <button type="submit" disabled={busy || !allRated}>{t("telegramApp.feedbackSubmit")}</button>
    </form>
  );
}
