"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { OutlineButton } from "@/components/shared/campaign-ui";

/** Short numbered guide for the "Set up and explore" links. */
export function GuideDialog({ open, onOpenChange, title, intro, steps }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; intro: string; steps: { title: string; text: string }[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogTitle className="pr-6 text-[17px] font-semibold text-ink">{title}</DialogTitle>
        <DialogDescription className="text-[13.5px] leading-[21px] text-ink-muted">{intro}</DialogDescription>
        <ol className="mt-1 space-y-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-3">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-campaign-tint text-[12px] font-semibold text-campaign-primary">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-ink">{s.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-5 text-ink-body">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-2 flex justify-end">
          <OutlineButton onClick={() => onOpenChange(false)}>Got it</OutlineButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
