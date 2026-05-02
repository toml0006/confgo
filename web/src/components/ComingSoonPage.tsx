// Public marketing page at /coming-soon. Auth not required.

import { Wordmark } from "@/components/ui/wordmark";
import { Kicker } from "@/components/ui/kicker";

const MINNEBAR_URL = "https://sessions.minnestar.org/sessions/1903";

export function ComingSoonPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-8 bg-bg">
      <main className="w-full max-w-[520px] flex flex-col items-center text-center gap-6">
        <Wordmark size={28} />

        <h1 className="font-display font-light text-[clamp(2.4rem,7vw,3.6rem)] tracking-[-0.025em] m-0 text-ink">
          Coming soon
        </h1>
        <p className="font-display italic text-[16px] text-ink2 leading-[1.55] m-0 mb-1.5 max-w-[28em]">
          A map of the conferences worth showing up to —
          <br />
          and the people you'll see there.
        </p>

        <a
          href={MINNEBAR_URL}
          target="_blank"
          rel="noreferrer"
          className="bg-paper border border-hair rounded-[14px] hover:bg-hair-soft transition-colors p-5 flex items-center gap-4 max-[420px]:flex-col max-[420px]:items-start max-[420px]:gap-3 w-full no-underline"
        >
          <img
            src="/minnebar.svg"
            alt="MinneBar"
            className="w-24 h-auto shrink-0"
          />
          <div className="flex flex-col gap-0.5 text-left min-w-0">
            <div className="text-[0.62rem] uppercase tracking-[0.22em] text-ink3">
              Want to learn more?
            </div>
            <div className="text-[0.95rem] font-normal text-ink">
              Catch the talk at MinneBar 20
            </div>
            <div className="text-[0.7rem] text-ink2 mt-0.5">
              sessions.minnestar.org →
            </div>
          </div>
        </a>

        <Kicker className="mt-1.5">We'll be live shortly.</Kicker>
      </main>
    </div>
  );
}
