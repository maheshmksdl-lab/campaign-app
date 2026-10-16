"use client";

import { useMemo, useState } from "react";

import { CaretDownIcon, CheckIcon, ListBulletsIcon, MagnifyingGlassIcon, StackIcon, UsersThreeIcon, XIcon } from "@phosphor-icons/react/dist/ssr";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAudienceEstimate } from "@/hooks/use-audience";
import { useAudiences } from "@/hooks/use-campaigns";
import { MAX_AUDIENCE_SOURCES } from "@/lib/audience";
import { isSms } from "@/lib/campaign-meta";
import { formatNumber, pluralize } from "@/lib/format";
import type { Audience, Campaign } from "@/lib/types/campaigns";
import { cn } from "@/lib/utils";
import { EditorCard, EditorRow } from "./fields";
import { TOPICS } from "./draft";

export function RecipientsCard({
  campaign,
  topic,
  audienceIds,
  onTopic,
  onAudience,
  error,
  disabled,
}: {
  campaign: Pick<Campaign, "type">;
  topic: string;
  audienceIds: string[];
  onTopic: (t: string) => void;
  onAudience: (ids: string[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const { data: audiences } = useAudiences();
  const byId = useMemo(() => new Map((audiences ?? []).map((a) => [a.id, a])), [audiences]);
  const selected = audienceIds.map((id) => byId.get(id)).filter((a): a is Audience => !!a);
  const sel = { listIds: selected.filter((a) => a.kind !== "segment").map((a) => a.id), segmentIds: selected.filter((a) => a.kind === "segment").map((a) => a.id) };
  const { data: estimate, isFetching } = useAudienceEstimate(sel, selected.length > 0);

  return (
    <EditorCard id="recipients" icon={UsersThreeIcon} title="Recipients">
      <div className="pb-4">
        <EditorRow label="Topics" required>
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={disabled}
              title="Recipients can unsubscribe from this topic only"
              className="inline-flex h-11 w-full max-w-[256px] items-center justify-between gap-2 rounded-lg border border-[#E4E0EC] bg-white px-3.5 text-[13.5px] text-ink transition-colors hover:border-[#D3CCE3] focus-visible:border-campaign-action focus-visible:ring-3 focus-visible:ring-brand-10 focus-visible:outline-none data-[state=open]:border-campaign-action data-[state=open]:ring-3 data-[state=open]:ring-brand-10"
              aria-label={`Topic: ${topic}`}
            >
              {topic}
              <CaretDownIcon size={15} aria-hidden className="text-ink-body" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {TOPICS.map((t) => (
                <DropdownMenuItem key={t} onSelect={() => onTopic(t)}>
                  <span className="flex-1">{t}</span>
                  {t === topic && <CheckIcon size={14} className="text-brand" aria-hidden />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </EditorRow>
        <EditorRow label="To" required error={error} htmlFor="audience-picker">
          <AudiencePicker audiences={audiences ?? []} selected={selected} onChange={onAudience} invalid={!!error} disabled={disabled} sms={isSms(campaign)} />
        </EditorRow>
        {selected.length > 0 && (
          <p className="mx-5 flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-0.5 text-[12px] leading-4 text-ink-muted sm:pl-[120px]" aria-live="polite">
            {estimate ? (
              <>
                <span className={cn("font-medium text-ink tabular-nums", isFetching && "opacity-60")}>≈ {formatNumber(estimate.eligible)} recipients</span>
                <span aria-hidden>·</span>
                <span>
                  {pluralize(estimate.total, "unique contact")} across {pluralize(selected.length, "audience")}
                </span>
                {estimate.unreachable > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{formatNumber(estimate.unreachable)} unsubscribed, invalid or suppressed left out</span>
                  </>
                )}
              </>
            ) : (
              "Estimating recipients…"
            )}
          </p>
        )}
      </div>
    </EditorCard>
  );
}

function AudiencePicker({ audiences, selected, onChange, invalid, disabled, sms }: { audiences: Audience[]; selected: Audience[]; onChange: (ids: string[]) => void; invalid?: boolean; disabled?: boolean; sms?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ids = selected.map((a) => a.id);
  const full = ids.length >= MAX_AUDIENCE_SOURCES;
  const term = q.trim().toLowerCase();
  const match = (a: Audience) => !term || a.name.toLowerCase().includes(term);
  const groups = [
    { label: "Lists", icon: ListBulletsIcon, items: audiences.filter((a) => a.kind !== "segment" && match(a)) },
    { label: "Segments", icon: StackIcon, items: audiences.filter((a) => a.kind === "segment" && match(a)) },
  ];
  const toggle = (id: string) => onChange(ids.includes(id) ? ids.filter((x) => x !== id) : full ? ids : [...ids, id]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
      <div
        className={cn(
          "relative flex min-h-11 w-full min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-[#E4E0EC] bg-white py-1.5 pr-10 pl-3.5 transition-colors hover:border-[#D3CCE3]",
          open && "border-campaign-action ring-3 ring-brand-10",
          invalid && "border-[#F0A8A4]",
        )}
      >
        {selected.map((a) => (
          <span key={a.id} className="relative z-10 inline-flex max-w-full items-center gap-1 rounded-md border border-brand-soft bg-brand-surface py-0.5 pr-1 pl-2 text-[12.5px] leading-5 text-campaign-depth">
            {a.kind === "segment" ? <StackIcon size={12} aria-hidden className="shrink-0 text-campaign-action" /> : <ListBulletsIcon size={12} aria-hidden className="shrink-0 text-campaign-action" />}
            <span className="truncate">{a.name}</span>
            <span className="text-ink-muted tabular-nums">· {formatNumber(a.size)}</span>
            {!disabled && (
              <button type="button" onClick={() => toggle(a.id)} aria-label={`Remove ${a.name}`} className="ml-0.5 inline-flex size-4 items-center justify-center rounded text-ink-muted hover:bg-white hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-action">
                <XIcon size={10} weight="bold" aria-hidden />
              </button>
            )}
          </span>
        ))}
        <PopoverTrigger asChild>
          <button
            id="audience-picker"
            type="button"
            disabled={disabled}
            aria-describedby={invalid ? "audience-picker-error" : undefined}
            className="min-w-[140px] flex-1 rounded py-1 text-left text-[13.5px] text-[#8F8A9E] outline-none after:absolute after:inset-0 after:content-[''] disabled:cursor-not-allowed"
          >
            {selected.length ? (full ? "Limit of 10 reached" : "Add another list or segment") : `Search and select up to ${MAX_AUDIENCE_SOURCES} lists or segments`}
          </button>
        </PopoverTrigger>
        <CaretDownIcon size={15} aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-body" />
      </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-2rem))] p-0">
        <div className="border-b border-line-soft p-2">
          <div className="relative">
            <MagnifyingGlassIcon size={14} aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search lists and segments"
              aria-label="Search lists and segments"
              className="h-8 w-full rounded-lg border border-line bg-white pr-2 pl-8 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-brand-hover focus:ring-3 focus:ring-brand-10"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1 scrollbar-thin" role="listbox" aria-multiselectable="true" aria-label="Lists and segments">
          {groups.map((g) =>
            g.items.length ? (
              <div key={g.label} role="group" aria-label={g.label}>
                <p className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-ink-muted uppercase">
                  <g.icon size={12} aria-hidden /> {g.label}
                </p>
                {g.items.map((a) => {
                  const on = ids.includes(a.id);
                  const blocked = !on && full;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="option"
                      aria-selected={on}
                      disabled={blocked}
                      onClick={() => toggle(a.id)}
                      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-brand-surface disabled:cursor-not-allowed disabled:opacity-45", on && "bg-brand-surface")}
                    >
                      <span className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border", on ? "border-brand bg-brand text-white" : "border-[#CFCAD9] bg-white")} aria-hidden>
                        {on && <CheckIcon size={11} weight="bold" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink">{a.name}</span>
                      <span className="shrink-0 text-[12px] text-ink-muted tabular-nums">{formatNumber(a.size)}</span>
                    </button>
                  );
                })}
              </div>
            ) : null,
          )}
          {groups.every((g) => !g.items.length) && <p className="px-3 py-6 text-center text-[13px] text-ink-muted">No lists or segments match “{q}”.</p>}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line-soft bg-campaign-muted px-3 py-2 text-[12px] text-ink-muted">
          <span>
            {ids.length}/{MAX_AUDIENCE_SOURCES} selected{sms ? " · SMS goes to contacts with a mobile number" : " · counts are reachable contacts"}
          </span>
          <button type="button" onClick={() => setOpen(false)} className="rounded px-1.5 font-medium text-brand hover:text-brand-press focus-visible:outline-2 focus-visible:outline-brand-action">
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
