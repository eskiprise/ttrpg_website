import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  formatGameTitle,
  type GameSystemListResponse,
  type GameSystemWithCount,
  type MediaItem,
  type MediaListResponse,
  type SignupRequest,
  type TelegramGameSummary,
  type UnmatchedGame,
  type User,
} from "@ttrpg-club/shared";
import { ApiError, apiFetch } from "../../lib/api";
import { uploadGameSystemCover, uploadMediaFile } from "../../lib/uploads";
import { useAuth } from "../../auth/AuthContext";
import { SystemCover } from "../../components/SystemCover";

function useReload() {
  const [tick, setTick] = useState(0);
  return { tick, reload: () => setTick((t) => t + 1) };
}

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function SignupRequests({ token }: { token: string | null }) {
  const { t } = useTranslation();
  const { tick, reload } = useReload();
  const [requests, setRequests] = useState<SignupRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ requests: SignupRequest[] }>("/admin/signup-requests", { token })
      .then((data) => setRequests(data.requests))
      .catch((err) => setError(err.message));
  }, [token, tick]);

  async function acknowledge(requestId: string) {
    setError(null);
    try {
      await apiFetch(`/admin/signup-requests/${requestId}/acknowledge`, {
        method: "POST",
        token,
      });
    } catch (err) {
      // 409 = another admin already handled it — not worth an error, the reload below
      // simply drops it from the list.
      if (!(err instanceof ApiError && err.status === 409)) {
        setError(err instanceof Error ? err.message : t("common.somethingWrong"));
      }
    }
    reload();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{t("admin.signupRequestsTitle")}</h2>
      {error && <p className="mt-3 text-accent">{error}</p>}
      {requests?.length === 0 && <p className="mt-3 text-ink-muted">{t("admin.noPendingRequests")}</p>}
      <div className="mt-3 flex flex-col">
        {requests?.map((r) => (
          <div
            key={r.requestId}
            className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-medium">{[r.firstName, r.lastName].filter(Boolean).join(" ")}</p>
              <p className="truncate text-sm text-ink-muted">
                {[r.telegramOrViberContact, r.phone, r.email].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button type="button" className="flex-shrink-0 self-start sm:self-auto" onClick={() => acknowledge(r.requestId)}>
              {t("admin.acknowledge")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnonymizeToggle({ token }: { token: string | null }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !checked;
    setError(null);
    try {
      await apiFetch("/admin/settings/anonymize-toggle", {
        method: "PATCH",
        token,
        body: { anonymizeLoggedOutView: next },
      });
      setChecked(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{t("admin.anonymizeTitle")}</h2>
      <label className="mt-3 flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={toggle} />
        {t("admin.anonymizeLabel")}
      </label>
      {error && <p className="mt-3 text-accent">{error}</p>}
    </div>
  );
}

function Members({ token }: { token: string | null }) {
  const { t } = useTranslation();
  const { tick, reload } = useReload();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ users: User[] }>("/admin/users", { token })
      .then((data) => setUsers(data.users))
      .catch((err) => setError(err.message));
  }, [token, tick]);

  async function toggleDm(user: User) {
    const nextRoles = user.roles.includes("dm")
      ? user.roles.filter((r) => r !== "dm")
      : [...user.roles, "dm" as const];
    setError(null);
    try {
      await apiFetch(`/admin/users/${user.userId}/roles`, {
        method: "PATCH",
        token,
        body: { roles: nextRoles },
      });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{t("admin.membersTitle")}</h2>
      {error && <p className="mt-3 text-accent">{error}</p>}
      <div className="mt-3 flex flex-col">
        {users?.map((u) => (
          <div key={u.userId} className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 font-display text-sm font-bold text-accent">
                {initials(u.firstName, u.lastName)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{u.firstName} {u.lastName}</p>
                <p className="truncate text-sm text-ink-muted">{u.telegramOrViberContact}</p>
              </div>
            </div>
            <label className="flex flex-shrink-0 items-center gap-2 text-sm">
              <input type="checkbox" checked={u.roles.includes("dm")} onChange={() => toggleDm(u)} />
              {t("admin.gameMasterCheckbox")}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "D&D, DnD , ДнД" → ["D&D", "DnD", "ДнД"] — the API trims and de-duplicates too. */
function parseAliases(text: string): string[] {
  return text.split(",").map((a) => a.trim()).filter(Boolean);
}

const COVER_ACCEPT = "image/jpeg,image/png,image/webp";

function AddGameSystem({ token, onAdded }: { token: string | null; onAdded: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aliases, setAliases] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [coverInputKey, setCoverInputKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const imageUrl = cover ? await uploadGameSystemCover(cover, token) : undefined;
      await apiFetch("/admin/game-systems", {
        method: "POST",
        token,
        body: { name, description, aliases: parseAliases(aliases), imageUrl },
      });
      setName("");
      setDescription("");
      setAliases("");
      setCover(null);
      setCoverInputKey((k) => k + 1); // file inputs can't be cleared by value
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{t("admin.addSystemTitle")}</h2>
      <div className="mt-3 flex flex-col gap-2">
        <input placeholder={t("admin.systemNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        <textarea placeholder={t("admin.descriptionPlaceholder")} value={description} onChange={(e) => setDescription(e.target.value)} />
        <input placeholder={t("admin.aliasesPlaceholder")} value={aliases} onChange={(e) => setAliases(e.target.value)} />
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("admin.coverLabel")}
          <input
            key={coverInputKey}
            type="file"
            accept={COVER_ACCEPT}
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
            className="max-w-full text-sm"
          />
        </label>
        {error && <p className="text-accent">{error}</p>}
        <button type="button" onClick={submit} disabled={busy || !name.trim()}>
          {t("admin.addSystem")}
        </button>
      </div>
    </div>
  );
}

function GameSystemRow({
  system,
  token,
  onChanged,
}: {
  system: GameSystemWithCount;
  token: string | null;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(system.name);
  const [description, setDescription] = useState(system.description);
  const [aliases, setAliases] = useState((system.aliases ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, doneMessage: string) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await action();
      setStatus(doneMessage);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: object) =>
    apiFetch(`/admin/game-systems/${system.systemId}`, { method: "PATCH", token, body });

  function save() {
    run(() => patch({ name, description, aliases: parseAliases(aliases) }), t("admin.saved"));
  }

  // A cover is saved as soon as it's uploaded — no second "remember to press Save" step.
  function onCoverSelected(file: File | undefined) {
    if (!file) return;
    run(async () => patch({ imageUrl: await uploadGameSystemCover(file, token) }), t("admin.coverSaved"));
  }

  function remove() {
    if (!window.confirm(t("admin.confirmDeleteSystem", { name: system.name }))) return;
    run(() => apiFetch(`/admin/game-systems/${system.systemId}`, { method: "DELETE", token }), t("admin.saved"));
  }

  return (
    <details className="group border-b border-border py-3 last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="h-12 w-9 flex-shrink-0 overflow-hidden rounded-md border border-border">
          <SystemCover system={system} size="thumb" />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{system.name}</span>
        <span className="flex-shrink-0 text-sm text-ink-muted">
          {t("gameSystems.games", { count: system.sessionCount ?? 0 })}
        </span>
        <span aria-hidden="true" className="text-ink-muted transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>

      <div className="mt-4 flex flex-col gap-3 sm:pl-12">
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("admin.systemNameLabel")}
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("admin.descriptionPlaceholder")}
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("admin.aliasesLabel")}
          <input value={aliases} placeholder={t("admin.aliasesPlaceholder")} onChange={(e) => setAliases(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
          <label className="flex flex-col gap-1">
            {system.imageUrl ? t("admin.replaceCover") : t("admin.coverLabel")}
            <input
              type="file"
              accept={COVER_ACCEPT}
              disabled={busy}
              onChange={(e) => onCoverSelected(e.target.files?.[0])}
              className="max-w-full text-sm"
            />
          </label>
          {system.imageUrl && (
            <button type="button" className="secondary" disabled={busy} onClick={() => run(() => patch({ imageUrl: "" }), t("admin.saved"))}>
              {t("admin.removeCover")}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-accent">{error}</p>}
        {status && <p className="text-sm text-accent">{status}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !name.trim()} onClick={save}>
            {t("admin.save")}
          </button>
          <button type="button" className="secondary" disabled={busy} onClick={remove}>
            {t("admin.deleteSystem")}
          </button>
        </div>
      </div>
    </details>
  );
}

const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm";

/** Persists a new top-to-bottom order: renumbers to a clean 0..n-1 run and only PATCHes rows whose index actually moved. */
async function persistMediaOrder(items: MediaItem[], token: string | null): Promise<void> {
  const updates = items
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => item.displayIndex !== index)
    .map(({ item, index }) =>
      apiFetch(`/admin/media/${item.mediaId}`, { method: "PATCH", token, body: { displayIndex: index } })
    );
  await Promise.all(updates);
}

function MediaUploadForm({ token, onAdded }: { token: string | null; onAdded: () => void }) {
  const { t } = useTranslation();
  const [inputKey, setInputKey] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  async function onFilesSelected(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0) return;

    setErrors([]);
    setNotice(null);
    setProgress({ done: 0, total: files.length });

    const failures: string[] = [];
    let anyLongVideo = false;
    // One at a time — parallel uploads of several multi-MB videos would fight over the
    // same connection anyway, and this keeps the progress count meaningful.
    for (const file of files) {
      try {
        const uploaded = await uploadMediaFile(file, token);
        if (uploaded.kind === "video" && uploaded.longerThanRecommended) anyLongVideo = true;
        await apiFetch("/admin/media", {
          method: "POST",
          token,
          body:
            uploaded.kind === "video"
              ? { kind: "video", url: uploaded.url, posterUrl: uploaded.posterUrl }
              : { kind: "photo", url: uploaded.url },
        });
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof Error ? err.message : t("common.somethingWrong")}`);
      }
      setProgress((p) => (p ? { done: p.done + 1, total: p.total } : p));
    }

    setErrors(failures);
    if (anyLongVideo) setNotice(t("admin.mediaLongVideoNotice"));
    setProgress(null);
    setInputKey((k) => k + 1); // file inputs can't be cleared by value
    onAdded();
  }

  return (
    <div>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        {t("admin.mediaUploadLabel")}
        <input
          key={inputKey}
          type="file"
          multiple
          accept={MEDIA_ACCEPT}
          disabled={!!progress}
          onChange={(e) => onFilesSelected(e.target.files)}
          className="max-w-full text-sm"
        />
      </label>
      {progress && (
        <p className="mt-2 text-sm text-ink-muted">
          {t("admin.mediaUploading", { done: progress.done, total: progress.total })}
        </p>
      )}
      {notice && <p className="mt-2 text-sm text-ink-muted">{notice}</p>}
      {errors.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-sm text-accent">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaRow({
  item,
  token,
  canMoveUp,
  canMoveDown,
  moveBusy,
  onMoveUp,
  onMoveDown,
  onChanged,
}: {
  item: MediaItem;
  token: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  moveBusy: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [caption, setCaption] = useState(item.caption ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveCaptionIfChanged() {
    if (caption === (item.caption ?? "")) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/media/${item.mediaId}`, { method: "PATCH", token, body: { caption } });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(t("admin.confirmDeleteMedia"))) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/media/${item.mediaId}`, { method: "DELETE", token });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
      <span className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
        <img src={item.kind === "video" ? item.posterUrl : item.url} alt="" className="h-full w-full object-cover" />
        {item.kind === "video" && (
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm text-white">
            ▶
          </span>
        )}
      </span>
      <input
        value={caption}
        placeholder={t("admin.mediaCaptionPlaceholder")}
        disabled={busy}
        onChange={(e) => setCaption(e.target.value)}
        onBlur={saveCaptionIfChanged}
        className="min-w-0 flex-1"
      />
      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          className="secondary px-2"
          aria-label={t("admin.mediaMoveUp")}
          disabled={!canMoveUp || moveBusy}
          onClick={onMoveUp}
        >
          ▲
        </button>
        <button
          type="button"
          className="secondary px-2"
          aria-label={t("admin.mediaMoveDown")}
          disabled={!canMoveDown || moveBusy}
          onClick={onMoveDown}
        >
          ▼
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={remove}>
          {t("admin.deleteSystem")}
        </button>
      </div>
      {error && <p className="ml-2 flex-shrink-0 text-sm text-accent">{error}</p>}
    </div>
  );
}

/** Long admin lists (dozens of games/systems/media items) push the whole dashboard page
 * length way down — collapsed by default behind a summary count, opened on demand. */
function CollapsibleList({ count, children }: { count: number; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <details className="group mt-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-ink-muted transition-transform group-open:rotate-90">
          ›
        </span>
        {t("admin.showList", { count })}
      </summary>
      <div className="mt-3 flex flex-col">{children}</div>
    </details>
  );
}

function MediaAdmin({ token, tick, reload }: { token: string | null; tick: number; reload: () => void }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);

  useEffect(() => {
    apiFetch<MediaListResponse>("/media", { token })
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message));
  }, [token, tick]);

  async function move(from: number, to: number) {
    if (!items || to < 0 || to >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setItems(reordered); // optimistic — the list re-fetch below confirms it
    setMoveBusy(true);
    try {
      await persistMediaOrder(reordered, token);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setMoveBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{t("admin.mediaTitle")}</h2>
      <p className="mt-2 text-sm text-ink-muted">{t("admin.mediaHint")}</p>
      <div className="mt-4 border-b border-border pb-5">
        <MediaUploadForm token={token} onAdded={reload} />
      </div>
      {error && <p className="mt-3 text-accent">{error}</p>}
      {items?.length === 0 && <p className="mt-3 text-ink-muted">{t("admin.mediaNone")}</p>}
      {(items?.length ?? 0) > 0 && (
        <CollapsibleList count={items!.length}>
          {items!.map((item, index) => (
            <MediaRow
              key={item.mediaId}
              item={item}
              token={token}
              canMoveUp={index > 0}
              canMoveDown={index < items!.length - 1}
              moveBusy={moveBusy}
              onMoveUp={() => move(index, index - 1)}
              onMoveDown={() => move(index, index + 1)}
              onChanged={reload}
            />
          ))}
        </CollapsibleList>
      )}
    </div>
  );
}

function GameSystemsAdmin({ token, tick, reload }: { token: string | null; tick: number; reload: () => void }) {
  const { t } = useTranslation();
  const [systems, setSystems] = useState<GameSystemWithCount[] | null>(null);
  const [unmatched, setUnmatched] = useState<UnmatchedGame[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<GameSystemListResponse>("/game-systems", { token })
      .then((data) => {
        setSystems(data.systems);
        setUnmatched(data.unmatched ?? []);
      })
      .catch((err) => setError(err.message));
  }, [token, tick]);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{t("admin.systemsTitle")}</h2>
      <p className="mt-2 text-sm text-ink-muted">{t("admin.systemsHint")}</p>
      {error && <p className="mt-3 text-accent">{error}</p>}
      {systems?.length === 0 && <p className="mt-3 text-ink-muted">{t("gameSystems.none")}</p>}
      {(systems?.length ?? 0) > 0 && (
        <CollapsibleList count={systems!.length}>
          {systems!.map((system) => (
            <GameSystemRow key={system.systemId} system={system} token={token} onChanged={reload} />
          ))}
        </CollapsibleList>
      )}

      {unmatched.length > 0 && (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="font-bold">{t("admin.unmatchedTitle")}</h3>
          <p className="mt-1 text-sm text-ink-muted">{t("admin.unmatchedHint")}</p>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {unmatched.map((game) => (
              <li key={game.prefix} className="flex gap-3">
                <span className="w-6 flex-shrink-0 text-right font-numeric text-xs font-bold text-accent tabular-nums">
                  {game.count}
                </span>
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <span className="font-medium">{game.prefix}</span>
                  {game.exampleTitle !== game.prefix && <span className="text-ink-muted"> — {game.exampleTitle}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const GAMES_PAGE_SIZE = 30;

function GameAdminRow({
  game,
  token,
  users,
  onChanged,
}: {
  game: TelegramGameSummary;
  token: string | null;
  users: User[];
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const originalTitle = formatGameTitle(game.questionText);
  const [title, setTitle] = useState(originalTitle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(body: object) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/game-log/${game.pollId}`, { method: "PATCH", token, body });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  function saveTitleIfChanged() {
    const trimmed = title.trim();
    if (!trimmed || trimmed === originalTitle) return;
    void run({ questionText: trimmed });
  }

  return (
    <div className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center">
      <input
        className="min-w-0 flex-1"
        value={title}
        disabled={busy}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitleIfChanged}
      />
      <select
        value={game.gmUserId ?? ""}
        disabled={busy}
        onChange={(e) => run({ gmUserId: e.target.value || null })}
        className="sm:w-56"
      >
        <option value="">{t("admin.noGm")}</option>
        {users.map((u) => (
          <option key={u.userId} value={u.userId}>
            {u.firstName} {u.lastName}
          </option>
        ))}
      </select>
      <span className="flex-shrink-0 text-xs text-ink-muted">
        {new Date(game.createdAt).toLocaleDateString(i18n.language, { day: "numeric", month: "short" })}
      </span>
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}

function GamesAdmin({ token, tick, reload }: { token: string | null; tick: number; reload: () => void }) {
  const { t } = useTranslation();
  const [games, setGames] = useState<TelegramGameSummary[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [onlyMissingGm, setOnlyMissingGm] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ users: User[] }>("/admin/users", { token })
      .then((data) =>
        setUsers(
          data.users
            .slice()
            .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
        )
      )
      .catch((err) => setError(err.message));
  }, [token, tick]);

  const load = useCallback(
    (offset: number, replace: boolean) => {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(GAMES_PAGE_SIZE),
        offset: String(offset),
        sortBy: "date",
        sortDir: "desc",
      });
      if (onlyMissingGm) params.set("hasGm", "false");
      apiFetch<{ games: TelegramGameSummary[]; hasMore: boolean }>(`/game-log?${params}`, { token })
        .then((data) => {
          setGames((prev) => (replace || !prev ? data.games : [...prev, ...data.games]));
          setHasMore(data.hasMore);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : t("common.somethingWrong")))
        .finally(() => setLoading(false));
    },
    [token, onlyMissingGm, t]
  );

  useEffect(() => {
    load(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tick, onlyMissingGm]);

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-xl font-bold">{t("admin.gamesTitle")}</h2>
      <p className="mt-2 text-sm text-ink-muted">{t("admin.gamesHint")}</p>
      <label className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
        <input
          type="checkbox"
          checked={onlyMissingGm}
          onChange={(e) => setOnlyMissingGm(e.target.checked)}
        />
        {t("admin.gamesOnlyMissingGm")}
      </label>
      {error && <p className="mt-3 text-accent">{error}</p>}
      {games?.length === 0 && (
        <p className="mt-3 text-ink-muted">
          {onlyMissingGm ? t("admin.gamesNoneMissingGm") : t("gameLog.none")}
        </p>
      )}
      {(games?.length ?? 0) > 0 && (
        <CollapsibleList count={games!.length}>
          {games!.map((game) => (
            <GameAdminRow key={game.pollId} game={game} token={token} users={users} onChanged={reload} />
          ))}
          {hasMore && (
            <button
              type="button"
              className="secondary mt-4 self-start"
              disabled={loading}
              onClick={() => load(games?.length ?? 0, false)}
            >
              {t("gameLog.loadMore")}
            </button>
          )}
        </CollapsibleList>
      )}
    </div>
  );
}

export function AdminDashboard() {
  const { t } = useTranslation();
  const { idToken } = useAuth();
  const { tick, reload } = useReload();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 sm:py-16">
      <h1 className="page-title">{t("admin.title")}</h1>
      {/* Left column: things with lists that grow (people, systems). Right column: settings and
          one-off actions, which stay short regardless of data volume — pairing them
          this way keeps both columns roughly balanced instead of one giant stack. */}
      <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <SignupRequests token={idToken} />
          <Members token={idToken} />
          <GameSystemsAdmin token={idToken} tick={tick} reload={reload} />
          <GamesAdmin token={idToken} tick={tick} reload={reload} />
          <MediaAdmin token={idToken} tick={tick} reload={reload} />
        </div>
        <div className="flex flex-col gap-6">
          <AnonymizeToggle token={idToken} />
          <AddGameSystem token={idToken} onAdded={reload} />
        </div>
      </div>
    </div>
  );
}
