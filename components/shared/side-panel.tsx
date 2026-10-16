"use client";

import type { FormEvent, ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { OutlineButton, PrimaryButton } from "@/components/shared/campaign-ui";

/**
 * Right-hand form panel for create / edit forms that should keep the page in
 * view (contacts, lists): header, scrolling body, Cancel / Save footer.
 */
export function SidePanel({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel,
  saving,
  note,
  wide,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  onSubmit: (e: FormEvent) => void;
  submitLabel: string;
  saving?: boolean;
  note?: ReactNode;
  wide?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={wide ? "w-full gap-0 p-0 sm:max-w-[560px]" : "w-full gap-0 p-0 sm:max-w-[460px]"}>
        <div className="border-b border-line-soft px-5 pt-5 pb-4 pr-12">
          <SheetTitle className="text-[17px] font-semibold text-campaign-depth">{title}</SheetTitle>
          {description && <SheetDescription className="mt-1 text-[13px] leading-5 text-ink-muted">{description}</SheetDescription>}
        </div>
        <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft bg-campaign-muted px-5 py-3">
            {note && <p className="mr-auto text-[12px] leading-4 text-ink-muted">{note}</p>}
            <OutlineButton onClick={() => onOpenChange(false)}>Cancel</OutlineButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Saving…" : submitLabel}
            </PrimaryButton>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
