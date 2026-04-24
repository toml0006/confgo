import { z } from "zod";

export const CONTACT_TYPES = [
  "email",
  "phone",
  "twitter",
  "instagram",
  "tiktok",
  "facebook",
  "linkedin",
  "github",
  "website",
  "other",
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];

export type ContactEntry = {
  type: ContactType;
  value: string;
  label?: string;
};

export const MAX_CONTACTS_PER_PING = 10;
export const MAX_SAVED_CONTACTS = 20;
export const MAX_VALUE_LEN = 200;
export const MAX_LABEL_LEN = 40;

const HANDLE_TYPES = new Set<ContactType>(["twitter", "instagram", "tiktok", "github"]);
const TRAILING_SLASH_TYPES = new Set<ContactType>([
  "website",
  "linkedin",
  "facebook",
]);

export function normalizeContact(entry: ContactEntry): ContactEntry {
  const type = entry.type;
  let value = entry.value.trim();
  if (type === "email") value = value.toLowerCase();
  if (HANDLE_TYPES.has(type) && value.startsWith("@")) value = value.slice(1);
  if (type === "website") {
    value = value.replace(/^https?:\/\//i, "");
  }
  if (TRAILING_SLASH_TYPES.has(type)) {
    value = value.replace(/\/+$/, "");
  }
  const out: ContactEntry = { type, value };
  if (type === "other" && entry.label) {
    out.label = entry.label.trim().slice(0, MAX_LABEL_LEN);
  }
  return out;
}

export const contactEntrySchema = z
  .object({
    type: z.enum(CONTACT_TYPES),
    value: z.string().min(1).max(MAX_VALUE_LEN),
    label: z.string().max(MAX_LABEL_LEN).optional(),
  })
  .transform(normalizeContact)
  .refine((c) => c.value.length > 0, "value cannot be empty after normalize");

export const contactsArraySchema = z
  .array(contactEntrySchema)
  .min(1)
  .max(MAX_CONTACTS_PER_PING);

export const savedContactsArraySchema = z
  .array(contactEntrySchema)
  .max(MAX_SAVED_CONTACTS);
