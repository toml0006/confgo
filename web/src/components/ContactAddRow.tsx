import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className="flex flex-wrap items-center gap-1.5">
      <Select
        value={type}
        onValueChange={(v) => setType(v as ContactType)}
        disabled={isDisabled}
      >
        <SelectTrigger className="rounded-full border-hair text-[13px] px-3 py-2 h-auto bg-paper hover:bg-hair-soft">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-paper border border-hair rounded-[14px]">
          {CONTACT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {CONTACT_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        className="flex-1 basis-[140px] min-w-0"
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
        <Input
          className="flex-1 basis-[100px] min-w-0"
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
      <Button
        variant="atlas-primary"
        size="atlas"
        disabled={isDisabled || !value.trim()}
        onClick={handleAdd}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
