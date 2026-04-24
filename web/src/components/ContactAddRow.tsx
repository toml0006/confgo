import { useState } from "react";
import {
  CONTACT_LABELS,
  CONTACT_TYPES,
  normalizeContact,
  type ContactEntry,
  type ContactType,
} from "../lib/contacts";

function placeholderFor(t: ContactType): string {
  switch (t) {
    case "email":
      return "you@example.com";
    case "phone":
      return "+1 415 555 0100";
    case "twitter":
    case "instagram":
    case "tiktok":
    case "github":
      return "handle";
    case "linkedin":
      return "in/your-profile";
    case "facebook":
      return "your-profile";
    case "website":
      return "yourdomain.com";
    case "other":
      return "value";
  }
}

type Props = {
  onAdd: (entry: ContactEntry) => void | Promise<void>;
  disabled?: boolean;
  submitLabel?: string;
};

export function ContactAddRow({ onAdd, disabled, submitLabel = "Add" }: Props) {
  const [type, setType] = useState<ContactType>("email");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd() {
    if (busy) return;
    const entry = normalizeContact({
      type,
      value,
      label: type === "other" ? label : undefined,
    });
    if (!entry.value) return;
    setBusy(true);
    try {
      await onAdd(entry);
      setValue("");
      setLabel("");
    } finally {
      setBusy(false);
    }
  }

  const isDisabled = disabled || busy;

  return (
    <div className="contact-add">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as ContactType)}
        disabled={isDisabled}
      >
        {CONTACT_TYPES.map((t) => (
          <option key={t} value={t}>
            {CONTACT_LABELS[t]}
          </option>
        ))}
      </select>
      <input
        value={value}
        placeholder={placeholderFor(type)}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
        }}
        disabled={isDisabled}
        maxLength={200}
      />
      {type === "other" ? (
        <input
          className="contact-add-label"
          value={label}
          placeholder="Label (e.g. Discord)"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
          disabled={isDisabled}
          maxLength={40}
        />
      ) : null}
      <button
        className="soft-button soft-button--primary"
        disabled={isDisabled || !value.trim()}
        onClick={handleAdd}
      >
        {submitLabel}
      </button>
      <style>{`
        .contact-add {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          align-items: center;
        }
        .contact-add select { flex: 0 0 auto; }
        .contact-add input { flex: 1 1 140px; min-width: 0; }
        .contact-add .contact-add-label { flex: 1 1 100px; }
      `}</style>
    </div>
  );
}
