"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  ArrowLeftIcon,
  CalendarCheckIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  ClockIcon,
  CopyIcon,
  CursorClickIcon,
  DotsThreeIcon,
  EnvelopeOpenIcon,
  EnvelopeSimpleIcon,
  EyeIcon,
  FileDashedIcon,
  LinkSimpleIcon,
  PaperPlaneTiltIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlusCircleIcon,
  ProhibitIcon,
  UserMinusIcon,
  UsersThreeIcon,
  WarningIcon,
  XCircleIcon,
} from "@phosphor-icons/react/dist/ssr";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs, Card, CardHeader, OutlineButton, outlineButtonClass, PageShell, PrimaryButton, StatusBadge, td, th, TypeIcon, TypeLabel } from "@/components/shared/campaign-ui";
import { AXIS_TICK, ChartTip, Donut, LineLegend } from "@/components/shared/charts";
import { Change, KPI_TONES, type KpiTone } from "@/components/shared/kpi-card";
import { RowMenu } from "@/components/shared/row-menu";
import { EmptyState, ErrorState } from "@/components/shared/state-panels";
import { useCampaign } from "@/hooks/use-campaigns";
import { canPause, canResume, canSchedule, CHART_HEX, contentLocked, hasPlannedTime, isFlow, isSms, smsSegments, TYPE_META } from "@/lib/campaign-meta";
import { daysBetween, formatCompact, formatDate, formatDateTime, formatNumber, formatPercent, parseDateTime, pct, pluralize } from "@/lib/format";
import { getCampaignsListHref } from "@/lib/routes";
import type { Campaign, CampaignAnalytics, CampaignEvent } from "@/lib/types/campaigns";
import { cn } from "@/lib/utils";
import { useCampaignActions } from "./campaign-actions";

type Actions = ReturnType<typeof useCampaignActions>;

// ── Summary ──────────────────────────────────────────────────────────

function Detail({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[12px] leading-4 text-ink-muted">{label}</dt>
      <dd className="mt-1 text-[13.5px] leading-5 break-words text-ink">{children}</dd>
    </div>
  );
}

function whenLabel(c: Campaign) {
  if (c.sentAt) return { label: isFlow(c) ? "Started" : "Sent", value: formatDateTime(c.sentAt) };
  if (c.scheduledAt) return hasPlannedTime(c) ? { label: "Scheduled for", value: formatDateTime(c.scheduledAt) } : { label: "Planned date", value: `${formatDate(c.scheduledAt)} (not scheduled)` };
  return { label: "Scheduled for", value: "Not scheduled yet" };
}

function SummaryCard({ c }: { c: Campaign }) {
  const sms = isSms(c);
  const when = whenLabel(c);
  return (
    <Card label="Campaign summary">
      <CardHeader title="Campaign Summary" />
      <div className={cn("grid gap-5 px-5 pb-5", sms && "lg:grid-cols-[minmax(0,1fr)_300px]")}>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          <Detail label="Campaign name">{c.name}</Detail>
          {sms ? (
            <>
              <Detail label="Sender ID">{c.senderId}</Detail>
              <Detail label="Message length">{c.message ? `${[...c.message].length} characters · ${pluralize(smsSegments(c.message), "segment")}` : "—"}</Detail>
            </>
          ) : (
            <>
              <Detail label="Subject line" className="sm:col-span-2 xl:col-span-2">
                {c.subject || <span className="text-ink-faint">No subject yet</span>}
                {c.previewText && <span className="mt-0.5 block text-[12.5px] text-ink-muted">{c.previewText}</span>}
              </Detail>
              <Detail label="Sender">
                {c.senderName}
                <span className="block text-[12.5px] text-ink-muted">{c.senderEmail}</span>
              </Detail>
            </>
          )}
          <Detail label="Audience">{c.audience}</Detail>
          <Detail label={isFlow(c) ? "Audience size" : "Total recipients"}>{formatNumber(c.recipients)}</Detail>
          <Detail label={when.label}>{when.value}</Detail>
          <Detail label="Status">
            <StatusBadge status={c.status} />
          </Detail>
        </dl>
        {sms && (
          <div className="rounded-xl bg-campaign-muted p-4">
            <p className="mb-2 text-[12px] leading-4 text-ink-muted">Message preview</p>
            {c.message ? <p className="rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] leading-5 break-words text-ink shadow-card">{c.message}</p> : <p className="text-[13px] text-ink-faint">No message written yet</p>}
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Status banners ───────────────────────────────────────────────────

function untilLabel(at: string, now: string) {
  const mins = (parseDateTime(at).getTime() - parseDateTime(now).getTime()) / 60_000;
  if (mins <= 0) return "time has passed";
  if (mins < 60) return `in ${Math.ceil(mins)} min`;
  if (mins < 24 * 60) return `in ${Math.round(mins / 60)} h`;
  const d = daysBetween(now, at);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}

function Banner({ icon: IconCmp, tone, children, actions }: { icon: Icon; tone: "info" | "warning" | "violet" | "neutral"; children: ReactNode; actions?: ReactNode }) {
  const tones = {
    info: "border-[#D1E3FB] bg-[var(--info-bg)] [&_.b-icon]:text-[var(--info)]",
    warning: "border-[#F8DDAE] bg-[var(--warning-bg)] [&_.b-icon]:text-[var(--warning)]",
    violet: "border-brand-soft bg-campaign-surface [&_.b-icon]:text-campaign-action",
    neutral: "border-line bg-campaign-muted [&_.b-icon]:text-ink-muted",
  };
  return (
    <div role="status" className={cn("mt-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-[13px] leading-5 text-ink-body", tones[tone])}>
      <IconCmp size={18} aria-hidden className="b-icon shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

function StatusBanner({ c, now, actions }: { c: Campaign; now: string; actions: Actions }) {
  if (c.status === "scheduled" && c.scheduledAt)
    return (
      <Banner
        icon={CalendarCheckIcon}
        tone="info"
        actions={
          <>
            <OutlineButton icon={CalendarCheckIcon} className="h-8" onClick={() => actions.schedule(c)}>
              Reschedule
            </OutlineButton>
            <OutlineButton icon={PauseIcon} className="h-8" onClick={() => actions.pause(c)} disabled={actions.busy}>
              Pause
            </OutlineButton>
          </>
        }
      >
        Scheduled to send on <span className="font-semibold text-ink">{formatDateTime(c.scheduledAt)}</span> ({untilLabel(c.scheduledAt, now)}). Demo only — nothing will actually be sent.
      </Banner>
    );
  if (c.status === "sending" && isFlow(c))
    return (
      <Banner icon={PlayIcon} tone="violet" actions={<OutlineButton icon={PauseIcon} className="h-8" onClick={() => actions.pause(c)} disabled={actions.busy}>Pause</OutlineButton>}>
        This {c.type === "journey" ? "journey" : "automation"} is running — contacts in <span className="font-medium text-ink">{c.audience}</span> enter as they qualify (about {formatNumber(c.dailyVolume ?? 0)} sends a day).
      </Banner>
    );
  if (c.status === "sending") {
    const done = pct(c.sent ?? 0, c.recipients);
    return (
      <Banner icon={PaperPlaneTiltIcon} tone="violet" actions={<OutlineButton icon={PauseIcon} className="h-8" onClick={() => actions.pause(c)} disabled={actions.busy}>Pause</OutlineButton>}>
        <p>
          Sending now — <span className="font-semibold text-ink tabular-nums">{formatNumber(c.sent ?? 0)}</span> of {formatNumber(c.recipients)} sent ({formatPercent(done, 0)}).
        </p>
        <div className="mt-2 h-1.5 max-w-md overflow-hidden rounded-full bg-campaign-tint" role="progressbar" aria-label="Sending progress" aria-valuenow={Math.round(done)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-brand" style={{ width: `${done}%` }} />
        </div>
      </Banner>
    );
  }
  if (c.status === "paused")
    return (
      <Banner
        icon={PauseIcon}
        tone="warning"
        actions={
          <>
            {canSchedule(c) && (
              <OutlineButton icon={CalendarCheckIcon} className="h-8" onClick={() => actions.schedule(c)}>
                Reschedule
              </OutlineButton>
            )}
            <PrimaryButton icon={PlayIcon} className="h-8" onClick={() => actions.resume(c)} disabled={actions.busy}>
              Resume
            </PrimaryButton>
          </>
        }
      >
        {c.pausedFrom === "sending"
          ? isFlow(c)
            ? "Paused — no new contacts enter until you resume. Results below cover the time it ran."
            : "Sending is paused. Remaining messages are on hold until you resume."
          : c.scheduledAt
            ? `Paused before sending. It was scheduled for ${formatDateTime(c.scheduledAt)}.`
            : "Paused before sending."}
      </Banner>
    );
  if (c.status === "archived")
    return (
      <Banner icon={ArchiveIcon} tone="neutral" actions={<OutlineButton icon={ArrowCounterClockwiseIcon} className="h-8" onClick={() => actions.restore([c.id], c.name)} disabled={actions.busy}>Restore</OutlineButton>}>
        This campaign is archived. It&apos;s hidden from the list and dashboard totals; its results are kept.
      </Banner>
    );
  return null;
}

// ── KPIs ─────────────────────────────────────────────────────────────

function Metric({ icon: IconCmp, label, value, note, change, tone }: { icon: Icon; label: string; value: string; note?: string; change?: ReactNode; tone: KpiTone }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-card p-4 shadow-card">
      <div className="flex items-center gap-2.5">
        <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-lg", KPI_TONES[tone].tile)} aria-hidden>
          <IconCmp size={19} weight="duotone" />
        </span>
        <span className="min-w-0 truncate text-[13px] leading-5 font-medium text-ink-body">{label}</span>
      </div>
      <span className="mt-2.5 block truncate text-[22px] leading-8 font-semibold tracking-[-0.01em] text-ink tabular-nums">{value}</span>
      {note && <span className="block truncate text-[12px] leading-4 text-ink-muted">{note}</span>}
      {change && <div className="mt-2">{change}</div>}
    </div>
  );
}

/** Difference from the account average for the same channel, in percentage points. */
function vsAvg(value: number, avg: number, invert = false, digits = 1) {
  const diff = Math.round((value - avg) * 10 ** digits) / 10 ** digits;
  return <Change value={diff} invert={invert} text={`${Math.abs(diff).toFixed(digits)} pts`} suffix="vs account avg." />;
}

function KpiRow({ c, a }: { c: Campaign; a: CampaignAnalytics }) {
  const b = a.benchmark;
  const sent = c.sent ?? 0;
  const delivered = c.delivered ?? 0;
  if (isSms(c)) {
    const failRate = pct(c.failed ?? 0, sent);
    return (
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        <Metric icon={PaperPlaneTiltIcon} tone="green" label="Messages Sent" value={formatNumber(sent)} note={`of ${formatNumber(c.recipients)} recipients`} />
        <Metric icon={CheckCircleIcon} tone="green" label="Delivered" value={formatNumber(delivered)} note="Accepted by carriers" />
        <Metric icon={ChatCircleDotsIcon} tone="violet" label="Delivery Rate" value={formatPercent(pct(delivered, sent))} change={vsAvg(pct(delivered, sent), b.deliveryRate)} />
        <Metric icon={CursorClickIcon} tone="blue" label="Link Clicks" value={formatNumber(c.clicks ?? 0)} note={`${formatPercent(c.clickRate ?? 0)} of delivered`} change={vsAvg(c.clickRate ?? 0, b.clickRate)} />
        <Metric icon={XCircleIcon} tone="neutral" label="Failed Messages" value={formatNumber(c.failed ?? 0)} note={`${formatPercent(failRate)} of sent`} />
      </div>
    );
  }
  const bounceRate = pct(c.bounces ?? 0, sent);
  const unsubRate = pct(c.unsubscribes ?? 0, delivered);
  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      <Metric icon={PaperPlaneTiltIcon} tone="orange" label="Emails Sent" value={formatNumber(sent)} note={isFlow(c) ? "Since it started" : `of ${formatNumber(c.recipients)} recipients`} />
      <Metric icon={CheckCircleIcon} tone="green" label="Delivered" value={formatNumber(delivered)} note={`${formatPercent(pct(delivered, sent))} delivery rate`} />
      <Metric icon={EnvelopeOpenIcon} tone="violet" label="Open Rate" value={formatPercent(c.openRate ?? 0)} note={`${formatNumber(c.opens ?? 0)} opens`} change={vsAvg(c.openRate ?? 0, b.openRate)} />
      <Metric icon={CursorClickIcon} tone="blue" label="Click-Through Rate" value={formatPercent(c.clickRate ?? 0)} note={`${formatNumber(c.clicks ?? 0)} clicks`} change={vsAvg(c.clickRate ?? 0, b.clickRate)} />
      <Metric icon={WarningIcon} tone="pink" label="Bounces" value={formatNumber(c.bounces ?? 0)} note={`${formatPercent(bounceRate)} of sent`} change={vsAvg(bounceRate, b.bounceRate, true)} />
      <Metric icon={UserMinusIcon} tone="neutral" label="Unsubscribes" value={formatNumber(c.unsubscribes ?? 0)} note={`${formatPercent(unsubRate, 2)} of delivered`} change={vsAvg(unsubRate, b.unsubscribeRate, true, 2)} />
    </div>
  );
}

// ── Charts ───────────────────────────────────────────────────────────

function EngagementCard({ c, a, className }: { c: Campaign; a: CampaignAnalytics; className?: string }) {
  const sms = isSms(c);
  const series = sms ? [{ key: "clicks", label: "Link clicks", color: CHART_HEX.blue }] : [
    { key: "opens", label: "Opens", color: CHART_HEX.orange },
    { key: "clicks", label: "Clicks", color: CHART_HEX.blue },
  ];
  const unit = a.engagementUnit === "hour" ? "hour" : "day";
  return (
    <Card label="Engagement over time" className={cn("flex flex-col", className)}>
      <CardHeader title="Engagement Over Time" subtitle={isFlow(c) ? "Last 14 days" : unit === "hour" ? "Hourly since sending started" : "Daily since sending"} />
      <div className="flex flex-1 flex-col px-3 pb-4 sm:px-5">
        <LineLegend items={series.map((s) => ({ label: s.label, color: s.color }))} className="mb-2 px-2 sm:px-8" />
        <div className="h-[240px] w-full" role="img" aria-label={`${series.map((s) => s.label).join(" and ")} per ${unit} for ${c.name}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={a.engagement} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={CHART_HEX.grid} vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} dy={6} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={formatCompact} width={48} allowDecimals={false} />
              <Tooltip cursor={{ stroke: "#C4B5FD", strokeDasharray: "3 3" }} content={({ active, payload }) => <ChartTip active={active} payload={payload} title={(payload?.[0]?.payload as { title?: string } | undefined)?.title} />} />
              {series.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={a.engagement.length <= 14 ? { r: 3, strokeWidth: 2, fill: "#fff" } : false} activeDot={{ r: 5, strokeWidth: 2, fill: "#fff" }} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}

function DeliveryCard({ c, className }: { c: Campaign; className?: string }) {
  const sms = isSms(c);
  const sent = c.sent ?? 0;
  const pending = isFlow(c) ? 0 : Math.max(0, c.recipients - sent);
  const rows = [
    { name: "Delivered", value: c.delivered ?? 0, color: CHART_HEX.green },
    { name: sms ? "Failed" : "Bounced", value: sms ? (c.failed ?? 0) : (c.bounces ?? 0), color: CHART_HEX.pink },
    ...(pending > 0 ? [{ name: c.status === "paused" ? "On hold" : "Pending", value: pending, color: "#C4B5FD" }] : []),
  ];
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <Card label="Delivery summary" className={cn("flex flex-col", className)}>
      <CardHeader title="Delivery Summary" subtitle={pending ? `${formatNumber(total)} recipients` : `${formatNumber(sent)} ${sms ? "messages" : "emails"} sent`} />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-5 pb-5">
        <Donut label="Delivery summary" data={rows} center={formatPercent(pct(c.delivered ?? 0, total), 1)} centerLabel="Delivered" size={164} thickness={22} />
        <ul className="w-full max-w-[260px] space-y-2.5">
          {rows.map((r) => (
            <li key={r.name} className="flex items-center gap-2.5 text-[13px] text-ink-body">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} aria-hidden />
              <span className="flex-1">{r.name}</span>
              <span className="text-ink tabular-nums">
                {formatNumber(r.value)} <span className="text-ink-muted">({formatPercent(pct(r.value, total))})</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function Bars({ title, rows, color }: { title: string; rows: { name: string; value: number; note?: string }[]; color: string }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2.5 text-[12.5px] leading-5 font-semibold text-ink">{title}</h3>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="flex items-baseline justify-between gap-2 text-[12.5px] leading-5">
              <span className="truncate text-ink-body">{r.name}</span>
              <span className="shrink-0 text-ink tabular-nums">
                {r.note && <span className="mr-1.5 text-ink-muted">{r.note}</span>}
                {formatPercent(r.value)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F2F0F7]" aria-hidden>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, r.value)}%`, backgroundColor: color }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BreakdownCard({ c, a, className }: { c: Campaign; a: CampaignAnalytics; className?: string }) {
  const sms = isSms(c);
  const delivered = c.delivered ?? 0;
  const funnel = [
    { name: "Delivered", value: pct(delivered, c.sent ?? 0), note: formatNumber(delivered) },
    ...(sms ? [] : [{ name: "Opened", value: pct(c.opens ?? 0, delivered), note: formatNumber(c.opens ?? 0) }]),
    { name: "Clicked", value: pct(c.clicks ?? 0, delivered), note: formatNumber(c.clicks ?? 0) },
    { name: "Converted", value: pct(c.conversions ?? 0, delivered), note: formatNumber(c.conversions ?? 0) },
  ];
  return (
    <Card label="Engagement breakdown" className={className}>
      <CardHeader title="Engagement Breakdown" subtitle={sms ? "Share of delivered messages · devices and carriers of recipients who clicked" : "Share of delivered emails · devices and email clients of recipients who opened"} />
      <div className="grid gap-6 px-5 pb-5 md:grid-cols-3">
        <Bars title={sms ? "Clicks & conversions" : "Opens & clicks"} rows={funnel} color={CHART_HEX.violet} />
        <Bars title="Devices" rows={a.devices} color={CHART_HEX.orange} />
        <Bars title={sms ? "Carriers" : "Email clients"} rows={a.clients} color={CHART_HEX.blue} />
      </div>
    </Card>
  );
}

function LinksCard({ c, a, className }: { c: Campaign; a: CampaignAnalytics; className?: string }) {
  const total = a.links.reduce((s, l) => s + l.clicks, 0);
  return (
    <Card label="Top clicked links" className={className}>
      <CardHeader title="Top Clicked Links" subtitle={`${formatNumber(total)} total clicks`} />
      {a.links.length === 0 || total === 0 ? (
        <EmptyState icon={LinkSimpleIcon} title="No link clicks yet" hint={isSms(c) ? "Clicks on the link in this message will show here." : "Clicks on links in this email will show here."} className="py-10" />
      ) : (
        <div className="relative overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[560px] border-collapse">
            <caption className="sr-only">Top clicked links in {c.name}</caption>
            <thead>
              <tr className="border-y border-line-soft bg-campaign-muted">
                <th scope="col" className={th}>
                  Link
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  Total clicks
                </th>
                <th scope="col" className={cn(th, "text-right")}>
                  Unique clicks
                </th>
                <th scope="col" className={cn(th, "w-[180px]")}>
                  % of total clicks
                </th>
              </tr>
            </thead>
            <tbody>
              {a.links.map((l) => {
                const share = pct(l.clicks, total);
                return (
                  <tr key={l.label} className="border-b border-line-soft last:border-0">
                    <td className={td}>
                      <span className="block font-medium text-ink">{l.label}</span>
                      <span className="block truncate font-mono text-[11.5px] leading-4 text-ink-muted">{l.url}</span>
                    </td>
                    <td className={cn(td, "text-right font-medium text-ink tabular-nums")}>{formatNumber(l.clicks)}</td>
                    <td className={cn(td, "text-right tabular-nums")}>{formatNumber(l.unique)}</td>
                    <td className={td}>
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F2F0F7]" aria-hidden>
                          <span className="block h-full rounded-full bg-campaign-action" style={{ width: `${share}%` }} />
                        </span>
                        <span className="w-12 text-right text-ink tabular-nums">{formatPercent(share)}</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────

const EVENT_ICON: Record<CampaignEvent["kind"], { icon: Icon; cls: string }> = {
  created: { icon: PlusCircleIcon, cls: "bg-campaign-tint text-campaign-action" },
  duplicated: { icon: CopyIcon, cls: "bg-campaign-tint text-campaign-action" },
  audience: { icon: UsersThreeIcon, cls: "bg-[var(--ch-journey-bg)] text-[var(--ch-journey-fg)]" },
  edited: { icon: PencilSimpleIcon, cls: "bg-[var(--neutral-bg)] text-[var(--neutral-fg)]" },
  scheduled: { icon: CalendarCheckIcon, cls: "bg-[var(--info-bg)] text-[var(--info)]" },
  paused: { icon: PauseIcon, cls: "bg-[var(--warning-bg)] text-[var(--warning)]" },
  resumed: { icon: PlayIcon, cls: "bg-campaign-tint text-campaign-action" },
  sending: { icon: PaperPlaneTiltIcon, cls: "bg-campaign-tint text-campaign-action" },
  sent: { icon: PaperPlaneTiltIcon, cls: "bg-[var(--success-bg)] text-[var(--success)]" },
  delivered: { icon: CheckCircleIcon, cls: "bg-[var(--success-bg)] text-[var(--success)]" },
  engagement: { icon: CursorClickIcon, cls: "bg-[var(--ch-email-bg)] text-[var(--ch-email-fg)]" },
  archived: { icon: ArchiveIcon, cls: "bg-[var(--neutral-bg)] text-[var(--neutral-fg)]" },
  restored: { icon: ArrowCounterClockwiseIcon, cls: "bg-[var(--neutral-bg)] text-[var(--neutral-fg)]" },
};

function TimelineCard({ c, className }: { c: Campaign; className?: string }) {
  const items = [...c.history].reverse();
  return (
    <Card label="Campaign activity" className={className}>
      <CardHeader title="Campaign Activity" subtitle="Newest first" />
      <ol className="px-5 pb-5">
        {items.map((e, i) => {
          const m = EVENT_ICON[e.kind];
          const IconCmp = m.icon;
          return (
            <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
              {i < items.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-px bg-line" aria-hidden />}
              <span className={cn("relative inline-flex size-8 shrink-0 items-center justify-center rounded-full", m.cls)} aria-hidden>
                <IconCmp size={15} />
              </span>
              <div className="min-w-0 pt-1">
                <p className="text-[13px] leading-5 text-ink">{e.text}</p>
                <p className="mt-0.5 text-[12px] leading-4 text-ink-muted">
                  {e.user ? `${e.user} · ` : ""}
                  <time dateTime={e.at}>{formatDateTime(e.at)}</time>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// ── No results yet ───────────────────────────────────────────────────

function NoResultsCard({ c, now, actions, className }: { c: Campaign; now: string; actions: Actions; className?: string }) {
  const scheduled = c.status === "scheduled" && c.scheduledAt;
  const locked = contentLocked(c) || c.status === "archived";
  return (
    <Card label="Results" className={className}>
      {scheduled ? (
        <EmptyState
          icon={ClockIcon}
          title={`Sends ${formatDateTime(c.scheduledAt!)}`}
          hint={`Results appear here once it goes out (${untilLabel(c.scheduledAt!, now)}). Until then you can still edit the content, reschedule or pause it.`}
          action={
            <>
              <OutlineButton icon={EyeIcon} onClick={() => actions.preview(c)}>
                Preview
              </OutlineButton>
              <OutlineButton icon={PencilSimpleIcon} onClick={() => actions.edit(c)}>
                Edit
              </OutlineButton>
              <PrimaryButton icon={CalendarCheckIcon} onClick={() => actions.schedule(c)}>
                Reschedule
              </PrimaryButton>
            </>
          }
        />
      ) : c.status === "draft" ? (
        <EmptyState
          icon={FileDashedIcon}
          title="This campaign is a draft"
          hint={`No delivery statistics yet — they appear after it's sent. Finish the ${isSms(c) ? "message" : "content"}, then schedule it.`}
          action={
            <>
              <OutlineButton icon={EyeIcon} onClick={() => actions.preview(c)}>
                Preview
              </OutlineButton>
              <OutlineButton icon={PencilSimpleIcon} onClick={() => actions.edit(c)}>
                Edit
              </OutlineButton>
              <PrimaryButton icon={CalendarCheckIcon} onClick={() => actions.schedule(c)}>
                Schedule
              </PrimaryButton>
            </>
          }
        />
      ) : (
        <EmptyState
          icon={ProhibitIcon}
          title="No results yet"
          hint={c.status === "paused" ? "This campaign was paused before it sent, so there are no delivery statistics." : "This campaign never sent, so there are no delivery statistics."}
          action={
            !locked && (
              <OutlineButton icon={EyeIcon} onClick={() => actions.preview(c)}>
                Preview
              </OutlineButton>
            )
          }
        />
      )}
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading campaign">
      <div className="mt-4 flex items-center gap-4">
        <Skeleton className="size-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="mt-6 h-36 rounded-xl" />
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-72 rounded-xl" />
    </div>
  );
}

export function CampaignDetailView({ id }: { id: string }) {
  const { data, isError, error, refetch } = useCampaign(id);
  const router = useRouter();
  const listHref = getCampaignsListHref();
  const actions = useCampaignActions({ onDeleted: () => router.push(listHref) });
  const c = data?.campaign;
  const a = data?.analytics;
  const crumbs = [{ label: "Campaigns", href: listHref }, { label: c?.name ?? "Campaign" }];

  const backLink = (
    <Link href={listHref} className={outlineButtonClass}>
      <ArrowLeftIcon size={15} aria-hidden /> Back to Campaigns
    </Link>
  );

  if (isError) {
    const missing = error?.message === "Campaign not found";
    return (
      <PageShell>
        <Breadcrumbs items={[crumbs[0], { label: missing ? "Not found" : "Error" }]} />
        <Card className="mt-4">
          {missing ? (
            <EmptyState icon={EnvelopeSimpleIcon} title="This campaign doesn't exist" hint="It may have been deleted, or created in an earlier session — demo data resets when the page reloads." action={backLink} />
          ) : (
            <ErrorState action={<OutlineButton onClick={() => refetch()}>Try again</OutlineButton>} />
          )}
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Breadcrumbs items={crumbs} />
      {!c || !data ? (
        <DetailSkeleton />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-4">
            <TypeIcon type={c.type} size={52} rounded="rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <h1 className="min-w-0 text-[22px] leading-8 font-semibold tracking-[-0.01em] break-words text-campaign-depth sm:text-[24px]">{c.name}</h1>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-ink-muted">
                <TypeLabel type={c.type} className="text-[13px]" />
                <span aria-hidden>·</span>
                <span>
                  Created {formatDate(c.createdAt)}
                  {c.history[0]?.user && ` by ${c.history[0].user}`}
                </span>
                <span aria-hidden className="hidden sm:inline">
                  ·
                </span>
                <span className="hidden sm:inline">Updated {formatDateTime(c.updatedAt)}</span>
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {backLink}
              <OutlineButton icon={CopyIcon} onClick={() => actions.duplicate(c)} disabled={actions.busy}>
                Duplicate
              </OutlineButton>
              {c.status !== "archived" && (
                <PrimaryButton icon={PencilSimpleIcon} onClick={() => actions.edit(c)}>
                  Edit Campaign
                </PrimaryButton>
              )}
              <RowMenu
                label="More actions"
                actions={actions.actionsFor(c, { onDetails: true }).filter((x) => x && x.label !== "Edit" && x.label !== "Duplicate")}
                trigger={
                  <OutlineButton aria-label="More actions" className="w-9 px-0">
                    <DotsThreeIcon size={18} weight="bold" aria-hidden />
                  </OutlineButton>
                }
              />
            </div>
          </div>

          <StatusBanner c={c} now={data.now} actions={actions} />

          <div className="mt-4">
            <SummaryCard c={c} />
          </div>

          {a ? (
            <>
              <div className="mt-4">
                <KpiRow c={c} a={a} />
              </div>
              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
                <EngagementCard c={c} a={a} className="xl:col-span-2" />
                <DeliveryCard c={c} />
                <BreakdownCard c={c} a={a} className="xl:col-span-2" />
                <TimelineCard c={c} className="xl:row-span-2" />
                <LinksCard c={c} a={a} className="xl:col-span-2" />
              </div>
            </>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <NoResultsCard c={c} now={data.now} actions={actions} className="xl:col-span-2" />
              <TimelineCard c={c} />
            </div>
          )}

          <p className="mt-4 text-[12px] leading-4 text-ink-muted">
            {TYPE_META[c.type].label} campaign · sample data held in this browser tab · {canPause(c) || canResume(c) ? "pause and resume change only this demo record" : "nothing is sent to recipients"}.
          </p>
        </>
      )}
      {actions.element()}
    </PageShell>
  );
}
