import { useState } from "react";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import type { User } from "../lib/types";
import { patchMe } from "../lib/api";
import { UserAvatar } from "./UserAvatar";
import { CloseIcon, PencilIcon } from "./icons";

interface Props {
  user: User;
  onClose: () => void;
  onEditProfileImage: () => void;
  onAddConference: () => void;
}

export function SettingsPanel({ user, onClose, onEditProfileImage, onAddConference }: Props) {
  const { isLinked, refresh } = useAuth();
  const [name, setName] = useState(user.displayName ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [signInMode, setSignInMode] = useState<"up" | "in">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const hasGoogle = user.email
    ? (auth.currentUser?.providerData ?? []).some((p) => p.providerId === "google.com")
    : false;

  async function saveName() {
    setNameSaving(true);
    try {
      await patchMe({ displayName: name.trim() || null });
      await refresh();
    } finally {
      setNameSaving(false);
    }
  }

  async function handleEmailPassword() {
    setAuthError(null);
    setAuthBusy(true);
    try {
      if (!auth.currentUser) throw new Error("No session.");
      if (signInMode === "up") {
        const cred = EmailAuthProvider.credential(email, password);
        await linkWithCredential(auth.currentUser, cred);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      await refresh();
      setEmail("");
      setPassword("");
    } catch (err) {
      const msg = (err as { code?: string; message?: string }).message || "Sign-in failed.";
      setAuthError(msg);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleGoogle() {
    setAuthError(null);
    setAuthBusy(true);
    try {
      if (!auth.currentUser) return;
      const provider = new GoogleAuthProvider();
      if (!isLinked) {
        await linkWithPopup(auth.currentUser, provider);
      } else if (!hasGoogle) {
        await linkWithPopup(auth.currentUser, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
      await refresh();
    } catch (err) {
      const msg = (err as { message?: string }).message || "Google sign-in failed.";
      setAuthError(msg);
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    window.location.reload();
  }

  return (
    <section className="sheet right glass" role="region" aria-label="Settings">
      <header className="sheet-header">
        <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0, flex: 1 }}>
          <button
            onClick={onEditProfileImage}
            aria-label="Edit profile image"
            style={{ position: "relative", borderRadius: "50%" }}
          >
            <UserAvatar
              avatarId={user.avatarId}
              photoURL={user.photoURL}
              displayName={user.displayName}
              size={75}
            />
            <span
              style={{
                position: "absolute",
                right: -4,
                bottom: -4,
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "var(--haze)",
                border: "1px solid var(--mist)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
              }}
            >
              <PencilIcon width={14} height={14} />
            </span>
          </button>
          <div style={{ minWidth: 0 }}>
            <h2 className="sheet-title" style={{ fontSize: "0.9rem" }}>
              {user.displayName || "Unnamed"}
            </h2>
            <p className="sheet-subtitle">
              {user.email || (isLinked ? "Linked account" : "Anonymous")}
            </p>
          </div>
        </div>
        <button className="close-btn" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
      </header>

      <div className="sheet-body">
        <div className="field">
          <label htmlFor="display-name">Display name</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              placeholder="How others will see you"
            />
            <button
              className="soft-button primary"
              onClick={saveName}
              disabled={nameSaving || (name.trim() || null) === user.displayName}
            >
              Save
            </button>
          </div>
        </div>

        <div className="sheet-divider" />

        {!isLinked && (
          <>
            <div
              style={{
                fontSize: "0.64rem",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "var(--text-muted)",
                marginBottom: 10,
              }}
            >
              {signInMode === "up" ? "Create an account" : "Sign in"}
            </div>
            <div className="field">
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {authError && <p className="form-error">{authError}</p>}
            <div className="button-row" style={{ marginBottom: 10 }}>
              <button
                className="soft-button primary"
                disabled={authBusy || !email || !password}
                onClick={handleEmailPassword}
              >
                {signInMode === "up" ? "Create account" : "Sign in"}
              </button>
              <button
                className="soft-button quiet"
                onClick={() => setSignInMode(signInMode === "up" ? "in" : "up")}
              >
                {signInMode === "up"
                  ? "Already have an account?"
                  : "Create an account instead"}
              </button>
            </div>
            <button
              className="soft-button"
              style={{ width: "100%" }}
              onClick={handleGoogle}
              disabled={authBusy}
            >
              Sign in with Google
            </button>
          </>
        )}

        {isLinked && !hasGoogle && (
          <div className="button-row">
            <button className="soft-button" onClick={handleGoogle} disabled={authBusy}>
              Link Google account
            </button>
          </div>
        )}

        {isLinked && (
          <p className="sheet-subtitle" style={{ marginTop: 8 }}>
            Account linked · providers:{" "}
            {(auth.currentUser?.providerData ?? [])
              .map((p) => (p.providerId === "password" ? "email" : p.providerId))
              .join(", ") || "anonymous"}
          </p>
        )}

        {user.isAdmin && (
          <>
            <div className="sheet-divider" />
            <div
              style={{
                fontSize: "0.64rem",
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                color: "var(--text-muted)",
                marginBottom: 10,
              }}
            >
              Manage
            </div>
            <button className="soft-button" onClick={onAddConference}>
              Add a conference
            </button>
          </>
        )}

        <div className="sheet-divider" />

        <button className="soft-button danger" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </section>
  );
}
