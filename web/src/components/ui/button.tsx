import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Atlas design system — pill borders, no uppercase/tracking on text.
        "atlas-primary":
          "rounded-full border bg-ink text-bg border-ink hover:bg-brand-deep hover:border-brand-deep transition-colors",
        atlas:
          "rounded-full border bg-transparent text-ink border-hair hover:border-ink transition-colors",
        "atlas-ghost":
          "rounded-full border-transparent bg-transparent text-ink hover:bg-hair-soft transition-colors",
        "atlas-danger":
          "rounded-full border bg-transparent text-brand border-hair hover:bg-brand-soft transition-colors",
        // Past + future event tones — used wherever a CTA explicitly maps to
        // a temporal intent (e.g. "I was there" / "I'll be there"). They use
        // the same data tokens as the map heatmap so the colors agree.
        // Solid variants are the "toggled on" state; the outline variants
        // are off. Hover preview-fills the off state and brightens the on.
        "atlas-past":
          "rounded-full border bg-transparent text-past border-past hover:bg-past hover:text-bg transition-colors",
        "atlas-future":
          "rounded-full border bg-transparent text-future border-future hover:bg-future hover:text-bg transition-colors",
        "atlas-past-solid":
          "rounded-full border bg-past text-bg border-past hover:brightness-125 transition-[filter,background-color,border-color]",
        "atlas-future-solid":
          "rounded-full border bg-future text-bg border-future hover:brightness-125 transition-[filter,background-color,border-color]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
        // Atlas — sized to match the atlas variants.
        atlas: "h-auto px-[18px] py-[10px] text-[13px] font-medium tracking-[-0.005em]",
        "atlas-sm": "h-auto px-3 py-1.5 text-[12px] font-medium tracking-[-0.005em]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
