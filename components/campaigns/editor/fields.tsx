"use client";

import { useRef, useState, type ComponentProps, type ReactNode } from "react";
import type { Icon } from "@phosphor-icons/react";
import { BracketsCurlyIcon, CaretDownIcon, DotsNineIcon, SmileyIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MERGE_TAGS, mergeTagToken } from "@/lib/email-render";
import { cn } from "@/lib/utils";

/** Round tinted icon used in every editor card heading. */
export function SectionIcon({ icon: IconCmp }: { icon: Icon }) {
  return (
    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-campaign-tint text-campaign-action" aria-hidden>
      <IconCmp size={20} />
    </span>
  );
}

/** A section card of the campaign editor (Recipients, Email Details…). */
export function EditorCard({ icon, title, required, action, children, className, id }: { icon: Icon; title: string; required?: boolean; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  const titleId = `${id ?? title}-title`;
  return (
    <section id={id} aria-labelledby={titleId} className={cn("min-w-0 scroll-mt-32 rounded-2xl border border-line bg-white shadow-card", className)}>
      <header className="flex items-center gap-3 px-5 pt-5 pb-3">
        <SectionIcon icon={icon} />
        <h2 id={titleId} className="text-[16px] leading-6 font-semibold text-campaign-depth">
          {title}
          {required && (
            <span className="ml-0.5 text-[#E5484D]" aria-hidden>
              *
            </span>
          )}
        </h2>
        <div className="ml-auto flex items-center gap-2">
          {action}
          {/* Decorative grip, as in the design (sections aren't reorderable). */}
          <DotsNineIcon size={22} aria-hidden className="text-[#D4CEE0]" />
        </div>
      </header>
      {children}
    </section>
  );
}

/** Label on the left, a bordered control on the right, its error below. */
export function EditorRow({ label, htmlFor, required, error, children, className }: { label: string; htmlFor?: string; required?: boolean; error?: string; children: ReactNode; className?: string }) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className={cn("grid gap-x-4 gap-y-1.5 px-5 py-2 sm:grid-cols-[104px_minmax(0,1fr)_20px] sm:items-center", className)}>
      <Label htmlFor={htmlFor} className="text-[14px] leading-5 text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-[#E5484D]" aria-hidden>
            *
          </span>
        )}
      </Label>
      <div className="flex min-w-0 items-center gap-2">{children}</div>
      <span className="hidden sm:flex sm:justify-center">{error && <WarningCircleIcon size={19} aria-hidden className="text-[#E5484D]" />}</span>
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-[12px] leading-4 font-medium text-[#D92D20] sm:col-start-2">
          {error}
        </p>
      )}
    </div>
  );
}

/** Bordered input used by every editor field (44px, consistent with selects). */
export const editorInputClass =
  "h-11 w-full min-w-0 rounded-lg border border-[#E4E0EC] bg-white px-3.5 text-[13.5px] text-ink outline-none transition-colors placeholder:text-[#8F8A9E] hover:border-[#D3CCE3] focus:border-campaign-action focus:ring-3 focus:ring-brand-10 disabled:bg-campaign-muted disabled:opacity-70 aria-invalid:border-[#F0A8A4] aria-invalid:focus:ring-[#E5484D]/10";

export function InlineInput({ className, invalid, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return <input {...props} aria-invalid={invalid || undefined} aria-describedby={invalid && props.id ? `${props.id}-error` : undefined} className={cn(editorInputClass, className)} />;
}

/** An email field with a dropdown of known sender addresses (any valid address can be typed). */
export function EmailPickerInput({ options, value, onChange, invalid, ...rest }: Omit<ComponentProps<"input">, "onChange" | "value"> & { options: string[]; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div className="relative w-full min-w-0">
      <InlineInput {...rest} invalid={invalid} value={value} onChange={(e) => onChange(e.target.value)} className="pr-11" />
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Choose a sender address" className="absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-body hover:bg-campaign-surface focus-visible:outline-2 focus-visible:outline-brand-action data-[state=open]:bg-campaign-surface">
          <CaretDownIcon size={15} aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {options.map((o) => (
            <DropdownMenuItem key={o} onSelect={() => onChange(o)} className={cn(o === value && "font-medium text-campaign-primary")}>
              {o}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

const EMOJIS = ["😀", "😍", "🎉", "🔥", "✨", "🎁", "☀️", "❤️", "👋", "🚀", "💜", "📣", "🛒", "⏰", "✅", "⭐"];

const iconBtn =
  "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-body transition-colors hover:bg-campaign-surface hover:text-campaign-action focus-visible:outline-2 focus-visible:outline-brand-action data-[state=open]:bg-campaign-surface data-[state=open]:text-campaign-action";

/** True when `ch` was just typed at the caret as the start of a word. */
const typedTrigger = (v: string, pos: number, ch: string) => v[pos - 1] === ch && (pos === 1 || /\s/.test(v[pos - 2] ?? ""));

/**
 * Subject / preheader input: typing "@" opens personalization fields and ":"
 * opens emojis (both at the start of a word); the buttons inside the field
 * insert a merge tag or an emoji at the caret.
 */
export function PersonalizedInput({ id, value, onChange, placeholder, invalid, maxLength }: { id: string; value: string; onChange: (v: string) => void; placeholder: string; invalid?: boolean; maxLength?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState<"tags" | "emoji" | null>(null);
  const [active, setActive] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);

  /** Insert at the caret; `replaceTrigger` removes the "@" or ":" that opened the menu. */
  const insert = (text: string, replaceTrigger?: string) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const from = replaceTrigger && value[start - 1] === replaceTrigger ? start - 1 : start;
    const next = value.slice(0, from) + text + value.slice(end);
    onChange(maxLength ? next.slice(0, maxLength) : next);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = from + text.length;
      el?.setSelectionRange(pos, pos);
    });
  };

  const pickTag = (key: string, fromTrigger = false) => {
    insert(mergeTagToken(key), fromTrigger ? "@" : undefined);
    setMenu(null);
    setTagOpen(false);
  };
  const pickEmoji = (em: string, fromTrigger = false) => {
    insert(em, fromTrigger ? ":" : undefined);
    setMenu(null);
    setEmojiOpen(false);
  };
  const count = menu === "emoji" ? EMOJIS.length : MERGE_TAGS.length;

  return (
    <Popover open={!!menu} onOpenChange={(o) => !o && setMenu(null)}>
      <PopoverAnchor asChild>
        <div className="relative w-full min-w-0">
          <input
            ref={ref}
            id={id}
            value={value}
            maxLength={maxLength}
            placeholder={placeholder}
            role="combobox"
            aria-controls={`${id}-menu`}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-expanded={!!menu}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-error` : undefined}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v);
              const pos = e.target.selectionStart ?? v.length;
              setMenu(typedTrigger(v, pos, "@") ? "tags" : typedTrigger(v, pos, ":") ? "emoji" : null);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (!menu) return;
              if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) {
                e.preventDefault();
                const fwd = e.key === "ArrowDown" || e.key === "ArrowRight";
                setActive((i) => (i + (fwd ? 1 : count - 1)) % count);
              } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                if (menu === "tags") pickTag(MERGE_TAGS[active].key, true);
                else pickEmoji(EMOJIS[active], true);
              } else if (e.key === "Escape") setMenu(null);
            }}
            className={cn(editorInputClass, "pr-[76px]")}
          />
          <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center">
            <Popover open={tagOpen} onOpenChange={setTagOpen}>
              <PopoverTrigger aria-label="Insert personalization" title="Insert personalization" className={iconBtn}>
                <BracketsCurlyIcon size={17} aria-hidden />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-60 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
                <TagList active={-1} onPick={(k) => pickTag(k)} />
              </PopoverContent>
            </Popover>
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger aria-label="Insert emoji" title="Insert emoji" className={iconBtn}>
                <SmileyIcon size={19} aria-hidden />
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
                <EmojiGrid active={-1} onPick={(em) => pickEmoji(em)} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className={menu === "emoji" ? "w-56 p-2" : "w-60 p-1"} onOpenAutoFocus={(e) => e.preventDefault()} onCloseAutoFocus={(e) => e.preventDefault()}>
        {menu === "emoji" ? <EmojiGrid id={`${id}-menu`} active={active} onPick={(em) => pickEmoji(em, true)} /> : <TagList id={`${id}-menu`} active={active} onPick={(k) => pickTag(k, true)} />}
      </PopoverContent>
    </Popover>
  );
}

function EmojiGrid({ id, active, onPick }: { id?: string; active: number; onPick: (em: string) => void }) {
  return (
    <div id={id} className="grid grid-cols-8 gap-0.5" role="listbox" aria-label="Emojis">
      {EMOJIS.map((em, i) => (
        <button
          key={em}
          type="button"
          role="option"
          aria-selected={i === active}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(em)}
          className={cn("inline-flex size-6 items-center justify-center rounded text-[15px] hover:bg-brand-surface focus-visible:outline-2 focus-visible:outline-brand-action", i === active && "bg-brand-surface ring-1 ring-campaign-soft")}
          aria-label={`Insert ${em}`}
        >
          {em}
        </button>
      ))}
    </div>
  );
}

function TagList({ id, active, onPick }: { id?: string; active: number; onPick: (key: string) => void }) {
  return (
    <>
      <p className="px-2 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-ink-muted uppercase">Personalize</p>
      <ul id={id} role="listbox" aria-label="Personalization fields">
        {MERGE_TAGS.map((t, i) => (
          <li key={t.key} role="option" aria-selected={i === active}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(t.key)}
              className={cn("flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-ink hover:bg-brand-surface", i === active && "bg-brand-surface")}
            >
              {t.label}
              <code className="font-mono text-[11px] text-ink-muted">{mergeTagToken(t.key)}</code>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
