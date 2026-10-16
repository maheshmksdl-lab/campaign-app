"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import {
  AddressBookIcon,
  BrowserIcon,
  CalendarBlankIcon,
  CaretRightIcon,
  ChatCircleDotsIcon,
  EnvelopeSimpleIcon,
  InfoIcon,
  ListBulletsIcon,
  NotePencilIcon,
  StackIcon,
  TrashIcon,
  TreeStructureIcon,
  TrendUpIcon,
  UserPlusIcon,
} from "@phosphor-icons/react/dist/ssr";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardHeader, fieldClass, StatusBadge, td, th, TypeIcon, viewAllClass, ViewAll } from "@/components/shared/campaign-ui";
import { AXIS_TICK, ChartTip, Donut, LineLegend } from "@/components/shared/charts";
import { Change } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/state-panels";
import { CHART_HEX, hasPlannedTime, isSms, TYPE_HEX, TYPE_META } from "@/lib/campaign-meta";
import { formatCompact, formatDate, formatMonth, formatNumber, formatPercent, formatRelative, formatShortDate, formatTime, parseDate, pct } from "@/lib/format";
import { notInPhase } from "@/lib/phase";
import { campaignHref, CAMPAIGNS_ROUTE } from "@/lib/routes";
import type { ActivityEntry, DashboardData } from "@/lib/types/campaigns";
import { cn } from "@/lib/utils";

function RowsSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3.5 px-5 pb-5", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

/** "View all" for modules that aren't in this release: same look, explains itself. */
function PhaseLink({ feature }: { feature: string }) {
  return (
    <button type="button" onClick={() => notInPhase(feature)} className={viewAllClass}>
      View all
    </button>
  );
}

// ── Campaign performance ─────────────────────────────────────────────

type Group = "day" | "week";

const PERF_SERIES = [
  { key: "emailsSent", label: "Emails Sent", color: CHART_HEX.violet },
  { key: "opens", label: "Opens", color: CHART_HEX.orange },
  { key: "clicks", label: "Clicks", color: CHART_HEX.blue },
] as const;

export function PerformanceCard({ data, className }: { data: DashboardData | undefined; className?: string }) {
  const [groupPref, setGroup] = useState<Group>("day");
  const weeklyOk = (data?.range.days ?? 7) > 7;
  const group: Group = weeklyOk ? groupPref : "day";

  const points = useMemo(() => {
    if (!data) return [];
    const days = data.days;
    if (group === "day") return days.map((d) => ({ label: formatShortDate(d.date), title: formatDate(d.date), emailsSent: d.emailsSent, opens: d.opens, clicks: d.clicks }));
    // Weeks counted back from today so the latest week is complete.
    const out = [];
    for (let end = days.length; end > 0; end -= 7) {
      const chunk = days.slice(Math.max(0, end - 7), end);
      out.unshift({
        label: formatShortDate(chunk[0].date),
        title: `${formatShortDate(chunk[0].date)} – ${formatShortDate(chunk[chunk.length - 1].date)}`,
        emailsSent: chunk.reduce((s, d) => s + d.emailsSent, 0),
        opens: chunk.reduce((s, d) => s + d.opens, 0),
        clicks: chunk.reduce((s, d) => s + d.clicks, 0),
      });
    }
    return out;
  }, [data, group]);

  return (
    <Card label="Campaign performance" className={cn("flex flex-col", className)}>
      <CardHeader
        title={
          <>
            Campaign Performance
            <UiTooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="About this chart" className="rounded-full text-ink-faint hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-brand-action">
                  <InfoIcon size={15} aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-60">Emails sent by campaigns, automations and journeys, with the opens and clicks recorded each day.</TooltipContent>
            </UiTooltip>
          </>
        }
        action={
          <Select value={group} onValueChange={(v) => setGroup(v as Group)}>
            <SelectTrigger aria-label="Group by" className={cn(fieldClass, "h-8 w-[104px] gap-1.5 text-[12.5px] font-medium text-ink-body")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectItem value="day">By Day</SelectItem>
              <SelectItem value="week" disabled={!weeklyOk}>
                By Week{!weeklyOk && " (30+ days)"}
              </SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="flex flex-1 flex-col px-3 pb-4 sm:px-5">
        <LineLegend items={PERF_SERIES.map((s) => ({ label: s.label, color: s.color }))} className="mb-2 px-2 sm:px-8" />
        {!data ? (
          <Skeleton className="h-[232px] w-full rounded-lg" />
        ) : (
          <div className="h-[232px] w-full" role="img" aria-label={`Emails sent, opens and clicks ${group === "day" ? "per day" : "per week"}, ${formatDate(data.range.start)} to ${formatDate(data.range.end)}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid stroke={CHART_HEX.grid} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} dy={6} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={48} />
                <Tooltip cursor={{ stroke: "#C4B5FD", strokeDasharray: "3 3" }} content={({ active, payload }) => <ChartTip active={active} payload={payload} title={(payload?.[0]?.payload as { title?: string } | undefined)?.title} />} />
                {PERF_SERIES.map((s) => (
                  <Line key={s.key} type="linear" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={points.length <= 14 ? { r: 3.5, strokeWidth: 2, fill: "#fff" } : false} activeDot={{ r: 5, strokeWidth: 2, fill: "#fff" }} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Campaigns by channel ─────────────────────────────────────────────

export function ChannelsCard({ data, className }: { data: DashboardData | undefined; className?: string }) {
  const total = data?.channels.reduce((s, c) => s + c.count, 0) ?? 0;
  return (
    <Card label="Campaigns by channel" className={cn("flex flex-col", className)}>
      <CardHeader title="Campaigns by Channel" subtitle="Active and planned campaigns (archived excluded)" />
      {!data ? (
        <div className="flex flex-1 items-center gap-6 px-5 pb-5">
          <Skeleton className="size-[172px] rounded-full" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-6 sm:flex-row sm:gap-8">
          <Donut label="Campaigns by channel" data={data.channels.map((c) => ({ name: TYPE_META[c.type].label, value: c.count, color: TYPE_HEX[c.type] }))} center={formatNumber(total)} centerLabel="Total" />
          <ul className="w-full max-w-[250px] min-w-[200px] space-y-3.5 sm:w-auto sm:flex-1">
            {data.channels.map((c) => (
              <li key={c.type}>
                <Link href={`${CAMPAIGNS_ROUTE}?type=${c.type}`} className="flex items-center gap-2.5 rounded text-[13px] leading-5 text-ink-body hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-action">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: TYPE_HEX[c.type] }} aria-hidden />
                  <span className="flex-1">{TYPE_META[c.type].label}</span>
                  <span className="whitespace-nowrap text-ink tabular-nums">
                    {c.count} <span className="text-ink-muted">({formatPercent(pct(c.count, total))})</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ── Recent activity ──────────────────────────────────────────────────

const ACTIVITY_META: Record<ActivityEntry["kind"], { icon: Icon; fg: string; bg: string }> = {
  email: { icon: EnvelopeSimpleIcon, fg: "var(--ch-email-fg)", bg: "var(--ch-email-bg)" },
  sms: { icon: ChatCircleDotsIcon, fg: "var(--ch-sms-fg)", bg: "var(--ch-sms-bg)" },
  automation: { icon: TreeStructureIcon, fg: "var(--campaign-action)", bg: "var(--campaign-tint)" },
  journey: { icon: TreeStructureIcon, fg: "var(--ch-journey-fg)", bg: "var(--ch-journey-bg)" },
  contacts: { icon: UserPlusIcon, fg: "var(--ch-journey-fg)", bg: "var(--ch-journey-bg)" },
  list: { icon: ListBulletsIcon, fg: "var(--ch-journey-fg)", bg: "var(--ch-journey-bg)" },
  segment: { icon: StackIcon, fg: "var(--campaign-action)", bg: "var(--campaign-tint)" },
  template: { icon: NotePencilIcon, fg: "var(--ch-email-fg)", bg: "var(--ch-email-bg)" },
  form: { icon: BrowserIcon, fg: "var(--ch-automation-fg)", bg: "var(--ch-automation-bg)" },
  deleted: { icon: TrashIcon, fg: "var(--neutral-fg)", bg: "var(--neutral-bg)" },
};

export function ActivityCard({ data, className }: { data: DashboardData | undefined; className?: string }) {
  return (
    <Card label="Recent activity" className={className}>
      <CardHeader title="Recent Activity" action={<PhaseLink feature="Activity history" />} />
      {!data ? (
        <RowsSkeleton />
      ) : (
        <ul className="space-y-1 px-3 pb-3">
          {data.activity.map((a) => {
            const m = ACTIVITY_META[a.kind];
            const IconCmp = m.icon;
            const body = (
              <>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ color: m.fg, backgroundColor: m.bg }} aria-hidden>
                  <IconCmp size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-5 font-medium text-ink">{a.title}</span>
                  <span className="block truncate text-[12px] leading-4 text-ink-muted">{a.detail}</span>
                </span>
                <time dateTime={a.at} className="shrink-0 self-start pt-0.5 text-[11.5px] text-ink-muted">
                  {formatRelative(a.at, data.now)}
                </time>
              </>
            );
            return (
              <li key={a.id}>
                {a.campaignId ? (
                  <Link href={campaignHref(a.campaignId)} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-campaign-surface focus-visible:outline-2 focus-visible:outline-brand-action">
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-2 py-2">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ── Best performing campaigns ────────────────────────────────────────

export function BestCampaignsCard({ data, className }: { data: DashboardData | undefined; className?: string }) {
  const router = useRouter();
  return (
    <Card label="Best performing campaigns" className={className}>
      <CardHeader title="Best Performing Campaigns" subtitle="Highest click-through rate, last 30 days" action={<ViewAll href={`${CAMPAIGNS_ROUTE}?status=sent&sort=click-rate`} />} />
      {!data ? (
        <RowsSkeleton />
      ) : data.best.length === 0 ? (
        <EmptyState icon={TrendUpIcon} title="No sent campaigns yet" hint="Results appear here once campaigns go out." className="py-10" />
      ) : (
        <div className="relative overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[360px] table-fixed border-collapse">
            <caption className="sr-only">Best performing campaigns by click-through rate</caption>
            <colgroup>
              <col />
              <col className="w-[46px]" />
              <col className="w-[60px]" />
              <col className="w-[54px]" />
              <col className="w-[64px]" />
            </colgroup>
            <thead>
              <tr className="border-y border-line-soft">
                <th scope="col" className={cn(th, "text-ink")}>
                  Campaign
                </th>
                <th scope="col" className={cn(th, "text-center text-ink")}>
                  Type
                </th>
                <th scope="col" className={cn(th, "text-right text-ink")}>
                  Opens
                </th>
                <th scope="col" className={cn(th, "text-right text-ink")}>
                  Clicks
                </th>
                <th scope="col" className={cn(th, "text-right text-ink")}>
                  <abbr title="Click-through rate: clicks ÷ delivered" className="no-underline">
                    CTR
                  </abbr>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.best.map((c) => (
                <tr key={c.id} onClick={() => router.push(campaignHref(c.id))} className="cursor-pointer border-b border-line-soft transition-colors last:border-0 hover:bg-campaign-surface">
                  <td className={cn(td, "py-2.5")}>
                    <Link href={campaignHref(c.id)} onClick={(e) => e.stopPropagation()} className="block truncate rounded font-medium text-ink hover:text-brand focus-visible:outline-2 focus-visible:outline-brand-action">
                      {c.name}
                    </Link>
                    <span className="block text-[12px] leading-4 text-ink-muted">{formatDate(c.sentAt!)}</span>
                  </td>
                  <td className={cn(td, "py-2.5 text-center")}>
                    <TypeIcon type={c.type} size={28} className="mx-auto" />
                  </td>
                  <td className={cn(td, "py-2.5 text-right tabular-nums")} title={isSms(c) ? "SMS has no open tracking" : undefined}>
                    {isSms(c) ? <span className="text-ink-faint">—</span> : formatNumber(c.opens ?? 0)}
                  </td>
                  <td className={cn(td, "py-2.5 text-right tabular-nums")}>{formatNumber(c.clicks ?? 0)}</td>
                  <td className={cn(td, "py-2.5 text-right font-medium text-[var(--success)] tabular-nums")}>{formatPercent(c.clickRate ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Contact growth ───────────────────────────────────────────────────

export function ContactGrowthCard({ data, className }: { data: DashboardData | undefined; className?: string }) {
  const points = useMemo(() => (data?.growth ?? []).map((g) => ({ label: formatShortDate(g.date), title: formatDate(g.date), total: g.total })), [data]);
  const latest = points[points.length - 1]?.total ?? 0;
  const min = Math.min(...points.map((p) => p.total));
  const ticks = Math.max(1, Math.floor(points.length / 4));
  return (
    <Card label="Contact growth" className={cn("flex flex-col", className)}>
      <CardHeader title="Contact Growth" action={<PhaseLink feature="Contacts" />} />
      {!data ? (
        <div className="space-y-3 px-5 pb-5">
          <Skeleton className="h-[200px] w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col px-3 pb-4 sm:px-5">
          <p className="-mt-1 mb-1 pr-2 text-right text-[13px] font-semibold text-campaign-primary tabular-nums">{formatNumber(latest)}</p>
          <div className="h-[188px] w-full" role="img" aria-label={`Total contacts grew from ${formatNumber(points[0].total)} to ${formatNumber(latest)} between ${points[0].title} and ${points[points.length - 1].title}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 6, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_HEX.violet} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={CHART_HEX.violet} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_HEX.grid} vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={ticks - 1} dy={6} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={44} domain={[Math.max(0, Math.floor((min * 0.9) / 1000) * 1000), "auto"]} />
                <Tooltip cursor={{ stroke: "#C4B5FD", strokeDasharray: "3 3" }} content={({ active, payload }) => <ChartTip active={active} payload={payload} title={(payload?.[0]?.payload as { title?: string } | undefined)?.title} />} />
                <Area type="monotone" dataKey="total" name="Total contacts" stroke={CHART_HEX.violet} strokeWidth={2} fill="url(#growth-fill)" dot={false} activeDot={{ r: 4.5, strokeWidth: 2, fill: "#fff" }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-campaign-surface/70 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[13px] leading-5 font-semibold text-ink">New Contacts</p>
              <p className="truncate text-[11.5px] leading-4 text-ink-muted">
                vs {formatShortDate(data.newContacts.previousStart)} – {formatShortDate(data.newContacts.previousEnd)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-[18px] font-semibold text-ink tabular-nums">+{formatNumber(data.newContacts.value)}</span>
              <Change value={data.newContacts.change} text={formatPercent(Math.abs(data.newContacts.change))} />
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Upcoming campaigns ───────────────────────────────────────────────

export function UpcomingCard({ data, className }: { data: DashboardData | undefined; className?: string }) {
  return (
    <Card label="Upcoming campaigns" className={className}>
      <CardHeader title="Upcoming Campaigns" action={<ViewAll href={`${CAMPAIGNS_ROUTE}?status=scheduled&sort=oldest`} />} />
      {!data ? (
        <RowsSkeleton rows={4} />
      ) : data.upcoming.length === 0 ? (
        <EmptyState icon={CalendarBlankIcon} title="Nothing scheduled" hint="Schedule a draft to see it here." className="py-10" />
      ) : (
        <ul className="space-y-2.5 px-5 pb-5">
          {data.upcoming.map((c) => {
            const timed = hasPlannedTime(c);
            return (
              <li key={c.id}>
                <Link href={campaignHref(c.id)} className="flex items-center gap-3.5 rounded-xl border border-line-soft p-2.5 transition-colors hover:border-brand-soft hover:bg-campaign-surface focus-visible:outline-2 focus-visible:outline-brand-action">
                  <span className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-campaign-muted py-1.5" aria-hidden>
                    <span className="text-[10.5px] leading-3 font-semibold tracking-wide text-[var(--ch-email-fg)]">{formatMonth(c.scheduledAt!)}</span>
                    <span className="text-[19px] leading-6 font-semibold text-ink tabular-nums">{parseDate(c.scheduledAt!).getDate()}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] leading-5 font-medium text-ink">{c.name}</span>
                    <span className="block truncate text-[12px] leading-4 text-ink-muted">
                      <span className="sr-only">{formatDate(c.scheduledAt!)}, </span>
                      {timed ? formatTime(c.scheduledAt!) : "Time not set"} <span aria-hidden>·</span> To {formatNumber(c.recipients)} {isSms(c) ? "numbers" : "contacts"}
                    </span>
                  </span>
                  <StatusBadge status={c.status} className="shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ── Quick actions ────────────────────────────────────────────────────

export function QuickActionsBar({ onCreate }: { onCreate: (type: "email" | "sms") => void }) {
  const items: { label: string; icon: Icon; fg: string; bg: string; onClick: () => void }[] = [
    { label: "Create Email Campaign", icon: EnvelopeSimpleIcon, fg: "var(--ch-email-fg)", bg: "var(--ch-email-bg)", onClick: () => onCreate("email") },
    { label: "Create SMS Campaign", icon: ChatCircleDotsIcon, fg: "var(--ch-sms-fg)", bg: "var(--ch-sms-bg)", onClick: () => onCreate("sms") },
    { label: "Import Contacts", icon: AddressBookIcon, fg: "var(--campaign-action)", bg: "var(--campaign-tint)", onClick: () => notInPhase("Importing contacts") },
    { label: "Create Automation", icon: TreeStructureIcon, fg: "var(--ch-automation-fg)", bg: "var(--ch-automation-bg)", onClick: () => notInPhase("Automation builder") },
    { label: "Create Signup Form", icon: BrowserIcon, fg: "var(--ch-journey-fg)", bg: "var(--ch-journey-bg)", onClick: () => notInPhase("Signup forms") },
  ];
  return (
    <Card label="Quick actions" className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:gap-4 lg:px-5">
      <h2 className="shrink-0 text-[15px] leading-6 font-semibold text-ink lg:w-[104px]">Quick Actions</h2>
      <div className="grid flex-1 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {items.map(({ label, icon: IconCmp, fg, bg, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-white px-3 py-2.5 text-left transition-colors hover:border-brand-soft hover:bg-campaign-surface focus-visible:outline-2 focus-visible:outline-brand-action"
          >
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ color: fg, backgroundColor: bg }} aria-hidden>
              <IconCmp size={18} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{label}</span>
            <CaretRightIcon size={13} aria-hidden className="shrink-0 text-ink-faint transition-colors group-hover:text-brand" />
          </button>
        ))}
      </div>
    </Card>
  );
}
