import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import {
  CONTACT_LABELS,
  MAX_SAVED_CONTACTS,
  type ContactEntry,
} from "../lib/contacts";
import { ContactAddRow } from "./ContactAddRow";

type Props = {
  title: string;
  peerDisplayName: string;
  submitLabel?: string;
  onSubmit: (contacts: ContactEntry[]) => Promise<void>;
  onCancel: () => void;
};

// Modal for picking which contact cards to include in a ping or ping-back.
// Disclosures are never revealed to the recipient until mutual: either the
// target pings back (for a fresh send) or — since this is ALSO the ping-back
// composer — the match happens instantly on submit.
export function PingComposer({
  title,
  peerDisplayName,
  submitLabel = "Send ping",
  onSubmit,
  onCancel,
}: Props) {
  const [saved, setSaved] = useState<ContactEntry[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ contacts: ContactEntry[] }>("/me/contacts")
      .then((r) => {
        if (!cancelled) setSaved(r.contacts);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddContact(entry: ContactEntry) {
    if (!saved) return;
    const next = [...saved, entry];
    try {
      const res = await apiFetch<{ contacts: ContactEntry[] }>("/me/contacts", {
        method: "PUT",
        body: JSON.stringify({ contacts: next }),
      });
      setSaved(res.contacts);
      // auto-select the newly added contact (last index)
      setSelected((s) => new Set([...s, res.contacts.length - 1]));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function toggle(idx: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  async function handleSubmit() {
    if (!saved || selected.size === 0 || submitting) return;
    const picks = Array.from(selected)
      .sort((a, b) => a - b)
      .map((i) => saved[i]);
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(picks);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
    // on success the parent closes the modal; no need to reset state here
  }

  const atMax = saved !== null && saved.length >= MAX_SAVED_CONTACTS;

  return (
    <div
      className="ping-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="ping-modal glass-panel sheet-in" role="dialog" aria-modal="true">
        <div className="ping-head">
          <div>
            <div className="section-label">{title}</div>
            <div className="caption">
              Only shared if <strong>{peerDisplayName}</strong> matches back.
            </div>
          </div>
          <button className="close-x" onClick={onCancel} aria-label="Cancel">
            ×
          </button>
        </div>

        {saved === null ? (
          <div className="caption">{error ?? "Loading…"}</div>
        ) : saved.length === 0 ? (
          <div className="caption">
            No saved contact cards yet — add one below to send this ping.
          </div>
        ) : (
          <ul className="ping-choices">
            {saved.map((c, idx) => {
              const checked = selected.has(idx);
              return (
                <li key={`${c.type}:${c.value}:${idx}`}>
                  <label className={`ping-choice ${checked ? "checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(idx)}
                      disabled={submitting}
                    />
                    <span className="contact-type">{CONTACT_LABELS[c.type]}</span>
                    <span className="contact-value">{c.value}</span>
                    {c.label ? (
                      <span className="contact-sublabel">({c.label})</span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {!atMax ? (
          <>
            <div className="section-label small-label">Add new</div>
            <ContactAddRow disabled={submitting} onAdd={handleAddContact} />
          </>
        ) : null}

        {error ? <div className="auth-error">{error}</div> : null}

        <div className="ping-actions">
          <button className="soft-button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            className="soft-button soft-button--primary"
            disabled={submitting || selected.size === 0}
            onClick={handleSubmit}
          >
            {submitting ? "Sending…" : submitLabel}
          </button>
        </div>
      </div>

      <style>{`
        .ping-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(3, 4, 10, 0.55);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 60;
          padding: 20px;
        }
        .ping-modal {
          width: min(460px, 100%);
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          max-height: calc(100vh - 40px);
          overflow-y: auto;
        }
        .ping-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
        }
        .small-label {
          margin-top: 4px;
        }
        .ping-choices {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .ping-choice {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.4rem 0.5rem;
          border-radius: 6px;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid transparent;
        }
        .ping-choice:hover { background: rgba(255, 255, 255, 0.05); }
        .ping-choice.checked {
          border-color: var(--signal-dim, rgba(94, 231, 217, 0.3));
          background: rgba(94, 231, 217, 0.07);
        }
        .ping-choice input { margin: 0; }
        .ping-choice .contact-type {
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--muted, rgba(255,255,255,0.55));
          min-width: 64px;
        }
        .ping-choice .contact-value {
          flex: 1;
          min-width: 0;
          font-size: 0.85rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ping-choice .contact-sublabel {
          font-size: 0.7rem;
          color: var(--muted, rgba(255,255,255,0.55));
        }
        .ping-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.5rem;
          padding-top: 4px;
        }
      `}</style>
    </div>
  );
}
