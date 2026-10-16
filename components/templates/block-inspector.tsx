"use client";

import type { ReactNode } from "react";
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, TextAlignCenterIcon, TextAlignLeftIcon, TextAlignRightIcon, TrashIcon } from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { fieldClass } from "@/components/shared/campaign-ui";
import { Switch } from "@/components/shared/email-ui";
import { BLOCK_LABEL, FONT_OPTIONS } from "@/lib/email-blocks";
import type { Align, ColumnItem, EmailBlock, EmailStyle, SocialNetwork } from "@/lib/types/templates";
import { cn } from "@/lib/utils";

// ── Tree helpers (blocks can sit inside columns) ─────────────────────

export type AnyBlock = EmailBlock | ColumnItem;

export function findBlock(blocks: EmailBlock[], id: string): AnyBlock | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.type === "columns") for (const col of b.columns) for (const x of col) if (x.id === id) return x;
  }
  return null;
}

export function updateBlock(blocks: EmailBlock[], id: string, patch: Partial<AnyBlock>): EmailBlock[] {
  return blocks.map((b) => {
    if (b.id === id) return { ...b, ...patch } as EmailBlock;
    if (b.type === "columns") return { ...b, columns: b.columns.map((col) => col.map((x) => (x.id === id ? ({ ...x, ...patch } as ColumnItem) : x))) };
    return b;
  });
}

export function removeBlock(blocks: EmailBlock[], id: string): EmailBlock[] {
  return blocks.filter((b) => b.id !== id).map((b) => (b.type === "columns" ? { ...b, columns: b.columns.map((col) => col.filter((x) => x.id !== id)) } : b));
}

export const isTopLevel = (blocks: EmailBlock[], id: string) => blocks.some((b) => b.id === id);

// ── Controls ─────────────────────────────────────────────────────────

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1", className)}>
      <span className="text-[12px] leading-4 font-medium text-ink-body">{label}</span>
      {children}
    </label>
  );
}

const small = cn(fieldClass, "h-8 text-[12.5px]");

function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <Field label={label}>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={small} />
    </Field>
  );
}

function Area({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <Field label={label}>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className={cn(fieldClass, "h-auto resize-y py-2 text-[12.5px] leading-5")} />
    </Field>
  );
}

function Num({ label, value, onChange, min, max, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; suffix?: string }) {
  return (
    <Field label={suffix ? `${label} (${suffix})` : label}>
      <span className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 accent-[var(--campaign-action)]" aria-label={label} />
        <input type="number" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min)))} className={cn(small, "w-16 px-2")} aria-label={`${label} value`} />
      </span>
    </Field>
  );
}

function Color({ label, value, onChange, fallback }: { label: string; value: string | undefined; onChange: (v: string) => void; fallback: string }) {
  return (
    <Field label={label}>
      <span className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value ?? "") ? value : fallback} onChange={(e) => onChange(e.target.value)} className="h-8 w-9 shrink-0 cursor-pointer rounded-md border border-line bg-white p-0.5" aria-label={`${label} picker`} />
        <input value={value ?? ""} placeholder={fallback} onChange={(e) => onChange(e.target.value)} className={cn(small, "font-mono")} />
      </span>
    </Field>
  );
}

function AlignPick({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  const opts: { a: Align; icon: typeof TextAlignLeftIcon }[] = [
    { a: "left", icon: TextAlignLeftIcon },
    { a: "center", icon: TextAlignCenterIcon },
    { a: "right", icon: TextAlignRightIcon },
  ];
  return (
    <div className="grid gap-1">
      <span className="text-[12px] leading-4 font-medium text-ink-body">Alignment</span>
      <div className="flex w-fit rounded-lg border border-line p-0.5" role="group" aria-label="Alignment">
        {opts.map(({ a, icon: I }) => (
          <button key={a} type="button" aria-pressed={value === a} aria-label={`Align ${a}`} onClick={() => onChange(a)} className={cn("inline-flex size-7 items-center justify-center rounded-md transition-colors", value === a ? "bg-brand-surface text-brand" : "text-ink-muted hover:text-ink")}>
            <I size={15} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}

const MAX_IMAGE_BYTES = 400 * 1024;

function ImageSource({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Text label="Image URL" value={value.startsWith("data:") ? "" : value} onChange={onChange} placeholder={value.startsWith("data:") ? "Using an image from this computer" : "https://…"} />
      <label className="w-fit cursor-pointer rounded text-[12.5px] font-medium text-brand hover:text-brand-press">
        Upload from computer
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > MAX_IMAGE_BYTES) return void toast.error("Image too large", { description: "Use images under 400 KB, or link to a hosted image." });
            const r = new FileReader();
            r.onload = () => typeof r.result === "string" && onChange(r.result);
            r.readAsDataURL(f);
          }}
        />
      </label>
    </div>
  );
}

const NETWORKS: SocialNetwork[] = ["facebook", "instagram", "linkedin", "x", "youtube"];

/** Properties of the selected block. */
export function BlockInspector({ block, onChange, onMove, onDuplicate, onDelete, canMove }: { block: AnyBlock; onChange: (patch: Partial<AnyBlock>) => void; onMove: (dir: -1 | 1) => void; onDuplicate: () => void; onDelete: () => void; canMove: boolean }) {
  const b = block;
  const set = <T extends AnyBlock>(patch: Partial<T>) => onChange(patch as Partial<AnyBlock>);
  return (
    <div className="grid gap-3.5">
      <div className="flex items-center gap-1">
        <p className="flex-1 text-[13px] font-semibold text-ink">{BLOCK_LABEL[b.type]}</p>
        {canMove && (
          <>
            <ToolBtn label="Move up" onClick={() => onMove(-1)}>
              <ArrowUpIcon size={14} />
            </ToolBtn>
            <ToolBtn label="Move down" onClick={() => onMove(1)}>
              <ArrowDownIcon size={14} />
            </ToolBtn>
            <ToolBtn label="Duplicate" onClick={onDuplicate}>
              <CopyIcon size={14} />
            </ToolBtn>
          </>
        )}
        <ToolBtn label="Delete block" onClick={onDelete} danger>
          <TrashIcon size={14} />
        </ToolBtn>
      </div>

      {b.type === "heading" && (
        <>
          <Area label="Text" value={b.text} onChange={(text) => set({ text })} rows={2} />
          <Num label="Size" suffix="px" value={b.size} min={12} max={56} onChange={(size) => set({ size })} />
          <Color label="Text colour" value={b.color} fallback="#272238" onChange={(color) => set({ color })} />
          <AlignPick value={b.align} onChange={(align) => set({ align })} />
        </>
      )}
      {b.type === "text" && (
        <>
          <Area label="Text" value={b.text} onChange={(text) => set({ text })} rows={6} />
          <p className="-mt-2 text-[11.5px] text-ink-muted">Blank line = new paragraph. Use {"{{first_name}}"} to personalise.</p>
          <Num label="Size" suffix="px" value={b.size} min={11} max={32} onChange={(size) => set({ size })} />
          <Color label="Text colour" value={b.color} fallback="#272238" onChange={(color) => set({ color })} />
          <AlignPick value={b.align} onChange={(align) => set({ align })} />
        </>
      )}
      {b.type === "image" && (
        <>
          <ImageSource value={b.src} onChange={(src) => set({ src })} />
          <Text label="Alt text" value={b.alt} onChange={(alt) => set({ alt })} placeholder="Describe the image" />
          <Text label="Link (optional)" value={b.href ?? ""} onChange={(href) => set({ href })} placeholder="https://…" />
          <Num label="Width" suffix="%" value={b.width} min={10} max={100} onChange={(width) => set({ width })} />
          <AlignPick value={b.align} onChange={(align) => set({ align })} />
        </>
      )}
      {b.type === "button" && (
        <>
          <Text label="Label" value={b.label} onChange={(label) => set({ label })} />
          <Text label="Link" value={b.href} onChange={(href) => set({ href })} placeholder="https://…" />
          <Color label="Button colour" value={b.color} fallback="#7C3AED" onChange={(color) => set({ color })} />
          <Color label="Text colour" value={b.textColor} fallback="#FFFFFF" onChange={(textColor) => set({ textColor })} />
          <AlignPick value={b.align} onChange={(align) => set({ align })} />
          <span className="flex items-center justify-between text-[12px] font-medium text-ink-body">
            Full width <Switch checked={b.fullWidth} onChange={(fullWidth) => set({ fullWidth })} label="Full width button" showState={false} />
          </span>
        </>
      )}
      {b.type === "divider" && (
        <>
          <Color label="Line colour" value={b.color} fallback="#EAE6F1" onChange={(color) => set({ color })} />
          <Num label="Thickness" suffix="px" value={b.thickness} min={1} max={8} onChange={(thickness) => set({ thickness })} />
        </>
      )}
      {b.type === "spacer" && <Num label="Height" suffix="px" value={b.height} min={4} max={160} onChange={(height) => set({ height })} />}
      {b.type === "columns" && (
        <>
          <p className="rounded-lg bg-campaign-muted px-3 py-2 text-[12px] leading-4 text-ink-body">Click a heading, text, image or button inside a column to edit it.</p>
          <Num label="Gap" suffix="px" value={b.gap} min={0} max={48} onChange={(gap) => set({ gap })} />
        </>
      )}
      {b.type === "social" && (
        <>
          {NETWORKS.map((n) => {
            const link = b.links.find((l) => l.network === n);
            return (
              <Text
                key={n}
                label={n === "x" ? "X (Twitter)" : n[0].toUpperCase() + n.slice(1)}
                value={link?.url ?? ""}
                placeholder="Leave empty to hide"
                onChange={(url) => set({ links: url ? (link ? b.links.map((l) => (l.network === n ? { ...l, url } : l)) : [...b.links, { network: n, url }]) : b.links.filter((l) => l.network !== n) })}
              />
            );
          })}
          <AlignPick value={b.align} onChange={(align) => set({ align })} />
        </>
      )}
      {b.type === "footer" && (
        <>
          <Area label="Text" value={b.text} onChange={(text) => set({ text })} rows={3} />
          <Text label="Postal address" value={b.address} onChange={(address) => set({ address })} />
          <span className="flex items-center justify-between text-[12px] font-medium text-ink-body">
            Unsubscribe link <Switch checked={b.showUnsubscribe} onChange={(showUnsubscribe) => set({ showUnsubscribe })} label="Show unsubscribe link" showState={false} />
          </span>
          <AlignPick value={b.align} onChange={(align) => set({ align })} />
        </>
      )}

      <div className="mt-1 grid gap-3 border-t border-line-soft pt-3.5">
        <p className="text-[11px] font-medium tracking-wide text-ink-muted uppercase">Spacing & background</p>
        <Num label="Padding top/bottom" suffix="px" value={b.paddingY} min={0} max={120} onChange={(paddingY) => set({ paddingY })} />
        <Num label="Padding left/right" suffix="px" value={b.paddingX} min={0} max={120} onChange={(paddingX) => set({ paddingX })} />
        <Color label="Background" value={b.background} fallback="#FFFFFF" onChange={(background) => set({ background })} />
      </div>
    </div>
  );
}

function ToolBtn({ label, onClick, children, danger }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cn("inline-flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-brand-depth-10 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-action", danger && "hover:bg-[var(--danger-bg)] hover:text-[#B42318]")}>
      {children}
    </button>
  );
}

/** Whole-email settings, shown when no block is selected. */
export function StyleInspector({ style, onChange }: { style: EmailStyle; onChange: (patch: Partial<EmailStyle>) => void }) {
  return (
    <div className="grid gap-3.5">
      <p className="text-[13px] font-semibold text-ink">Email style</p>
      <p className="-mt-2 text-[12px] leading-4 text-ink-muted">Select a block in the email to edit it.</p>
      <Field label="Font">
        <select value={style.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })} className={small}>
          {FONT_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </Field>
      <Num label="Content width" suffix="px" value={style.contentWidth} min={320} max={800} step={10} onChange={(contentWidth) => onChange({ contentWidth })} />
      <Color label="Page background" value={style.background} fallback="#F8F8FC" onChange={(background) => onChange({ background })} />
      <Color label="Content background" value={style.contentBackground} fallback="#FFFFFF" onChange={(contentBackground) => onChange({ contentBackground })} />
      <Color label="Text colour" value={style.textColor} fallback="#272238" onChange={(textColor) => onChange({ textColor })} />
      <Color label="Link colour" value={style.linkColor} fallback="#7C3AED" onChange={(linkColor) => onChange({ linkColor })} />
      <Color label="Button colour" value={style.buttonColor} fallback="#7C3AED" onChange={(buttonColor) => onChange({ buttonColor })} />
      <Color label="Button text" value={style.buttonTextColor} fallback="#FFFFFF" onChange={(buttonTextColor) => onChange({ buttonTextColor })} />
      <Num label="Corner radius" suffix="px" value={style.radius} min={0} max={32} onChange={(radius) => onChange({ radius })} />
    </div>
  );
}
