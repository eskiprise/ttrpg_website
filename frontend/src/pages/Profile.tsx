import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { AvatarUploadUrlResponse, User } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

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

  if (!user && !error) return <div className="page"><p className="muted">{t("common.loading")}</p></div>;

  return (
    <div className="page">
      <h1>{t("profile.title")}</h1>
      {error && <p className="error-text">{error}</p>}
      {status && <p className="muted">{status}</p>}

      <div className="card" style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
        <img
          src={avatarUrl ?? "/default-avatar.svg"}
          alt=""
          width={96}
          height={96}
          style={{ borderRadius: "50%", objectFit: "cover" }}
        />
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onAvatarSelected}
            disabled={busy}
          />
          <p className="muted" style={{ margin: "0.5rem 0 0" }}>
            {t("profile.avatarHint")}
          </p>
        </div>
      </div>

      <form className="card" onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "480px" }}>
        <label>
          {t("profile.bio")} {user?.roles?.includes("dm") && <span className="muted">{t("profile.bioGmHint")}</span>}
          <textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        <label>
          {t("profile.contact")}
          <input value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <button disabled={busy} type="submit">{t("profile.save")}</button>
      </form>
    </div>
  );
}
