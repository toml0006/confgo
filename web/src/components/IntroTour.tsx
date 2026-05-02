// First-load intro tour. Shows on the very first authenticated session
// (anonymous or otherwise) and is re-triggerable from the profile/settings
// panel. The `vb.intro.v1` localStorage flag prevents repeats — bump the
// version (v2, v3…) when the tour copy changes meaningfully and you want
// returning users to see it again.
//
// Surface: single fixed modal with cross-fading slides. Content lives in
// the SLIDES array below; ordering / count is data-driven so adding a
// slide is a single object push.

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Compass,
  MapPin,
  Sparkles,
  UserCircle2,
  WavesIcon,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Kicker } from "./ui/kicker";
import { Wordmark } from "./ui/wordmark";
import { cn } from "../lib/utils";

export const INTRO_VERSION_KEY = "vb.intro.v1";

type Slide = {
  kicker: string;
  title: string;
  body: string;
  detail?: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const SLIDES: Slide[] = [
  {
    kicker: "Welcome",
    title: "Conferences. People. Light contact.",
    body: "Venn·bar is a map of the tech conferences worth showing up to — and the people who'll be there with you. We've seeded hundreds; you mark the ones you care about.",
    Icon: Compass,
  },
  {
    kicker: "Conferences",
    title: "The map is the directory.",
    body: "Tap any pin to see what it is, who's going, and who's been. Mark it Going if you'll be there, Been if you were.",
    detail: "Premium events get a sponsor card. Past events fade quietly into the background.",
    Icon: MapPin,
  },
  {
    kicker: "People",
    title: "Show up however you want.",
    body: "Your display name can be your real name, a pseudonym, or three letters. People find each other through shared conferences, not personal info.",
    detail: "Anonymous by default. Sign in with Google or GitHub only if you want your account to follow you across devices.",
    Icon: UserCircle2,
  },
  {
    kicker: "Light pings",
    title: "Reach out without the awkward.",
    body: "A ping says 'I'd like to meet.' If they ping back, you both see the contact details you each chose to share. If they don't — you'll never know whether they ignored you or never saw it. That's the design.",
    detail: "Ignore anyone you don't want to hear from. No read receipts, no rejection, no shame.",
    Icon: WavesIcon,
  },
  {
    kicker: "Ready",
    title: "Pick a conference. Mark yourself going. See who else is there.",
    body: "That's the whole loop. The rest of the app is decoration.",
    detail: "You can re-run this intro anytime — settings · Run intro.",
    Icon: Sparkles,
  },
];

export function hasSeenIntro(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(INTRO_VERSION_KEY) === "seen";
  } catch {
    return true; // privacy mode etc — don't pester
  }
}

export function markIntroSeen() {
  try {
    window.localStorage.setItem(INTRO_VERSION_KEY, "seen");
  } catch {
    // ignore quota / privacy mode
  }
}

export function IntroTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  function finish() {
    markIntroSeen();
    onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        finish();
      } else if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
      onClick={finish}
      className="fixed inset-0 z-[150] grid place-items-center bg-ink/45 p-5 backdrop-blur-sm animate-sheet-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[min(540px,calc(100vw-32px))] overflow-hidden rounded-card border border-hair bg-paper text-ink shadow-modal"
      >
        {/* Soft accent corner — visual lift without taking over */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full opacity-60"
          style={{
            background:
              "radial-gradient(circle, color(display-p3 0.761 0.255 0.047 / 0.18) 0%, transparent 70%)",
          }}
        />

        <button
          type="button"
          onClick={finish}
          aria-label="Skip intro"
          className="absolute top-4 right-4 z-10 grid size-8 place-items-center rounded-full border border-hair text-ink2 transition-colors hover:border-ink hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>

        <div className="flex items-center gap-3 border-b border-hair-soft px-7 py-4">
          <Wordmark size={16} dim />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink3">
            Quick tour
          </span>
        </div>

        <SlideBody slide={slide} index={index} />

        <div className="flex items-center justify-between gap-3 border-t border-hair-soft px-7 py-4">
          <div className="flex items-center gap-1.5" aria-hidden>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={cn(
                  "h-[6px] rounded-full transition-all duration-200",
                  i === index
                    ? "w-6 bg-ink"
                    : i < index
                      ? "w-2 bg-ink2"
                      : "w-2 bg-hair",
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {index > 0 ? (
              <Button
                type="button"
                variant="atlas-ghost"
                size="atlas"
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              >
                Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="atlas-ghost"
                size="atlas"
                onClick={finish}
              >
                Skip
              </Button>
            )}
            {isLast ? (
              <Button
                type="button"
                variant="atlas-primary"
                size="atlas"
                onClick={finish}
                className="gap-2"
              >
                Get started
                <Sparkles className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                variant="atlas-primary"
                size="atlas"
                onClick={() => setIndex((i) => Math.min(i + 1, SLIDES.length - 1))}
                className="gap-2"
              >
                Next
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SlideBody({ slide, index }: { slide: Slide; index: number }) {
  const Icon = slide.Icon;
  return (
    <div
      key={index}
      className="flex flex-col gap-5 px-7 py-7 animate-sheet-in"
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-full border border-hair bg-brand-soft text-brand"
        >
          <Icon className="size-6" />
        </span>
        <Kicker accent>{slide.kicker}</Kicker>
      </div>

      <h2
        id="intro-title"
        className="font-display text-[1.65rem] leading-tight tracking-tight-1 text-ink"
      >
        {slide.title}
      </h2>

      <p className="font-display text-[1rem] leading-relaxed text-ink2">
        {slide.body}
      </p>

      {slide.detail ? (
        <p className="font-ui text-[0.85rem] leading-relaxed text-ink3">
          {slide.detail}
        </p>
      ) : null}
    </div>
  );
}
