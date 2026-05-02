import { useMemo } from "react";
import type { AttendanceIntent, Conference } from "../api";
import { isPast } from "../lib/decay";
import { Caption, FloatingPanel } from "@/components/ui/floating-panel";
import { Kicker } from "@/components/ui/kicker";

type Props = {
  conferences: Conference[];
  myAttendances: Map<string, AttendanceIntent>;
  onPick: (conf: Conference) => void;
  onClose: () => void;
};

function ConfRow({
  conf,
  nameClass,
  premiumStyle,
  onPick,
}: {
  conf: Conference;
  nameClass: string;
  premiumStyle: boolean;
  onPick: (c: Conference) => void;
}) {
  const wrap =
    conf.premium && premiumStyle
      ? "border-brand bg-brand-soft hover:border-brand-deep"
      : "border-transparent hover:border-hair hover:bg-hair-soft";
  return (
    <button
      onClick={() => onPick(conf)}
      className={`grid grid-cols-[96px_1fr] gap-2 items-baseline px-2 py-1.5 rounded-[10px] border text-left transition-colors ${wrap}`}
    >
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink3">
        {new Date(conf.startDate).toLocaleDateString()}
      </span>
      <span
        className={`font-display text-[14px] overflow-hidden text-ellipsis whitespace-nowrap ${nameClass}`}
      >
        {conf.name}
        {conf.premium ? (
          conf.premiumImage ? (
            <img
              src={conf.premiumImage}
              alt=""
              aria-hidden
              className="inline-block w-[22px] h-[22px] ml-1.5 align-[-7px] rounded-md object-contain bg-brand-soft p-px box-border"
            />
          ) : (
            <span className="text-brand ml-1.5 text-[0.78em]">★</span>
          )
        ) : null}
      </span>
    </button>
  );
}

export function MyConferencesPanel({
  conferences,
  myAttendances,
  onPick,
  onClose,
}: Props) {
  const { going, been } = useMemo(() => {
    const now = new Date();
    const mine = conferences.filter((c) => myAttendances.has(c.id));
    const going: Conference[] = [];
    const been: Conference[] = [];
    for (const c of mine) {
      if (isPast(c.endDate, now)) been.push(c);
      else going.push(c);
    }
    going.sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    been.sort((a, b) => (a.endDate > b.endDate ? -1 : 1));
    return { going, been };
  }, [conferences, myAttendances]);

  return (
    <FloatingPanel
      side="top-right"
      onClose={onClose}
      className="w-[min(360px,calc(100vw-36px))] gap-3"
    >
      <div className="flex justify-between items-center">
        <h2 className="m-0 font-display text-[1.2rem] font-normal leading-[1.1] tracking-[-0.025em] text-ink">
          My conferences
        </h2>
      </div>

      <Kicker tone="future">Going · {going.length}</Kicker>
      {going.length === 0 ? (
        <Caption>Nothing marked for the future.</Caption>
      ) : (
        <div className="flex flex-col gap-1">
          {going.map((c) => (
            <ConfRow
              key={c.id}
              conf={c}
              nameClass="text-future-mine"
              premiumStyle
              onPick={onPick}
            />
          ))}
        </div>
      )}

      <Kicker tone="past">Been · {been.length}</Kicker>
      {been.length === 0 ? (
        <Caption>Nothing marked in the past.</Caption>
      ) : (
        <div className="flex flex-col gap-1">
          {been.map((c) => (
            <ConfRow
              key={c.id}
              conf={c}
              nameClass="text-past-mine"
              premiumStyle
              onPick={onPick}
            />
          ))}
        </div>
      )}
    </FloatingPanel>
  );
}
