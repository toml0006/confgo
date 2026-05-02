import * as React from "react"
import { XIcon, ArrowLeftIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Kicker } from "@/components/ui/kicker"

type Side = "top-left" | "top-right"

type FloatingPanelProps = React.ComponentProps<"div"> & {
  side?: Side
  onClose?: () => void
  onBack?: () => void
  closeLabel?: string
  premium?: boolean
  /** Push the panel below a taller toolbar — used for /u/:id routes. */
  inset?: "default" | "raised"
}

const SIDE: Record<Side, string> = {
  "top-left": "left-[18px]",
  "top-right": "right-[18px]",
}

const INSET = {
  default: "top-[78px] max-h-[calc(100vh-96px)]",
  raised: "top-[100px] max-h-[calc(100vh-118px)]",
}

function FloatingPanel({
  className,
  side = "top-left",
  onClose,
  onBack,
  closeLabel = "Close",
  premium = false,
  inset = "default",
  children,
  ...props
}: FloatingPanelProps) {
  const hasChrome = Boolean(onBack || onClose);
  return (
    <div
      data-slot="floating-panel"
      className={cn(
        "sheet-in fixed z-40 flex w-[min(420px,calc(100vw-36px))] flex-col gap-[18px] overflow-y-auto p-[18px]",
        "bg-paper border border-hair rounded-[14px] shadow-[var(--shadow-card)]",
        SIDE[side],
        INSET[inset],
        premium && "border-brand",
        className,
      )}
      {...props}
    >
      {hasChrome ? (
        <div
          data-slot="floating-panel-chrome"
          className="-mt-1 -mb-1 flex items-center justify-between gap-2 min-h-[28px]"
        >
          {onBack ? (
            <Button
              variant="atlas-ghost"
              size="atlas-sm"
              className="-ml-2 normal-case tracking-normal"
              onClick={onBack}
            >
              <ArrowLeftIcon /> Back
            </Button>
          ) : (
            <span />
          )}
          {onClose ? (
            <button
              type="button"
              aria-label={closeLabel}
              onClick={onClose}
              className="-mr-1 rounded-full p-1.5 text-ink2 hover:text-ink hover:bg-hair-soft transition-colors"
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function FloatingPanelHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="floating-panel-header"
      className={cn("flex items-start justify-between gap-2.5", className)}
      {...props}
    />
  )
}

function FloatingPanelTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="floating-panel-title"
      className={cn("m-0 font-display text-[1.3rem] font-normal leading-[1.2] text-ink", className)}
      {...props}
    />
  )
}

function Caption({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="caption"
      className={cn(
        "font-display italic text-[14px] text-ink2 leading-[1.55]",
        className,
      )}
      {...props}
    />
  )
}

export {
  FloatingPanel,
  FloatingPanelHeader,
  FloatingPanelTitle,
  Caption,
}
export { Kicker as SectionLabel } from "@/components/ui/kicker"
