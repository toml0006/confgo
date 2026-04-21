import { useMemo, useState } from "react";
import type { User } from "firebase/auth";

import type { MeResponse } from "@shared/domain";

import { UserAvatar } from "./UserAvatar";

type Props = {
  me: MeResponse | null;
  firebaseUser: User | null;
  onClose: () => void;
  onSaveDisplayName: (value: string) => Promise<void>;
  onOpenProfileImage: () => void;
  onOpenAddConference: () => void;
  onLinkEmailPassword: (email: string, password: string) => Promise<void>;
  onSignInEmailPassword: (email: string, password: string) => Promise<void>;
  onGoogle: () => Promise<void>;
  onLinkGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function SettingsPanel({
  me,
  firebaseUser,
  onClose,
  onSaveDisplayName,
  onOpenProfileImage,
  onOpenAddConference,
  onLinkEmailPassword,
  onSignInEmailPassword,
  onGoogle,
  onLinkGoogle,
  onSignOut
}: Props) {
  const [displayName, setDisplayName] = useState(me?.displayName ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"link" | "signin">("link");
  const [error, setError] = useState<string | null>(null);

  const providerIds = useMemo(() => firebaseUser?.providerData.map((provider) => provider.providerId) ?? [], [firebaseUser]);
  const isAnonymous = Boolean(firebaseUser?.isAnonymous);
  const emailLinked = providerIds.includes("password");
  const googleLinked = providerIds.includes("google.com");

  return (
    <aside className="sheet sheet-right">
      <div className="sheet-header">
        <div className="sheet-kicker">Settings</div>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="sheet-body">
        {me ? (
          <div className="settings-head">
            <button className="avatar-edit-button" onClick={onOpenProfileImage}>
              <UserAvatar avatarId={me.avatarId} photoURL={me.photoURL} displayName={me.displayName} size={75} />
              <span className="avatar-edit-badge">✎</span>
            </button>
            <div>
              <h3>{me.displayName?.trim() || (firebaseUser?.isAnonymous ? "Anonymous" : "Unnamed")}</h3>
              <p className="muted-copy">{me.email ?? "Anonymous session"}</p>
            </div>
          </div>
        ) : null}

        <label className="settings-field">
          <span>Display name</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={50} />
        </label>
        <button className="soft-button primary" onClick={() => onSaveDisplayName(displayName)}>Save display name</button>

        <div className="section-heading"><span>Account</span><span>{isAnonymous ? "Anonymous" : "Linked"}</span></div>

        {isAnonymous ? (
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              try {
                if (mode === "link") {
                  await onLinkEmailPassword(email, password);
                } else {
                  await onSignInEmailPassword(email, password);
                }
              } catch (submissionError) {
                setError(submissionError instanceof Error ? submissionError.message : "Auth failed");
              }
            }}
          >
            <label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <button className="soft-button primary" type="submit">{mode === "link" ? "Create account" : "Sign in"}</button>
            <button type="button" className="soft-button quiet" onClick={() => setMode(mode === "link" ? "signin" : "link")}>
              {mode === "link" ? "Already have an account?" : "Need an account?"}
            </button>
            <button type="button" className="soft-button quiet" onClick={onGoogle}>Sign in with Google</button>
            {error ? <p className="error-copy">{error}</p> : null}
          </form>
        ) : (
          <div className="stack-block">
            <div className="muted-copy">Providers: {[emailLinked ? "Email" : null, googleLinked ? "Google" : null].filter(Boolean).join(", ") || "Anonymous"}</div>
            {!googleLinked ? <button className="soft-button quiet" onClick={onLinkGoogle}>Link Google account</button> : null}
          </div>
        )}

        {me?.isAdmin ? (
          <>
            <div className="section-heading"><span>Manage</span><span>Admin</span></div>
            <button className="soft-button quiet" onClick={onOpenAddConference}>Add a conference</button>
          </>
        ) : null}

        <button className="soft-button danger" onClick={onSignOut}>Sign out</button>
      </div>
    </aside>
  );
}

