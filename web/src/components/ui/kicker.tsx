import * as React from "react";

import { cn } from "@/lib/utils";

type Tone = "past" | "future";

type KickerProps = React.ComponentProps<"div"> & {
  accent?: boolean;
  /** Color the kicker label as past/future data. Mutually exclusive with
   *  `accent`; if both are set, `tone` wins. */
  tone?: Tone;
};

function Kicker({ className, accent = false, tone, ...props }: KickerProps) {
  const color =
    tone === "past"
      ? "text-past"
      : tone === "future"
        ? "text-future"
        : accent
          ? "text-brand"
          : "text-ink2";
  return (
    <div
      data-slot="kicker"
      data-tone={tone}
      className={cn(
        "font-ui text-[10px] font-semibold uppercase tracking-[0.22em]",
        color,
        className,
      )}
      {...props}
    />
  );
}

export { Kicker };
