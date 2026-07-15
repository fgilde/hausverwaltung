import { money } from "@/lib/format";

// Kompakte, abhängigkeitsfreie SVG-Charts fürs Dashboard.
// Farbpaar (Soll/Zahlung) ist CVD-geprüft; Werte zusätzlich als Label/Tooltip.
const SOLL = "#2563EB";
const ZAHLUNG = "#E0781E";

export function MonthlyBars({
  data,
  locale,
  labels,
}: {
  data: { label: string; soll: number; zahlung: number }[];
  locale: string;
  labels: { soll: string; zahlung: string };
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.soll, d.zahlung]));
  const W = 520;
  const H = 180;
  const padB = 24;
  const padT = 8;
  const chartH = H - padB - padT;
  const groupW = W / data.length;
  const barW = Math.min(18, groupW / 3);

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: SOLL }} />{labels.soll}</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: ZAHLUNG }} />{labels.zahlung}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${labels.soll} / ${labels.zahlung}`}>
        {/* Grundlinie */}
        <line x1={0} y1={H - padB} x2={W} y2={H - padB} className="stroke-border" strokeWidth={1} />
        {data.map((d, i) => {
          const cx = i * groupW + groupW / 2;
          const hs = (d.soll / max) * chartH;
          const hz = (d.zahlung / max) * chartH;
          return (
            <g key={i}>
              <rect x={cx - barW - 1} y={H - padB - hs} width={barW} height={hs} rx={3} fill={SOLL}>
                <title>{`${d.label} · ${labels.soll}: ${money(d.soll, locale)}`}</title>
              </rect>
              <rect x={cx + 1} y={H - padB - hz} width={barW} height={hz} rx={3} fill={ZAHLUNG}>
                <title>{`${d.label} · ${labels.zahlung}: ${money(d.zahlung, locale)}`}</title>
              </rect>
              <text x={cx} y={H - padB + 15} textAnchor="middle" className="fill-muted-foreground" fontSize={11}>
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function OccupancyDonut({
  occupied,
  vacant,
  rate,
  labels,
}: {
  occupied: number;
  vacant: number;
  rate: number;
  labels: { occupied: string; vacant: string };
}) {
  const total = Math.max(1, occupied + vacant);
  const r = 52;
  const C = 2 * Math.PI * r;
  const occLen = (occupied / total) * C;

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 120 120" className="size-32 shrink-0">
        <circle cx={60} cy={60} r={r} fill="none" className="stroke-muted" strokeWidth={14} />
        <circle
          cx={60}
          cy={60}
          r={r}
          fill="none"
          stroke="#059669"
          strokeWidth={14}
          strokeDasharray={`${occLen} ${C - occLen}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        <text x={60} y={60} textAnchor="middle" dominantBaseline="central" className="fill-foreground" fontSize={22} fontWeight={700}>
          {rate}%
        </text>
      </svg>
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-sm" style={{ background: "#059669" }} />
          {labels.occupied}: <span className="font-medium">{occupied}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-sm bg-muted" />
          {labels.vacant}: <span className="font-medium">{vacant}</span>
        </div>
      </div>
    </div>
  );
}
