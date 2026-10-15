"use client";

/**
 * Chart building blocks on Recharts, styled for the Campaigns palette:
 * thin lines, a soft lavender grid, small dots and a white tooltip card.
 */
import { useId, type ReactNode } from "react";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_HEX } from "@/lib/campaign-meta";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const AXIS_TICK = { fill: CHART_HEX.muted, fontSize: 11 } as const;

export interface TipRow {
  name?: unknown;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
  payload?: unknown;
}

/** White tooltip card: title, then one row per series. */
export function ChartTip({ active, payload, title, format = (v) => formatNumber(v) }: { active?: boolean; payload?: readonly TipRow[]; title?: ReactNode; format?: (v: number, row: TipRow) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[160px] rounded-lg border border-line bg-white px-3 py-2 shadow-pop">
      {title && <p className="text-[12px] leading-4 font-semibold text-ink">{title}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey ?? p.name)} className="mt-1 flex items-center gap-2 text-[12px] leading-4 text-ink-body">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
          <span className="flex-1">{String(p.name)}</span>
          <span className="font-semibold text-ink tabular-nums">{format(Number(p.value), p)}</span>
        </p>
      ))}
    </div>
  );
}

/** Legend with short line swatches, as in the design. */
export function LineLegend({ items, className }: { items: { label: string; color: string }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1", className)} aria-label="Legend">
      {items.map((s) => (
        <li key={s.label} className="inline-flex items-center gap-1.5 text-[12px] text-ink-body">
          <span className="relative h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} aria-hidden>
            <span className="absolute top-1/2 left-1/2 size-1.5 -translate-1/2 rounded-full" style={{ backgroundColor: s.color }} />
          </span>
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Tiny trend line with a soft fill, for KPI cards. Decorative: the card states the value. */
export function Sparkline({ data, color, className }: { data: number[]; color: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div className={cn("h-9 w-full", className)} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 3, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#spark-${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Doughnut with a centred total and an accessible table-like legend beside it. */
export function Donut({
  data,
  center,
  centerLabel,
  size = 172,
  thickness = 26,
  format = (v) => formatNumber(v),
  label,
}: {
  data: { name: string; value: number; color: string }[];
  center: ReactNode;
  centerLabel: string;
  size?: number;
  thickness?: number;
  format?: (v: number) => string;
  label: string;
}) {
  const nonZero = data.filter((d) => d.value > 0);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${data.map((d) => `${d.name} ${format(d.value)}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={nonZero.length ? nonZero : [{ name: "None", value: 1, color: CHART_HEX.grid }]} dataKey="value" nameKey="name" innerRadius={size / 2 - thickness} outerRadius={size / 2 - 2} paddingAngle={nonZero.length > 1 ? 1.5 : 0} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
            {(nonZero.length ? nonZero : [{ color: CHART_HEX.grid }]).map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          {nonZero.length > 0 && <Tooltip content={({ active, payload }) => <ChartTip active={active} payload={payload?.map((p) => ({ ...p, color: (p.payload as { color: string }).color }))} format={format} />} />}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[24px] leading-7 font-semibold text-ink tabular-nums">{center}</span>
        <span className="text-[12px] leading-4 text-ink-muted">{centerLabel}</span>
      </div>
    </div>
  );
}
