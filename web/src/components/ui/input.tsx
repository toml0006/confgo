import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Brand pill input — matches the unified styling that previously lived
        // in the global `input` rule in app.css.
        "h-auto w-full min-w-0 rounded-full border border-hair bg-transparent px-[0.85rem] py-2 text-[0.8rem] tracking-[0.06em] text-ink outline-none transition-[border-color] duration-[180ms]",
        "placeholder:text-ink2",
        "focus-visible:border-ink2",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
