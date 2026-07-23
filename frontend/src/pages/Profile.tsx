import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AvatarUploadUrlResponse, User } from "@ttrpg-club/shared";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/AuthContext";

const AVATAR_CDN_BASE_URL = import.meta.env.VITE_AVATAR_CDN_BASE_URL ?? "";

export function Profile() {
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
      setStatus("Profile updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
      if (!uploadResponse.ok) throw new Error("Image upload failed");

      const newAvatarUrl = `${AVATAR_CDN_BASE_URL}/${objectKey}`;
      await apiFetch("/me/profile", {
        method: "PATCH",
        token: idToken,
        body: { profilePictureUrl: newAvatarUrl },
      });
      setAvatarUrl(newAvatarUrl);
      setStatus("Profile picture updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  if (!user && !error) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <h1>My Profile</h1>
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
            Upload a new profile picture (JPEG, PNG or WebP).
          </p>
        </div>
      </div>

      <form className="card" onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "480px" }}>
        <label>
          Bio {user?.roles?.includes("dm") && <span className="muted">(shown on your public Game Master page)</span>}
          <textarea rows={5} value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        <label>
          Telegram or Viber contact
          <input value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>
        <button disabled={busy} type="submit">Save Profile</button>
      </form>
    </div>
  );
}
