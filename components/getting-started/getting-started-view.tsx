"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Icon } from "@phosphor-icons/react";
import {
  AddressBookIcon,
  ArrowRightIcon,
  BrowserIcon,
  ChartBarIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  CircleIcon,
  EnvelopeSimpleIcon,
  FolderSimpleIcon,
  NotePencilIcon,
  PaperPlaneTiltIcon,
  ShieldCheckIcon,
  StackIcon,
  TreeStructureIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useCreateDialog } from "@/components/campaigns/campaign-dialogs";
import { Card, CardHeader, PageShell } from "@/components/shared/campaign-ui";
import { useCampaigns, useDashboard } from "@/hooks/use-campaigns";
import { useHydrated } from "@/hooks/use-hydrated";
import { useStoredState } from "@/hooks/use-stored-state";
import { getSetupProgress, type SetupStepKey } from "@/lib/api/setup";
import { addDays, formatNumber, formatRelative, pluralize } from "@/lib/format";
import { CURRENT_USER, DEFAULT_SENDER, DEMO_TODAY } from "@/lib/mock-data/campaigns";
import { campaignHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

const VERIFIED_KEY = "evoq-campaigns:sender-verified";

interface Step {
  key: SetupStepKey;
  title: string;
  text: string;
  action: string;
  href?: string;
}

const STEPS: Step[] = [
  { key: "sender", title: "Verify your sender address", text: `Confirm ${DEFAULT_SENDER.email} so inboxes trust your emails.`, action: "Verify sender" },
  { key: "contacts", title: "Add your contacts", text: "Import a CSV or add people one by one.", action: "Import contacts", href: "/contacts?import=1" },
  { key: "audience", title: "Organise your audience", text: "Group contacts into a list or a segment that updates itself.", action: "Create a segment", href: "/segments/new" },
  { key: "template", title: "Design an email template", text: "Start from the gallery, a layout or your own HTML.", action: "Create a template", href: "/templates" },
  { key: "campaign", title: "Create your first campaign", text: "Email, SMS or WhatsApp — pick an audience and write the message.", action: "Create campaign" },
  { key: "launch", title: "Schedule a campaign", text: "Review it, then pick a send time. Nothing is really sent in this demo.", action: "Open campaigns", href: "/campaigns?status=draft" },
  { key: "form", title: "Grow your list with a form", text: "Publish a signup form that adds new contacts to a list.", action: "Create a form", href: "/forms/new" },
];

function useSetup(verified: boolean) {
  const hydrated = useHydrated();
  const q = useQuery({ queryKey: ["campaigns", "setup", verified], queryFn: () => getSetupProgress(verified) });
  return hydrated ? q.data : undefined;
}

export function GettingStartedView() {
  const [verified, setVerified] = useStoredState(VERIFIED_KEY, false);
  const setup = useSetup(verified);
  const create = useCreateDialog();
  const { data: campaigns } = useCampaigns();
  const { data: dash } = useDashboard(7);
  const done = setup ? STEPS.filter((s) => setup.done[s.key]).length : 0;
  const share = (done / STEPS.length) * 100;
  const next = setup ? STEPS.find((s) => !setup.done[s.key]) : undefined;

  const since = addDays(DEMO_TODAY, -30);
  const counts = campaigns
    ? {
        drafts: campaigns.filter((c) => c.status === "draft").length,
        scheduled: campaigns.filter((c) => c.status === "scheduled").length,
        sending: campaigns.filter((c) => c.status === "sending").length,
        sent: campaigns.filter((c) => c.status === "sent" && c.sentAt && c.sentAt.slice(0, 10) >= since).length,
      }
    : undefined;

  const run = (s: Step) => {
    if (s.key === "sender") {
      setVerified(true);
      toast.success("Sender verified", { description: `${DEFAULT_SENDER.email} · simulated — no DNS records were checked.` });
    } else if (s.key === "campaign") create.open("email");
  };

  const quick: { label: string; text: string; icon: Icon; fg: string; bg: string; href?: string; onClick?: () => void }[] = [
    { label: "Create Email Campaign", text: "Newsletter, offer or update", icon: EnvelopeSimpleIcon, fg: "var(--ch-email-fg)", bg: "var(--ch-email-bg)", onClick: () => create.open("email") },
    { label: "Create SMS Campaign", text: "Short text with a link", icon: ChatCircleDotsIcon, fg: "var(--ch-sms-fg)", bg: "var(--ch-sms-bg)", onClick: () => create.open("sms") },
    { label: "Import Contacts", text: "Upload a CSV file", icon: AddressBookIcon, fg: "var(--ch-journey-fg)", bg: "var(--ch-journey-bg)", href: "/contacts?import=1" },
    { label: "Create Email Template", text: "Gallery, layout or HTML", icon: NotePencilIcon, fg: "var(--campaign-action)", bg: "var(--campaign-tint)", href: "/templates" },
  ];

  const links: { label: string; text: string; icon: Icon; href: string }[] = [
    { label: "Analytics", text: "Opens, clicks and growth", icon: ChartBarIcon, href: "/analytics" },
    { label: "Template Gallery", text: "Ready-made designs", icon: NotePencilIcon, href: "/templates/gallery" },
    { label: "Segments", text: "Self-updating audiences", icon: StackIcon, href: "/segments" },
    { label: "Workflows", text: "Automated sequences", icon: TreeStructureIcon, href: "/workflows" },
    { label: "Forms", text: "Signup and lead capture", icon: BrowserIcon, href: "/forms" },
    { label: "Files", text: "Images and documents", icon: FolderSimpleIcon, href: "/files" },
  ];

  return (
    <PageShell>
      {/* Welcome */}
      <section aria-labelledby="gs-title" className="relative overflow-hidden rounded-2xl border border-campaign-soft bg-gradient-soft px-5 py-6 sm:px-7">
        <div className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-campaign-soft/50 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="min-w-0 flex-1 basis-[320px]">
            <p className="text-[12px] font-semibold tracking-[0.08em] text-campaign-action uppercase">Getting started</p>
            <h1 id="gs-title" className="mt-1 text-[24px] leading-8 font-semibold text-campaign-depth">Welcome to EVOQ Campaigns, {CURRENT_USER.firstName} 👋</h1>
            <p className="mt-1 max-w-xl text-[14px] leading-[22px] text-ink-body">Follow these steps to reach your audience: set up your sender, bring in contacts, design an email and launch your first campaign.</p>
            {next && (
              <p className="mt-3 text-[13px] text-ink-body">
                Next up: <span className="font-semibold text-campaign-depth">{next.title}</span>
              </p>
            )}
          </div>
          <div className="w-full max-w-[280px] rounded-xl border border-white/70 bg-white/80 p-4 shadow-card backdrop-blur">
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] font-medium text-campaign-depth">Setup progress</p>
              <p className="text-[13px] text-ink-muted tabular-nums">{setup ? `${done} of ${STEPS.length}` : "…"}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-campaign-tint" role="progressbar" aria-label="Setup progress" aria-valuenow={Math.round(share)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gradient-brand transition-[width]" style={{ width: `${share}%` }} />
            </div>
            <p className="mt-2 text-[12px] text-ink-muted">{done === STEPS.length ? "All set — nice work!" : `${STEPS.length - done} steps left`}</p>
          </div>
        </div>
      </section>

      {/* Quick actions */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {quick.map((a) => {
          const body = (
            <>
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl" style={{ color: a.fg, backgroundColor: a.bg }} aria-hidden>
                <a.icon size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-campaign-depth">{a.label}</span>
                <span className="block text-[12.5px] text-ink-muted">{a.text}</span>
              </span>
              <ArrowRightIcon size={16} aria-hidden className="shrink-0 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-campaign-action" />
            </>
          );
          const cls = "group flex items-center gap-3 rounded-xl border border-line bg-white p-4 text-left shadow-card transition hover:border-campaign-soft hover:bg-campaign-surface focus-visible:outline-2 focus-visible:outline-brand-action";
          return a.href ? (
            <Link key={a.label} href={a.href} className={cls}>
              {body}
            </Link>
          ) : (
            <button key={a.label} type="button" onClick={a.onClick} className={cls}>
              {body}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Checklist */}
        <Card label="Quick-start checklist">
          <CardHeader title="Quick-start checklist" subtitle="Steps tick themselves off as you use the app" />
          {!setup ? (
            <div className="space-y-2 px-5 pb-5">
              {STEPS.map((s) => (
                <Skeleton key={s.key} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : (
            <ol className="px-3 pb-3">
              {STEPS.map((s, i) => {
                const ok = setup.done[s.key];
                const btn = cn("inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-[12.5px] font-medium transition-colors", ok ? "text-ink-muted hover:text-ink" : "border border-campaign-soft bg-white text-campaign-action hover:border-campaign-action hover:bg-campaign-surface");
                return (
                  <li key={s.key} className={cn("flex items-center gap-3 rounded-xl px-2 py-3", !ok && next?.key === s.key && "bg-campaign-surface")}>
                    {ok ? <CheckCircleIcon size={24} weight="fill" className="shrink-0 text-[var(--success)]" aria-label="Done" /> : <CircleIcon size={24} className="shrink-0 text-campaign-soft" aria-label="To do" />}
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[14px] font-medium", ok ? "text-ink-muted line-through decoration-ink-faint" : "text-campaign-depth")}>
                        {i + 1}. {s.title}
                      </p>
                      <p className="text-[12.5px] text-ink-muted">{s.text}</p>
                    </div>
                    {s.href ? (
                      <Link href={s.href} className={btn}>
                        {ok ? "Open" : s.action}
                      </Link>
                    ) : (
                      !ok && (
                        <button type="button" onClick={() => run(s)} className={btn}>
                          {s.key === "sender" && <ShieldCheckIcon size={14} aria-hidden className="mr-1.5" />}
                          {s.action}
                        </button>
                      )
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <div className="grid gap-4">
          {/* Activity summary */}
          <Card label="Campaign activity">
            <CardHeader title="Campaign activity" action={<Link href="/campaigns" className="text-[13px] font-medium text-campaign-action hover:underline">All campaigns</Link>} />
            <div className="grid grid-cols-2 gap-2 px-5">
              {[
                { label: "Drafts", value: counts?.drafts, href: "/campaigns?status=draft" },
                { label: "Scheduled", value: counts?.scheduled, href: "/campaigns?status=scheduled" },
                { label: "Sending now", value: counts?.sending, href: "/campaigns?status=sending" },
                { label: "Sent (30 days)", value: counts?.sent, href: "/campaigns?status=sent" },
              ].map((m) => (
                <Link key={m.label} href={m.href} className="rounded-xl border border-line-soft bg-campaign-surface/60 px-3 py-2.5 transition-colors hover:border-campaign-soft">
                  <span className="block text-[12px] text-ink-muted">{m.label}</span>
                  <span className="block text-[20px] leading-7 font-semibold text-campaign-depth tabular-nums">{m.value ?? "—"}</span>
                </Link>
              ))}
            </div>
            <p className="mt-4 px-5 text-[12px] font-medium text-ink-muted">Recent activity</p>
            <ul className="px-3 pt-1 pb-3">
              {!dash
                ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="mx-2 my-2 h-9" />)
                : dash.activity.slice(0, 5).map((a) => (
                    <li key={a.id}>
                      {a.campaignId ? (
                        <Link href={campaignHref(a.campaignId)} className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-campaign-surface">
                          <ActivityLine title={a.title} detail={a.detail} when={formatRelative(a.at, dash.now)} />
                        </Link>
                      ) : (
                        <div className="flex items-start gap-2.5 px-2 py-2">
                          <ActivityLine title={a.title} detail={a.detail} when={formatRelative(a.at, dash.now)} />
                        </div>
                      )}
                    </li>
                  ))}
            </ul>
          </Card>

          {setup && (
            <Card label="Your workspace">
              <CardHeader title="Your workspace" />
              <dl className="grid grid-cols-3 gap-3 px-5 pb-5 text-center">
                {[
                  { label: "Contacts", value: formatNumber(setup.counts.contacts), icon: UsersThreeIcon },
                  { label: "Lists", value: setup.counts.lists, icon: AddressBookIcon },
                  { label: "Segments", value: setup.counts.segments, icon: StackIcon },
                  { label: "My templates", value: setup.counts.templates, icon: NotePencilIcon },
                  { label: "Forms", value: setup.counts.forms, icon: BrowserIcon },
                  { label: "Workflows", value: setup.counts.workflows, icon: TreeStructureIcon },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl bg-campaign-surface/70 px-2 py-3">
                    <m.icon size={18} aria-hidden className="mx-auto text-campaign-action" />
                    <dd className="mt-1 text-[16px] font-semibold text-campaign-depth tabular-nums">{m.value}</dd>
                    <dt className="text-[11.5px] text-ink-muted">{m.label}</dt>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>
      </div>

      {/* Helpful links */}
      <section aria-labelledby="gs-links" className="mt-4 rounded-xl bg-campaign-muted px-5 py-5">
        <h2 id="gs-links" className="text-[14px] font-semibold text-ink">
          Explore EVOQ Campaigns
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {links.map((l) => (
            <li key={l.label}>
              <Link href={l.href} className="flex items-center gap-2.5 rounded-lg border border-transparent bg-white px-3 py-2.5 transition-colors hover:border-campaign-soft">
                <l.icon size={18} aria-hidden className="shrink-0 text-campaign-action" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-ink">{l.label}</span>
                  <span className="block truncate text-[12px] text-ink-muted">{l.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="mt-4 flex items-center gap-1.5 text-[12px] text-ink-muted">
        <PaperPlaneTiltIcon size={13} aria-hidden /> Frontend demo — {pluralize(STEPS.length, "step")} are tracked from what you do in this browser. No email, SMS or WhatsApp message is ever sent.
      </p>
    </PageShell>
  );
}

function ActivityLine({ title, detail, when }: { title: string; detail: string; when: string }) {
  return (
    <>
      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-campaign-action" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{title}</span>
        <span className="block truncate text-[12px] text-ink-muted">{detail}</span>
      </span>
      <span className="shrink-0 text-[11.5px] text-ink-muted">{when}</span>
    </>
  );
}
