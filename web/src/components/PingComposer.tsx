import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import {
  CONTACT_LABELS,
  MAX_SAVED_CONTACTS,
  type ContactEntry,
} from "../lib/contacts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Caption } from "@/components/ui/floating-panel";
import { Kicker } from "@/components/ui/kicker";
import { ContactAddRow } from "./ContactAddRow";

type Props = {
  open: boolean;
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
  open,
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
    if (!open) return;
    setSelected(new Set());
    setError(null);
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
  }, [open]);

  async function handleAddContact(entry: ContactEntry) {
    if (!saved) return;
    const next = [...saved, entry];
    try {
      const res = await apiFetch<{ contacts: ContactEntry[] }>("/me/contacts", {
        method: "PUT",
        body: JSON.stringify({ contacts: next }),
      });
      setSaved(res.contacts);
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
  }

  const atMax = saved !== null && saved.length >= MAX_SAVED_CONTACTS;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="bg-paper border border-hair rounded-[14px] max-w-[460px] gap-3.5 max-h-[calc(100vh-40px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle asChild>
            <Kicker>{title}</Kicker>
          </DialogTitle>
          <DialogDescription asChild>
            <Caption>
              Only shared if <strong>{peerDisplayName}</strong> matches back.
            </Caption>
          </DialogDescription>
        </DialogHeader>

        {saved === null ? (
          <Caption>{error ?? "Loading…"}</Caption>
        ) : saved.length === 0 ? (
          <Caption>
            No saved contact cards yet — add one below to send this ping.
          </Caption>
        ) : (
          <ul className="list-none m-0 p-0 flex flex-col gap-1">
            {saved.map((c, idx) => {
              const checked = selected.has(idx);
              return (
                <li key={`${c.type}:${c.value}:${idx}`}>
                  <label
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer border ${
                      checked
                        ? "border-brand bg-brand-soft"
                        : "border-transparent bg-bg hover:bg-hair-soft"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(idx)}
                      disabled={submitting}
                      className="m-0 w-auto !p-0 !rounded-none !border-0"
                    />
                    <Kicker className="min-w-[64px]">
                      {CONTACT_LABELS[c.type]}
                    </Kicker>
                    <span className="flex-1 min-w-0 text-[14px] text-ink truncate">
                      {c.value}
                    </span>
                    {c.label ? (
                      <span className="text-[12px] text-ink2 italic">({c.label})</span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {!atMax ? (
          <>
            <Kicker className="mt-1">Add new</Kicker>
            <ContactAddRow disabled={submitting} onAdd={handleAddContact} />
          </>
        ) : null}

        {error ? <div className="text-[13px] text-brand">{error}</div> : null}

        <DialogFooter className="pt-1 gap-2 sm:gap-2">
          <Button variant="atlas" size="atlas" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="atlas-primary"
            size="atlas"
            disabled={submitting || selected.size === 0}
            onClick={handleSubmit}
          >
            {submitting ? "Sending…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
