"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarBlankIcon, CheckCircleIcon, CursorClickIcon, EnvelopeOpenIcon, PaperPlaneTiltIcon, TargetIcon, UserMinusIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, fieldClass, PageHeading, PageShell, SearchInput, TypeLabel } from "@/components/shared/campaign-ui";
import { AXIS_TICK, ChartTip, Donut, LineLegend } from "@/components/shared/charts";
import { byNumber, byText, DataTable, type Column } from "@/components/shared/data-table";
import { Change, KpiCard } from "@/components/shared/kpi-card";
import { EmptyState } from "@/components/shared/state-panels";
import { useAnalytics } from "@/hooks/use-campaigns";
import { CHART_HEX, isSms, TYPE_HEX, TYPE_META } from "@/lib/campaign-meta";
import { addDays, formatCompact, formatDate, formatNumber, formatPercent, formatRange, formatShortDate, pct } from "@/lib/format";
import { DEMO_TODAY } from "@/lib/mock-data/campaigns";
import { campaignHref } from "@/lib/routes";
import type { AnalyticsChannel, Campaign } from "@/lib/types/campaigns";
import { cn } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;
const CHANNELS: { value: AnalyticsChannel; label: string }[] = [
  { value: "all", label: "All channels" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

const changeOf = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : 0);
const ptsOf = (now: number, before: number) => Math.round((now - before) * 10) / 10;

export function AnalyticsView() {
  const router = useRouter();
  const [days, setDays] = useState<number>(30);
  const [channel, setChannel] = useState<AnalyticsChannel>("all");
  const [q, setQ] = useState("");
  const { data, isFetching } = useAnalytics(days, channel);
  const t = data?.totals;
  const p = data?.previousTotals;
  const vs = `vs previous ${days} days`;
  const tick = (iso: string) => formatShortDate(iso);

  // Per-day bounces and unsubscribes, from the campaigns that sent that day.
  const perDay = (key: "bounces" | "unsubscribes") => (data ? data.series.map((r) => data.campaigns.filter((c) => c.sentAt!.slice(0, 10) === r.date).reduce((n, c) => n + (c[key] ?? 0) + (key === "bounces" ? (c.failed ?? 0) : 0), 0)) : undefined);

  const kpi = (label: string, value: string | undefined, change: ReactNode, spark: number[] | undefined, icon: typeof PaperPlaneTiltIcon, tone: "violet" | "orange" | "green" | "blue" | "pink" | "neutral") => <KpiCard key={label} icon={icon} label={label} value={value} change={change} spark={spark} tone={tone} loading={!data} />;
  const pctChange = (now: number, before: number, invert = false) => <Change value={changeOf(now, before)} text={`${Math.abs(changeOf(now, before)).toFixed(1)}%`} suffix={vs} invert={invert} />;
  const ptsChange = (now: number, before: number, invert = false, digits = 1) => <Change value={ptsOf(now, before)} text={`${Math.abs(ptsOf(now, before)).toFixed(digits)} pts`} suffix={vs} invert={invert} />;

  const term = q.trim().toLowerCase();
  const table = data?.campaigns.filter((c) => !term || c.name.toLowerCase().includes(term) || c.audience.toLowerCase().includes(term));
  const best = data ? [...data.campaigns].filter((c) => c.type === "email" || c.type === "sms").sort((a, b) => (b.clickRate ?? 0) - (a.clickRate ?? 0)).slice(0, 5) : undefined;
  const compare = data ? [...data.campaigns].filter((c) => !isSms(c)).slice(0, 8).map((c) => ({ name: c.name.length > 18 ? `${c.name.slice(0, 17)}…` : c.name, title: c.name, openRate: c.openRate ?? 0, clickRate: c.clickRate ?? 0 })) : [];

  const columns: Column<Campaign>[] = [
    {
      key: "name",
      label: "Campaign",
      sort: byText((c) => c.name),
      render: (c) => (
        <Link href={campaignHref(c.id)} onClick={(e) => e.stopPropagation()} className="block max-w-[240px] truncate font-semibold text-ink hover:text-brand">
          {c.name}
        </Link>
      ),
    },
    { key: "type", label: "Channel", render: (c) => <TypeLabel type={c.type} />, hideBelow: "md" },
    { key: "sent-at", label: "Sent", sort: byText((c) => c.sentAt), render: (c) => <span className="whitespace-nowrap">{formatDate(c.sentAt!)}</span> },
    { key: "sent", label: "Sent to", align: "right", sort: byNumber((c) => c.sent), render: (c) => formatNumber(c.sent ?? 0) },
    { key: "delivered", label: "Delivered", align: "right", sort: byNumber((c) => pct(c.delivered ?? 0, c.sent ?? 0)), render: (c) => formatPercent(pct(c.delivered ?? 0, c.sent ?? 0)) },
    { key: "open", label: "Open rate", align: "right", sort: byNumber((c) => (isSms(c) ? -1 : c.openRate)), render: (c) => (isSms(c) ? <span className="text-ink-faint">—</span> : <span className="font-medium text-ink">{formatPercent(c.openRate ?? 0)}</span>) },
    { key: "ctr", label: "CTR", align: "right", sort: byNumber((c) => c.clickRate), render: (c) => <span className="font-medium text-ink">{formatPercent(c.clickRate ?? 0)}</span> },
    { key: "bounce", label: "Bounce", align: "right", sort: byNumber((c) => pct((c.bounces ?? 0) + (c.failed ?? 0), c.sent ?? 0)), render: (c) => formatPercent(pct((c.bounces ?? 0) + (c.failed ?? 0), c.sent ?? 0)), hideBelow: "lg" },
    { key: "unsub", label: "Unsub.", align: "right", sort: byNumber((c) => pct(c.unsubscribes ?? 0, c.delivered ?? 0)), render: (c) => formatPercent(pct(c.unsubscribes ?? 0, c.delivered ?? 0), 2), hideBelow: "lg" },
    { key: "conv", label: "Conversions", align: "right", sort: byNumber((c) => c.conversions), render: (c) => formatNumber(c.conversions ?? 0) },
  ];

  return (
    <PageShell>
      <PageHeading
        crumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Analytics" }]}
        title="Analytics"
        description="How your campaigns perform over time, across channels and audiences."
        actions={
          <>
            <div className="flex rounded-lg border border-line bg-white p-0.5" role="radiogroup" aria-label="Channel">
              {CHANNELS.map((c) => (
                <button key={c.value} type="button" role="radio" aria-checked={channel === c.value} onClick={() => setChannel(c.value)} className={cn("h-8 rounded-md px-3 text-[13px] font-medium transition-colors", channel === c.value ? "bg-campaign-tint text-campaign-primary" : "text-ink-muted hover:text-ink")}>
                  {c.label}
                </button>
              ))}
            </div>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger aria-label="Date range" className={cn(fieldClass, "h-10 w-auto gap-3 rounded-lg pr-3 pl-3.5 text-[13.5px] font-medium text-ink [&>svg:last-child]:hidden")}>
                <SelectValue>{formatRange(addDays(DEMO_TODAY, -(days - 1)), DEMO_TODAY)}</SelectValue>
                <CalendarBlankIcon size={17} aria-hidden className="text-ink-muted" />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                {RANGES.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    Last {d} days <span className="text-ink-muted">· {formatRange(addDays(DEMO_TODAY, -(d - 1)), DEMO_TODAY)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className={cn("mt-5 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7 transition-opacity", isFetching && data && "opacity-70")} aria-live="polite">
        {kpi(channel === "sms" ? "Messages sent" : "Total sent", t && formatNumber(t.sent), t && p && pctChange(t.sent, p.sent), data?.series.map((r) => r.sent), PaperPlaneTiltIcon, "orange")}
        {kpi("Delivered", t && formatNumber(t.delivered), t && p && ptsChange(t.deliveryRate, p.deliveryRate), data?.series.map((r) => r.sent), CheckCircleIcon, "green")}
        {kpi("Open rate", t && (channel === "sms" ? "—" : formatPercent(t.openRate)), t && p && (channel === "sms" ? <span className="text-[12px] text-ink-muted">SMS has no opens</span> : ptsChange(t.openRate, p.openRate)), data?.series.map((r) => pct(r.opens, r.sent)), EnvelopeOpenIcon, "violet")}
        {kpi("Click-through rate", t && formatPercent(t.clickRate), t && p && ptsChange(t.clickRate, p.clickRate), data?.series.map((r) => pct(r.clicks, r.sent)), CursorClickIcon, "blue")}
        {kpi("Bounce rate", t && formatPercent(t.bounceRate), t && p && ptsChange(t.bounceRate, p.bounceRate, true), perDay("bounces"), WarningIcon, "pink")}
        {kpi("Unsubscribe rate", t && formatPercent(t.unsubscribeRate, 2), t && p && ptsChange(t.unsubscribeRate, p.unsubscribeRate, true, 2), perDay("unsubscribes"), UserMinusIcon, "neutral")}
        {kpi("Conversions", t && formatNumber(t.conversions), t && p && pctChange(t.conversions, p.conversions), data?.series.map((r) => r.conversions), TargetIcon, "green")}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card label="Campaign performance" className="xl:col-span-2">
          <CardHeader title="Campaign Performance" subtitle={`Messages sent per day · ${data ? formatNumber(t!.campaigns) : "…"} campaigns`} />
          <ChartBox empty={!!t && t.sent === 0} label="Messages sent per day">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.series} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={CHART_HEX.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={tick} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} dy={6} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={48} allowDecimals={false} />
                <Tooltip cursor={{ stroke: "#C4B5FD", strokeDasharray: "3 3" }} content={({ active, payload, label }) => <ChartTip active={active} payload={payload} title={label ? formatDate(String(label)) : undefined} />} />
                <Line type="monotone" dataKey="sent" name="Sent" stroke={CHART_HEX.violet} strokeWidth={2.2} dot={false} activeDot={{ r: 5, strokeWidth: 2, fill: "#fff" }} isAnimationActive={false} />
                <Line type="monotone" dataKey="conversions" name="Conversions" stroke={CHART_HEX.green} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
          <LineLegend items={[{ label: "Sent", color: CHART_HEX.violet }, { label: "Conversions", color: CHART_HEX.green }]} className="px-5 pb-4" />
        </Card>

        <Card label="Channel performance">
          <CardHeader title="Channel Breakdown" subtitle="Sent by channel in this period" />
          {!data ? (
            <Skeleton className="mx-5 mb-5 h-56 rounded-xl" />
          ) : (
            <div className="flex flex-col items-center gap-4 px-5 pb-5">
              <Donut label="Sent by channel" data={data.channels.map((c) => ({ name: TYPE_META[c.type].label, value: c.sent, color: TYPE_HEX[c.type] }))} center={formatCompact(t!.sent)} centerLabel="sent" size={150} thickness={20} />
              <ul className="w-full space-y-2">
                {data.channels.map((c) => (
                  <li key={c.type} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-[12.5px]">
                    <span className="flex items-center gap-2 text-ink-body">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: TYPE_HEX[c.type] }} aria-hidden />
                      {TYPE_META[c.type].label}
                    </span>
                    <span className="text-ink tabular-nums">{formatNumber(c.sent)}</span>
                    <span className="w-[86px] text-right text-ink-muted tabular-nums">{formatPercent(c.clickRate)} CTR</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card label="Engagement over time" className="xl:col-span-2">
          <CardHeader title="Engagement Over Time" subtitle="Opens, clicks and conversions per day" />
          <ChartBox empty={!!t && t.sent === 0} label="Opens, clicks and conversions per day">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.series} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <defs>
                  {(["opens", "clicks"] as const).map((k) => (
                    <linearGradient key={k} id={`an-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={k === "opens" ? CHART_HEX.orange : CHART_HEX.blue} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={k === "opens" ? CHART_HEX.orange : CHART_HEX.blue} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke={CHART_HEX.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={tick} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} dy={6} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={48} allowDecimals={false} />
                <Tooltip cursor={{ stroke: "#C4B5FD", strokeDasharray: "3 3" }} content={({ active, payload, label }) => <ChartTip active={active} payload={payload} title={label ? formatDate(String(label)) : undefined} />} />
                {channel !== "sms" && <Area type="monotone" dataKey="opens" name="Opens" stroke={CHART_HEX.orange} strokeWidth={2} fill="url(#an-opens)" isAnimationActive={false} />}
                <Area type="monotone" dataKey="clicks" name="Clicks" stroke={CHART_HEX.blue} strokeWidth={2} fill="url(#an-clicks)" isAnimationActive={false} />
                <Area type="monotone" dataKey="conversions" name="Conversions" stroke={CHART_HEX.green} strokeWidth={2} fillOpacity={0} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartBox>
          <LineLegend items={[...(channel !== "sms" ? [{ label: "Opens", color: CHART_HEX.orange }] : []), { label: "Clicks", color: CHART_HEX.blue }, { label: "Conversions", color: CHART_HEX.green }]} className="px-5 pb-4" />
        </Card>

        <Card label="Best-performing campaigns">
          <CardHeader title="Best Performing" subtitle="Highest click-through rate" />
          {!best ? (
            <Skeleton className="mx-5 mb-5 h-56 rounded-xl" />
          ) : best.length === 0 ? (
            <EmptyState icon={TargetIcon} title="Nothing sent in this period" className="py-10" />
          ) : (
            <ol className="space-y-1 px-3 pb-3">
              {best.map((c, i) => (
                <li key={c.id}>
                  <Link href={campaignHref(c.id)} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-campaign-surface">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-campaign-tint text-[12px] font-semibold text-campaign-primary">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{c.name}</span>
                      <span className="block text-[12px] text-ink-muted">
                        {TYPE_META[c.type].label} · {formatNumber(c.sent ?? 0)} sent
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-[13px] font-semibold text-campaign-depth tabular-nums">{formatPercent(c.clickRate ?? 0)}</span>
                      <span className="block text-[11px] text-ink-muted">CTR</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card label="Open and click comparison" className="xl:col-span-2">
          <CardHeader title="Opens vs Clicks" subtitle="Open rate and click-through rate by email campaign" />
          <ChartBox empty={!!data && compare.length === 0} label="Open and click rate by campaign" emptyText={channel === "sms" ? "SMS campaigns have no open tracking." : undefined}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compare} margin={{ top: 8, right: 12, bottom: 0, left: -8 }} barGap={2}>
                <CartesianGrid stroke={CHART_HEX.grid} vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={0} dy={6} height={40} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} width={44} />
                <Tooltip cursor={{ fill: "#F3E8FF", opacity: 0.6 }} content={({ active, payload }) => <ChartTip active={active} payload={payload} title={(payload?.[0]?.payload as { title?: string } | undefined)?.title} format={(v) => formatPercent(v)} />} />
                <Bar dataKey="openRate" name="Open rate" fill={CHART_HEX.violet} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                <Bar dataKey="clickRate" name="Click-through rate" fill={CHART_HEX.orange} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
          <LineLegend items={[{ label: "Open rate", color: CHART_HEX.violet }, { label: "Click-through rate", color: CHART_HEX.orange }]} className="px-5 pb-4" />
        </Card>

        <Card label="Audience growth">
          <CardHeader title="Audience Growth" subtitle={data ? `${formatNumber(data.growth.reduce((n, g) => n + g.added, 0))} new contacts · ${formatNumber(data.growth[data.growth.length - 1]?.total ?? 0)} total` : "…"} />
          <ChartBox label="Total contacts per day" height="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.growth} margin={{ top: 8, right: 12, bottom: 0, left: -4 }}>
                <defs>
                  <linearGradient id="an-growth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_HEX.violet} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={CHART_HEX.violet} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_HEX.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={tick} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={28} dy={6} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={48} domain={["dataMin - 100", "dataMax + 50"]} />
                <Tooltip cursor={{ stroke: "#C4B5FD", strokeDasharray: "3 3" }} content={({ active, payload, label }) => <ChartTip active={active} payload={payload} title={label ? formatDate(String(label)) : undefined} />} />
                <Area type="monotone" dataKey="total" name="Total contacts" stroke={CHART_HEX.violet} strokeWidth={2} fill="url(#an-growth)" isAnimationActive={false} />
                <Area type="monotone" dataKey="added" name="New contacts" stroke={CHART_HEX.green} strokeWidth={0} fillOpacity={0} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartBox>
        </Card>
      </div>

      <Card className="mt-4" label="Campaign comparison">
        <CardHeader title="Campaign Comparison" subtitle="Every campaign that started sending in this period" action={<SearchInput value={q} onChange={setQ} placeholder="Filter campaigns…" label="Filter campaigns" className="w-[220px]" />} />
        <DataTable
          rows={table}
          columns={columns}
          rowKey={(c) => c.id}
          rowLabel={(c) => c.name}
          onRowClick={(c) => router.push(campaignHref(c.id))}
          defaultSort={{ key: "sent-at", dir: "desc" }}
          noun="campaigns"
          caption="Campaign performance comparison"
          minWidth={960}
          empty={<EmptyState icon={PaperPlaneTiltIcon} title={term ? "No campaigns match" : "No campaigns sent in this period"} hint={term ? "Try another name." : "Choose a longer date range."} className="py-10" />}
        />
      </Card>
      <p className="mt-4 text-[12px] text-ink-muted">Figures come from the demo campaign data in this browser. Rates: opens of delivered email, clicks of delivered messages, bounces (and failed SMS) of sent.</p>
    </PageShell>
  );
}

function ChartBox({ children, empty, label, emptyText, height = "h-[260px]" }: { children: ReactNode; empty?: boolean; label: string; emptyText?: string; height?: string }) {
  if (empty) return <EmptyState icon={PaperPlaneTiltIcon} title="No data in this period" hint={emptyText ?? "Choose a longer date range or another channel."} className="py-10" />;
  return (
    <div className={cn("w-full px-3 sm:px-5", height)} role="img" aria-label={label}>
      {children}
    </div>
  );
}
