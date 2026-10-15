import type { ReactNode } from "react";
import Link from "next/link";
import type { Icon } from "@phosphor-icons/react";
import { ArrowDownIcon, ArrowUpIcon } from "@phosphor-icons/react/dist/ssr";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkline } from "@/components/shared/charts";
import { cn } from "@/lib/utils";

/** Icon tile tones: violet is the brand; orange / green / pink / blue follow the channel accents. */
export const KPI_TONES = {
  violet: { tile: "bg-campaign-tint text-campaign-action", line: "#7C3AED" },
  orange: { tile: "bg-[var(--ch-email-bg)] text-[var(--ch-email-fg)]", line: "#FF7D3D" },
  green: { tile: "bg-[var(--ch-sms-bg)] text-[var(--ch-sms-fg)]", line: "#2D9D78" },
  pink: { tile: "bg-[var(--ch-automation-bg)] text-[var(--ch-automation-fg)]", line: "#E85D87" },
  blue: { tile: "bg-[var(--ch-journey-bg)] text-[var(--ch-journey-fg)]", line: "#3B5998" },
  neutral: { tile: "bg-[var(--neutral-bg)] text-[var(--neutral-fg)]", line: "#777386" },
} as const;

export type KpiTone = keyof typeof KPI_TONES;

/** "↑ 8.2% vs last 7 days" — green when up, red when down; zero is neutral. */
export function Change({ value, text, suffix, invert = false }: { value: number; text: string; suffix?: ReactNode; invert?: boolean }) {
  const good = invert ? value < 0 : value > 0;
  const Arrow = value < 0 ? ArrowDownIcon : ArrowUpIcon;
  return (
    <span className="flex min-w-0 items-center gap-1 text-[12px] leading-4 text-ink-muted">
      {value !== 0 ? (
        <span className={cn("inline-flex shrink-0 items-center gap-0.5 font-medium tabular-nums", good ? "text-[var(--success)]" : "text-[var(--danger)]")}>
          <Arrow size={12} weight="bold" aria-hidden />
          <span className="sr-only">{value > 0 ? "Up" : "Down"} </span>
          {text}
        </span>
      ) : (
        <span className="shrink-0 font-medium text-ink-body">No change</span>
      )}
      {suffix && <span className="truncate">{suffix}</span>}
    </span>
  );
}

/**
 * Dashboard metric card: tinted icon, label, value, change vs the previous
 * period and a small sparkline. With `href` the whole card links somewhere.
 */
export function KpiCard({
  icon: IconCmp,
  label,
  value,
  change,
  tone = "violet",
  spark,
  href,
  loading,
}: {
  icon: Icon;
  label: string;
  value: ReactNode;
  change?: ReactNode;
  tone?: KpiTone;
  spark?: number[];
  href?: string;
  loading?: boolean;
}) {
  const t = KPI_TONES[tone];
  const body = (
    <>
      <div className="flex items-start gap-2.5">
        <span className={cn("inline-flex size-10 shrink-0 items-center justify-center rounded-xl", t.tile)} aria-hidden>
          <IconCmp size={21} weight="duotone" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] leading-4 font-medium text-ink-body">{label}</span>
          {loading ? <Skeleton className="mt-1 h-7 w-24" /> : <span className="mt-0.5 block truncate text-[23px] leading-8 font-semibold tracking-[-0.01em] text-ink tabular-nums">{value}</span>}
        </span>
      </div>
      <div className="mt-3 min-h-4">{loading ? <Skeleton className="h-3 w-32" /> : change}</div>
      <div className="mt-2.5">{loading || !spark ? <Skeleton className="h-9 w-full rounded-md opacity-60" /> : <Sparkline data={spark} color={t.line} />}</div>
    </>
  );
  const cls = "flex min-w-0 flex-col rounded-xl border border-line bg-card p-4 shadow-card";
  if (href) {
    return (
      <Link href={href} className={cn(cls, "transition-colors hover:border-brand-soft hover:bg-campaign-surface/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-action")}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}
