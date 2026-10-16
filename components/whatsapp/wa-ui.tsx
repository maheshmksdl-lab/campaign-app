"use client";

import { useRef } from "react";
import { ArrowSquareOutIcon, BracketsCurlyIcon, ChecksIcon, WhatsappLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { editorInputClass } from "@/components/campaigns/editor/fields";
import { applyMergeTags, MERGE_TAGS, mergeTagToken } from "@/lib/email-render";
import { tone, type Tone } from "@/lib/campaign-meta";
import type { WaStatus, WaTemplateCategory, WaTemplateStatus } from "@/lib/types/workspace";
import { cn } from "@/lib/utils";

/** WhatsApp limits used by the editors. */
export const WA_LIMITS = { body: 1024, header: 60, footer: 60, button: 25, buttons: 3 } as const;

export const WA_STATUS: Record<WaStatus, Tone> = {
  draft: tone("Draft", "var(--neutral-fg)", "var(--neutral-bg)"),
  scheduled: tone("Scheduled", "var(--info)", "var(--info-bg)"),
  sending: tone("Sending", "var(--campaign-primary)", "var(--campaign-tint)"),
  sent: tone("Sent", "var(--success)", "var(--success-bg)"),
  paused: tone("Paused", "var(--warning)", "var(--warning-bg)"),
};

export const WA_TEMPLATE_STATUS: Record<WaTemplateStatus, Tone> = {
  draft: tone("Draft", "var(--neutral-fg)", "var(--neutral-bg)"),
  pending: tone("In review", "var(--warning)", "var(--warning-bg)"),
  approved: tone("Approved", "var(--success)", "var(--success-bg)"),
  rejected: tone("Rejected", "#B42318", "var(--danger-bg)"),
};

export const WA_CATEGORY_LABEL: Record<WaTemplateCategory, string> = { marketing: "Marketing", utility: "Utility", authentication: "Authentication" };

/**
 * A WhatsApp-style chat on a phone, with merge tags filled with sample
 * values. The green accent stays inside the preview.
 */
export function WaPhonePreview({ header, body, footer, buttons, sender = "Evoq Solutions" }: { header?: string; body: string; footer?: string; buttons: string[]; sender?: string }) {
  const fill = (t?: string) => (t ? applyMergeTags(t) : "");
  return (
    <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[30px] border-[6px] border-campaign-depth bg-[#EFE7DD] shadow-pop" aria-label="Message preview" role="img">
      <div className="flex items-center gap-2 bg-[#1F7A5C] px-3 py-2.5 text-white">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-white/20" aria-hidden>
          <WhatsappLogoIcon size={16} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold">{sender}</span>
          <span className="block text-[10.5px] text-white/75">Business account</span>
        </span>
      </div>
      <div className="min-h-[260px] p-3">
        {body.trim() || header?.trim() ? (
          <div className="max-w-[92%]">
            <div className="rounded-xl rounded-tl-sm bg-white px-3 py-2 shadow-[0_1px_1px_rgb(0_0_0/0.08)]">
              {header && <p className="mb-1 text-[13px] font-semibold break-words text-ink">{fill(header)}</p>}
              <p className="text-[12.5px] leading-[18px] whitespace-pre-wrap break-words text-ink">{fill(body)}</p>
              {footer && <p className="mt-1.5 text-[11px] break-words text-ink-muted">{fill(footer)}</p>}
              <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-ink-muted">
                10:30 AM <ChecksIcon size={13} className="text-[#34B7F1]" aria-hidden />
              </p>
            </div>
            {buttons.filter(Boolean).length > 0 && (
              <div className="mt-1 grid gap-1">
                {buttons.filter(Boolean).map((b, i) => (
                  <span key={`${b}-${i}`} className="flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#1F7A5C] shadow-[0_1px_1px_rgb(0_0_0/0.08)]">
                    <ArrowSquareOutIcon size={12} aria-hidden /> {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="pt-16 text-center text-[12.5px] text-ink-muted">Your message appears here</p>
        )}
      </div>
    </div>
  );
}

/** Multi-line message field with a Personalize menu and a character counter. */
export function MessageEditor({ id, value, onChange, max, invalid, rows = 6, placeholder, disabled }: { id: string; value: string; onChange: (v: string) => void; max: number; invalid?: boolean; rows?: number; placeholder?: string; disabled?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (text: string) => {
    const el = ref.current;
    const s = el?.selectionStart ?? value.length;
    const e = el?.selectionEnd ?? value.length;
    onChange((value.slice(0, s) + text + value.slice(e)).slice(0, max));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + text.length, s + text.length);
    });
  };
  const n = [...value].length;
  return (
    <div className="w-full">
      <textarea
        ref={ref}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        maxLength={max}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={cn(editorInputClass, "h-auto resize-y py-2.5 leading-5")}
      />
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger disabled={disabled} className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-campaign-action hover:bg-campaign-surface focus-visible:outline-2 focus-visible:outline-brand-action disabled:opacity-50 data-[state=open]:bg-campaign-surface">
            <BracketsCurlyIcon size={14} aria-hidden /> Insert personalization
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            {MERGE_TAGS.map((t) => (
              <DropdownMenuItem key={t.key} onSelect={() => insert(mergeTagToken(t.key))}>
                <span className="flex-1">{t.label}</span>
                <code className="font-mono text-[11px] text-ink-muted">{mergeTagToken(t.key)}</code>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className={cn("text-[12px] tabular-nums", n > max * 0.9 ? "text-[var(--warning)]" : "text-ink-muted")}>
          {n}/{max}
        </span>
      </div>
    </div>
  );
}
