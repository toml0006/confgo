import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import {
  CONTACT_LABELS,
  MAX_SAVED_CONTACTS,
  type ContactEntry,
} from "../lib/contacts";
import { ContactAddRow } from "./ContactAddRow";

export function ContactsEditor() {
  const [contacts, setContacts] = useState<ContactEntry[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ contacts: ContactEntry[] }>("/me/contacts")
      .then((r) => {
        if (!cancelled) setContacts(r.contacts);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function put(next: ContactEntry[]) {
    const prev = contacts;
    setSaving(true);
    setError(null);
    setContacts(next);
    try {
      const res = await apiFetch<{ contacts: ContactEntry[] }>("/me/contacts", {
        method: "PUT",
        body: JSON.stringify({ contacts: next }),
      });
      setContacts(res.contacts);
    } catch (err) {
      setContacts(prev);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (contacts === null) {
    return <div className="caption">{error ?? "Loading…"}</div>;
  }

  const atMax = contacts.length >= MAX_SAVED_CONTACTS;

  return (
    <div className="contacts-editor">
      {contacts.length > 0 ? (
        <ul className="contacts-list">
          {contacts.map((c, idx) => (
            <li key={`${c.type}:${c.value}:${idx}`} className="contact-row">
              <span className="contact-type">{CONTACT_LABELS[c.type]}</span>
              <span className="contact-value">{c.value}</span>
              {c.label ? <span className="contact-sublabel">({c.label})</span> : null}
              <button
                className="contact-remove"
                aria-label={`Remove ${CONTACT_LABELS[c.type]}`}
                disabled={saving}
                onClick={() =>
                  put(contacts.slice(0, idx).concat(contacts.slice(idx + 1)))
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="caption">No cards yet.</div>
      )}

      {atMax ? (
        <div className="caption">Max {MAX_SAVED_CONTACTS} cards.</div>
      ) : (
        <ContactAddRow
          disabled={saving}
          onAdd={(entry) => put([...contacts, entry])}
        />
      )}

      {error ? <div className="auth-error">{error}</div> : null}

      <style>{`
        .contacts-editor { display: flex; flex-direction: column; gap: 0.5rem; }
        .contacts-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .contact-row {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.35rem 0.5rem;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 6px;
        }
        .contact-type {
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--muted, rgba(255,255,255,0.55));
          min-width: 64px;
        }
        .contact-value {
          flex: 1;
          min-width: 0;
          font-size: 0.85rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .contact-sublabel {
          font-size: 0.7rem;
          color: var(--muted, rgba(255,255,255,0.55));
        }
        .contact-remove {
          background: transparent;
          border: none;
          color: var(--muted, rgba(255,255,255,0.55));
          font-size: 1.1rem;
          line-height: 1;
          cursor: pointer;
          padding: 0 0.25rem;
        }
        .contact-remove:hover { color: #ff8a8a; }
      `}</style>
    </div>
  );
}
