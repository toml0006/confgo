import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kicker } from "@/components/ui/kicker";

const GITHUB_URL = "https://github.com/toml0006/confgo";
const TWENTYX20_URL = "https://www.20x20solutions.com/";
const MIDDLEOUT_URL = "https://middleout.dev/";

type DialogId = "privacy" | "terms" | "about" | null;

export function Footer() {
  const [open, setOpen] = useState<DialogId>(null);
  const close = () => setOpen(null);

  return (
    <>
      <footer
        className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-4 px-4 py-2 bg-paper border-t border-hair"
        role="contentinfo"
      >
        <FooterLink onClick={() => setOpen("about")}>About</FooterLink>
        <span aria-hidden className="text-ink3">·</span>
        <FooterLink onClick={() => setOpen("privacy")}>Privacy</FooterLink>
        <span aria-hidden className="text-ink3">·</span>
        <FooterLink onClick={() => setOpen("terms")}>Terms</FooterLink>
      </footer>

      <Dialog open={open === "about"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="bg-paper border border-hair rounded-[14px] max-w-[520px] gap-4">
          <DialogHeader>
            <DialogTitle asChild>
              <Kicker>About Venn·bar</Kicker>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Origin story, maintainers, and repository.
            </DialogDescription>
          </DialogHeader>

          <div className="font-display text-[15px] text-ink leading-[1.55] space-y-3">
            <p>
              Venn·bar started as a conversation piece — something to point at
              while talking about AI-assisted software development practices at
              a tech conference. We wanted a real, deployed app that grew up in
              public alongside the tooling story we were telling: small,
              opinionated, shipped end-to-end with modern coding agents and a
              very visible commit log.
            </p>
            <p>
              What stuck was the underlying question. <em>Who else is in this
              room with you?</em> The atlas, the heatmap, the Venn diagrams —
              all of it is in service of finding overlap with the people you
              keep brushing past at the same five conferences a year.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-hair">
            <Kicker>Maintainers</Kicker>
            <Maintainer
              name="Ben Bakken"
              org="20×20 Solutions"
              orgUrl={TWENTYX20_URL}
            />
            <Maintainer
              name="Jackson Tomlinson"
              org="{middle/out}"
              orgUrl={MIDDLEOUT_URL}
            />
          </div>

          <div className="flex flex-col gap-1">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink2 hover:text-ink"
            >
              Source on GitHub ↗
            </a>
            <a
              href="/demo/topics"
              className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink2 hover:text-ink"
            >
              Talk slides →
            </a>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "privacy"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="bg-paper border border-hair rounded-[14px] max-w-[600px] gap-3 max-h-[calc(100vh-80px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle asChild>
              <Kicker>Privacy Policy</Kicker>
            </DialogTitle>
            <DialogDescription className="sr-only">
              How Venn·bar handles your data.
            </DialogDescription>
          </DialogHeader>

          <div className="font-display text-[14px] text-ink leading-[1.6] space-y-3">
            <Section heading="What we store">
              <p>
                When you mark a conference, we record your account id and the
                conference id. When you set a display name, photo, or contact
                cards, those live on your account record. Nothing else.
              </p>
            </Section>
            <Section heading="What we don't store">
              <p>
                No analytics pixels, no third-party trackers, no advertising
                identifiers. We do not sell, rent, or share data with anyone.
              </p>
            </Section>
            <Section heading="Contact disclosures">
              <p>
                Contact cards (email, social handles, etc.) are private until
                you ping someone <em>and</em> they ping you back. Mutual
                exchange is the only way disclosures cross between accounts.
                Either party can revoke the match at any time.
              </p>
            </Section>
            <Section heading="Anonymous sessions">
              <p>
                You can use Venn·bar without signing in. Anonymous sessions are
                tied to a browser and disappear if you clear local storage.
                Sign in to sync attendance across devices.
              </p>
            </Section>
            <Section heading="Map data">
              <p>
                Tile rendering uses Mapbox. Hovering or panning the map sends
                tile requests to api.mapbox.com — Mapbox's privacy policy
                applies to those requests.
              </p>
            </Section>
            <Section heading="Contact">
              <p>
                Questions? Open an issue on{" "}
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline"
                >
                  GitHub
                </a>
                .
              </p>
            </Section>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open === "terms"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="bg-paper border border-hair rounded-[14px] max-w-[600px] gap-3 max-h-[calc(100vh-80px)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle asChild>
              <Kicker>Terms of Use</Kicker>
            </DialogTitle>
            <DialogDescription className="sr-only">
              The rules of the road for using Venn·bar.
            </DialogDescription>
          </DialogHeader>

          <div className="font-display text-[14px] text-ink leading-[1.6] space-y-3">
            <Section heading="Free to use, as-is">
              <p>
                Venn·bar is provided free of charge with no warranty of any
                kind. Use at your own risk. We don't guarantee uptime, data
                durability, or that the app will continue to exist tomorrow.
              </p>
            </Section>
            <Section heading="Your account, your content">
              <p>
                You're responsible for the display name, photo, contact cards,
                and pings tied to your account. Don't upload anything you
                don't have rights to. Don't impersonate someone else.
              </p>
            </Section>
            <Section heading="Acceptable use">
              <p>
                Don't use Venn·bar to harass, dox, or send unsolicited bulk
                messages. Don't attempt to scrape attendance lists or contact
                cards through automated means. We may suspend accounts that
                abuse the service, with or without notice.
              </p>
            </Section>
            <Section heading="Conference data">
              <p>
                Conference listings are aggregated from public sources and
                contributions. They may be incomplete, mis-tagged, or out of
                date. Verify event details with the organizers before booking
                travel.
              </p>
            </Section>
            <Section heading="Changes">
              <p>
                We may update these terms as the product evolves. Continued
                use after a change constitutes acceptance.
              </p>
            </Section>
            <Section heading="Open source">
              <p>
                The source is on{" "}
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand hover:underline"
                >
                  GitHub
                </a>{" "}
                under the repository's stated license. The hosted service
                running at venn.bar is operated by the maintainers listed in
                the About dialog.
              </p>
            </Section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FooterLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink2 hover:text-ink transition-colors"
    >
      {children}
    </button>
  );
}

function Maintainer({
  name,
  org,
  orgUrl,
}: {
  name: string;
  org: string;
  orgUrl: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-[15px] text-ink">{name}</span>
      <span className="text-ink3">·</span>
      <a
        href={orgUrl}
        target="_blank"
        rel="noreferrer"
        className="font-mono text-[11px] uppercase tracking-[0.12em] text-brand hover:underline"
      >
        {org} ↗
      </a>
    </div>
  );
}

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Kicker>{heading}</Kicker>
      <div className="text-ink2 [&>p]:m-0">{children}</div>
    </div>
  );
}
