import type { Conference } from "../api";

type Props = {
  conference: Conference;
};

export function PremiumCard({ conference }: Props) {
  const header = conference.premiumHeader || conference.name;
  const subtitle = conference.premiumSubtitle || defaultSubtitle(conference);
  const body = conference.premiumBody;
  const image = conference.premiumImage;

  return (
    <div className="shrink-0 flex flex-col gap-0 overflow-hidden">
      {image ? (
        <div
          className="relative h-[140px] bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${image})` }}
        />
      ) : null}
      <div className="px-4 pt-3.5 pb-4 flex flex-col gap-1.5">
        <h2 className="m-0 font-display font-normal text-[1.6rem] leading-[1.1] text-ink">
          {header}
        </h2>
        <div className="text-ink2 text-[14px]">{subtitle}</div>
        {body ? (
          <p className="mt-2 mb-0 font-display italic text-[16px] text-ink leading-[1.5]">
            {body}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function defaultSubtitle(c: Conference) {
  const start = new Date(c.startDate).toLocaleDateString();
  const end =
    c.endDate && c.endDate !== c.startDate
      ? ` – ${new Date(c.endDate).toLocaleDateString()}`
      : "";
  return `${c.locationName} · ${start}${end}`;
}
