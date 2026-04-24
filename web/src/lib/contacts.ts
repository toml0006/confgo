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

const HANDLE_TYPES = new Set<ContactType>(["twitter", "instagram", "tiktok", "github"]);
const TRAILING_SLASH_TYPES = new Set<ContactType>(["website", "linkedin", "facebook"]);

export function normalizeContact(entry: ContactEntry): ContactEntry {
  const type = entry.type;
  let value = entry.value.trim();
  if (type === "email") value = value.toLowerCase();
  if (HANDLE_TYPES.has(type) && value.startsWith("@")) value = value.slice(1);
  if (type === "website") value = value.replace(/^https?:\/\//i, "");
  if (TRAILING_SLASH_TYPES.has(type)) value = value.replace(/\/+$/, "");
  const out: ContactEntry = { type, value };
  if (type === "other" && entry.label) out.label = entry.label.trim().slice(0, 40);
  return out;
}

export function contactHref(c: ContactEntry): string | null {
  switch (c.type) {
    case "email":
      return `mailto:${c.value}`;
    case "phone":
      return `tel:${c.value.replace(/\s+/g, "")}`;
    case "twitter":
      return `https://twitter.com/${c.value}`;
    case "instagram":
      return `https://instagram.com/${c.value}`;
    case "tiktok":
      return `https://tiktok.com/@${c.value}`;
    case "github":
      return `https://github.com/${c.value}`;
    case "linkedin":
      return c.value.startsWith("linkedin.com")
        ? `https://${c.value}`
        : `https://linkedin.com/in/${c.value}`;
    case "facebook":
      return c.value.startsWith("facebook.com")
        ? `https://${c.value}`
        : `https://facebook.com/${c.value}`;
    case "website":
      return `https://${c.value}`;
    case "other":
      return null;
  }
}

export const CONTACT_LABELS: Record<ContactType, string> = {
  email: "Email",
  phone: "Phone",
  twitter: "Twitter / X",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  github: "GitHub",
  website: "Website",
  other: "Other",
};
