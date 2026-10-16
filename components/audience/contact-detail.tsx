"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircleIcon, CursorClickIcon, EnvelopeOpenIcon, PencilSimpleIcon, TrashIcon, UserCircleIcon, XCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge, Breadcrumbs, Card, CardHeader, ConfirmDialog, OutlineButton, PageHeading, PageShell, td, th } from "@/components/shared/campaign-ui";
import { EmptyState } from "@/components/shared/state-panels";
import { useContact, useDeleteContacts } from "@/hooks/use-audience";
import { contactName, ENGAGEMENT_LABEL, SOURCE_LABEL, SUBSCRIPTION_LABEL, SUPPRESSION_LABEL, unreachableReason } from "@/lib/audience";
import { CONTACTS_ROUTE } from "@/lib/content-session";
import { formatDate, formatDateTime, initials } from "@/lib/format";
import { campaignHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { ContactFormPanel } from "./contact-form";
import { listHref } from "./lists";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-line-soft py-2.5 text-[13px] leading-5 last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children ?? <span className="text-ink-faint">—</span>}</dd>
    </div>
  );
}

export function ContactDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data, isError } = useContact(id);
  const del = useDeleteContacts();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (isError)
    return (
      <PageShell>
        <Breadcrumbs items={[{ label: "Contacts", href: CONTACTS_ROUTE }, { label: "Not found" }]} />
        <Card className="mt-4">
          <EmptyState icon={UserCircleIcon} title="This contact doesn't exist" hint="It may have been deleted, or the demo data was reset." action={<Link href={CONTACTS_ROUTE} className="text-[13px] font-medium text-brand">Back to Contacts</Link>} />
        </Card>
      </PageShell>
    );

  const c = data?.contact;
  const why = c ? unreachableReason(c) : null;
  const status = !c ? null : !why ? { label: "Reachable", fg: "var(--success)", bg: "var(--success-bg)" } : { label: why === "suppressed" && c.suppression ? SUPPRESSION_LABEL[c.suppression.reason] : why === "invalid" ? "Invalid email" : why === "excluded" ? "Excluded" : "Unsubscribed", fg: why === "excluded" ? "var(--neutral-fg)" : "#B42318", bg: why === "excluded" ? "var(--neutral-bg)" : "var(--danger-bg)" };

  return (
    <PageShell>
      <PageHeading
        crumbs={[{ label: "Contacts", href: CONTACTS_ROUTE }, { label: c ? contactName(c) : "Contact" }]}
        title={
          c ? (
            <span className="flex items-center gap-3">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-[14px] font-semibold text-white" aria-hidden>
                {initials(contactName(c))}
              </span>
              <span className="min-w-0">
                <span className="block truncate">{contactName(c)}</span>
              </span>
              {status && <Badge fg={status.fg} bg={status.bg}>{status.label}</Badge>}
            </span>
          ) : (
            "…"
          )
        }
        description={c?.email}
        actions={
          c && (
            <>
              <OutlineButton icon={TrashIcon} onClick={() => setDeleting(true)}>
                Delete
              </OutlineButton>
              <OutlineButton icon={PencilSimpleIcon} onClick={() => setEditing(true)} className="border-campaign-soft text-campaign-action">
                Edit contact
              </OutlineButton>
            </>
          )
        }
      />

      {!data || !c ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      ) : (
        <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="grid gap-4">
            <Card label="Profile">
              <CardHeader title="Profile" />
              <dl className="px-5 pb-4">
                <Field label="Email">{c.email}</Field>
                <Field label="First name">{c.firstName || null}</Field>
                <Field label="Last name">{c.lastName || null}</Field>
                <Field label="Mobile">{c.mobile}</Field>
                <Field label="Phone">{c.phone}</Field>
                <Field label="Subscription">{SUBSCRIPTION_LABEL[c.subscription]}</Field>
                <Field label="Email status">{c.emailStatus === "valid" ? "Valid" : "Invalid — can't receive mail"}</Field>
                <Field label="Added">{formatDateTime(c.addedAt)}</Field>
              </dl>
            </Card>
            <Card label="Custom fields">
              <CardHeader title="Custom fields" subtitle="Extra details used for segments and personalization" />
              <dl className="px-5 pb-4">
                <Field label="Company">{c.company}</Field>
                <Field label="Country">{c.country}</Field>
                <Field label="Source">{SOURCE_LABEL[c.source]}</Field>
                <Field label="Engagement">{ENGAGEMENT_LABEL[c.engagement]}</Field>
                <Field label="Contact score">{c.score}</Field>
                <Field label="Last engaged">{c.lastEngagedAt ? formatDate(c.lastEngagedAt) : null}</Field>
              </dl>
            </Card>
            <Card label="Tags, lists and segments">
              <CardHeader title="Tags, lists & segments" />
              <div className="grid gap-3 px-5 pb-5 text-[13px]">
                <Chips label="Tags" items={c.tags.map((t) => ({ key: t, label: t }))} />
                <Chips label="Lists" items={data.lists.map((l) => ({ key: l.id, label: l.name, href: listHref(l.id) }))} />
                <Chips label="Segments" items={data.segments.map((s) => ({ key: s.id, label: s.name, href: `/segments/${s.id}` }))} />
              </div>
            </Card>
          </div>
          <div className="grid gap-4">
            <Card label="Campaign engagement">
              <CardHeader title="Campaign engagement" subtitle="Recent email campaigns sent to this contact" />
              {data.engagement.length === 0 ? (
                <EmptyState icon={EnvelopeOpenIcon} title="No campaigns yet" hint="Engagement appears once an email campaign is sent to this contact." className="py-8" />
              ) : (
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full min-w-[480px] border-collapse">
                    <thead>
                      <tr className="border-y border-line-soft bg-campaign-muted">
                        <th scope="col" className={th}>Campaign</th>
                        <th scope="col" className={th}>Sent</th>
                        <th scope="col" className={cn(th, "text-center")}>Opened</th>
                        <th scope="col" className={cn(th, "text-center")}>Clicked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.engagement.map((e) => (
                        <tr key={e.campaignId} className="border-b border-line-soft last:border-0">
                          <td className={td}>
                            <Link href={campaignHref(e.campaignId)} className="font-medium text-ink hover:text-brand">
                              {e.campaignName}
                            </Link>
                          </td>
                          <td className={cn(td, "whitespace-nowrap")}>{formatDate(e.sentAt)}</td>
                          <td className={cn(td, "text-center")}>{e.opened ? <CheckCircleIcon size={17} weight="fill" className="mx-auto text-[var(--success)]" aria-label="Opened" /> : <XCircleIcon size={17} className="mx-auto text-ink-faint" aria-label="Not opened" />}</td>
                          <td className={cn(td, "text-center")}>{e.clicked ? <CursorClickIcon size={17} weight="fill" className="mx-auto text-campaign-action" aria-label="Clicked" /> : <XCircleIcon size={17} className="mx-auto text-ink-faint" aria-label="Not clicked" />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
            <Card label="Activity">
              <CardHeader title="Activity" subtitle="Newest first" />
              <ol className="px-5 pb-5">
                {data.activity.map((a, i) => (
                  <li key={`${a.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < data.activity.length - 1 && <span className="absolute top-3 bottom-0 left-[5px] w-px bg-line" aria-hidden />}
                    <span className="relative mt-1.5 size-[11px] shrink-0 rounded-full border-2 border-campaign-action bg-white" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13px] leading-5 text-ink">{a.text}</p>
                      <p className="text-[12px] leading-4 text-ink-muted">{formatDateTime(a.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      )}

      <ContactFormPanel contact={c} open={editing} onOpenChange={setEditing} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this contact?"
        description="They're removed from every list and segment, and their engagement history is deleted. This can't be undone — exclude them instead to keep their history."
        confirmLabel="Delete contact"
        pending={del.isPending}
        onConfirm={() =>
          del.mutate([id], {
            onSuccess: () => {
              toast.success("Contact deleted", { description: c?.email });
              router.push(CONTACTS_ROUTE);
            },
          })
        }
      />
    </PageShell>
  );
}

function Chips({ label, items }: { label: string; items: { key: string; label: string; href?: string }[] }) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] text-ink-muted">{label}</p>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((i) =>
            i.href ? (
              <Link key={i.key} href={i.href} className="rounded-md border border-campaign-soft bg-campaign-surface px-2 py-0.5 text-[12.5px] text-campaign-depth hover:border-campaign-action">
                {i.label}
              </Link>
            ) : (
              <span key={i.key} className="rounded-md bg-campaign-tint px-2 py-0.5 text-[12.5px] text-campaign-primary">
                {i.label}
              </span>
            ),
          )}
        </div>
      ) : (
        <p className="text-ink-faint">None</p>
      )}
    </div>
  );
}
