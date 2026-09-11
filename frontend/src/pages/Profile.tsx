import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { AvatarUploadUrlResponse, User } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { PageShell } from "../components/PageShell";

const AVATAR_CDN_BASE_URL = import.meta.env.VITE_AVATAR_CDN_BASE_URL ?? "";

export function Profile() {
  const { t } = useTranslation();
  const { idToken } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [bio, setBio] = useState("");
  const [contact, setContact] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<{ user: User }>("/me", { token: idToken })
      .then((data) => {
        setUser(data.user);
        setBio(data.user.bio ?? "");
        setContact(data.user.telegramOrViberContact ?? "");
        setAvatarUrl(data.user.profilePictureUrl);
      })
      .catch((err) => setError(err.message));
  }, [idToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await apiFetch("/me/profile", {
        method: "PATCH",
        token: idToken,
        body: { bio, telegramOrViberContact: contact },
      });
      setStatus(t("profile.updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function onAvatarSelected() {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const { uploadUrl, objectKey } = await apiFetch<AvatarUploadUrlResponse>(
        "/me/avatar-upload-url",
        { method: "POST", token: idToken, body: { contentType: file.type } }
      );

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResponse.ok) throw new Error(t("profile.uploadFailed"));

      const newAvatarUrl = `${AVATAR_CDN_BASE_URL}/${objectKey}`;
      await apiFetch("/me/profile", {
        method: "PATCH",
        token: idToken,
        body: { profilePictureUrl: newAvatarUrl },
      });
      setAvatarUrl(newAvatarUrl);
      setStatus(t("profile.avatarUpdated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.uploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!user && !error)
    return (
      <PageShell>
        <p className="text-ink-muted">{t("common.loading")}</p>
      </PageShell>
    );

  const isGm = user?.roles?.includes("dm");

  return (
    <PageShell>
      <h1 className="page-title">{t("profile.title")}</h1>
      {isGm && <p className="mt-4 max-w-[54ch] text-ink-muted">{t("profile.gmIntro")}</p>}
      {error && <p className="mt-4 text-accent">{error}</p>}
      {status && <p className="mt-4 text-accent">{status}</p>}

      <div className="mt-8 flex flex-wrap items-center gap-6 rounded-xl border border-border bg-surface p-6">
        <img
          src={avatarUrl ?? "/default-avatar.svg"}
          alt=""
          width={96}
          height={96}
          className="h-24 w-24 flex-shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onAvatarSelected}
            disabled={busy}
            className="max-w-full text-sm"
          />
          <p className="mt-2 text-sm text-ink-muted">{t("profile.avatarHint")}</p>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-surface p-6"
      >
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          <span>
            {t("profile.bio")} {isGm && <span>{t("profile.bioGmHint")}</span>}
          </span>
          <textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          {t("profile.contact")}
          <input value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <button disabled={busy} type="submit" className="mt-1 self-start">
          {t("profile.save")}
        </button>
      </form>
    </PageShell>
  );
}
