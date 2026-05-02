import { useEffect, useState } from "react";
import { XIcon } from "lucide-react";
import { apiFetch } from "../api";
import { Button } from "@/components/ui/button";
import { Caption } from "@/components/ui/floating-panel";
import { Kicker } from "@/components/ui/kicker";
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
    return <Caption>{error ?? "Loading…"}</Caption>;
  }

  const atMax = contacts.length >= MAX_SAVED_CONTACTS;

  return (
    <div className="flex flex-col gap-2">
      {contacts.length > 0 ? (
        <ul className="list-none m-0 p-0 flex flex-col gap-1">
          {contacts.map((c, idx) => (
            <li
              key={`${c.type}:${c.value}:${idx}`}
              className="flex items-center gap-2.5 bg-hair-soft rounded-[10px] px-3 py-2"
            >
              <Kicker className="min-w-[64px]">
                {CONTACT_LABELS[c.type]}
              </Kicker>
              <span className="flex-1 min-w-0 text-[14px] text-ink truncate">
                {c.value}
              </span>
              {c.label ? (
                <span className="text-[12px] text-ink2 italic">({c.label})</span>
              ) : null}
              <Button
                variant="atlas-ghost"
                size="atlas-sm"
                aria-label={`Remove ${CONTACT_LABELS[c.type]}`}
                disabled={saving}
                onClick={() =>
                  put(contacts.slice(0, idx).concat(contacts.slice(idx + 1)))
                }
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <Caption>No cards yet.</Caption>
      )}

      {atMax ? (
        <Caption>Max {MAX_SAVED_CONTACTS} cards.</Caption>
      ) : (
        <ContactAddRow
          disabled={saving}
          onAdd={(entry) => put([...contacts, entry])}
        />
      )}

      {error ? (
        <div className="text-[13px] text-brand">{error}</div>
      ) : null}
    </div>
  );
}
