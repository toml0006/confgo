import * as React from "react";

import { cn } from "@/lib/utils";

type Tone = "past" | "future";

type TagProps = {
  children: React.ReactNode;
  active?: boolean;
  accent?: boolean;
  /** When set on an `active` tag, fills with the past/future data color
   *  instead of ink. Used by the Atlas time-range filter and intent chips. */
  tone?: Tone;
  onClick?: () => void;
  className?: string;
};

function Tag({
  children,
  active = false,
  accent = false,
  tone,
  onClick,
  className,
}: TagProps) {
  const base =
    "inline-flex items-center gap-1.5 px-[11px] py-1 rounded-[6px] border text-[11px] font-medium";

  let palette: string;
  if (active && tone === "past") {
    palette = "bg-past text-bg border-past";
  } else if (active && tone === "future") {
    palette = "bg-future text-bg border-future";
  } else if (active) {
    palette = "bg-ink text-bg border-ink";
  } else if (tone === "past") {
    palette = "bg-transparent text-past border-past";
  } else if (tone === "future") {
    palette = "bg-transparent text-future border-future";
  } else if (accent) {
    palette = "bg-brand-soft text-brand border-hair";
  } else {
    palette = "border-hair bg-transparent text-ink2";
  }

  const interactive = onClick ? "cursor-pointer" : "";

  return (
    <span
      data-slot="tag"
      data-tone={tone}
      className={cn(base, palette, interactive, className)}
      onClick={onClick}
    >
      {children}
    </span>
  );
}

export { Tag };
