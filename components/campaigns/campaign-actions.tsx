"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveIcon,
  ArrowCounterClockwiseIcon,
  CalendarCheckIcon,
  CopyIcon,
  EyeIcon,
  PauseIcon,
  PencilSimpleIcon,
  PlayIcon,
  TrashIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/campaign-ui";
import type { MenuAction } from "@/components/shared/row-menu";
import { useArchiveCampaigns, useDeleteCampaigns, useDuplicateCampaign, usePauseCampaign, useRestoreCampaigns, useResumeCampaign } from "@/hooks/use-campaigns";
import { ApiError } from "@/lib/api/campaigns";
import { canPause, canResume, canSchedule, isFlow } from "@/lib/campaign-meta";
import { pluralize } from "@/lib/format";
import { campaignHref } from "@/lib/routes";
import type { Campaign } from "@/lib/types/campaigns";
import { EditCampaignDialog, PreviewDialog, ScheduleDialog } from "./campaign-dialogs";

type Target = { ids: string[]; label: string; sendingCount?: number };

/**
 * Every campaign action — edit, preview, duplicate, schedule, pause / resume,
 * archive / restore and delete — with its dialogs, toasts and Undo. Shared by
 * the listing (row menu, bulk bar), the details page and the dashboard.
 */
export function useCampaignActions({ onDeleted }: { onDeleted?: (ids: string[]) => void } = {}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [previewing, setPreviewing] = useState<Campaign | null>(null);
  const [scheduling, setScheduling] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState<Target | null>(null);
  const duplicateM = useDuplicateCampaign();
  const pauseM = usePauseCampaign();
  const resumeM = useResumeCampaign();
  const archiveM = useArchiveCampaigns();
  const restoreM = useRestoreCampaigns();
  const deleteM = useDeleteCampaigns();

  const fail = (title: string) => (e: Error) => toast.error(title, { description: e.message });

  const duplicate = (c: Campaign) =>
    duplicateM.mutate(c.id, {
      onSuccess: (copy) => toast.success("Campaign duplicated", { description: `${copy.name} saved as a draft`, action: { label: "Open", onClick: () => router.push(campaignHref(copy.id)) } }),
      onError: fail("Couldn't duplicate"),
    });

  const pause = (c: Campaign) =>
    pauseM.mutate(c.id, {
      onSuccess: (p) => toast.success(`${p.name} paused`, { description: isFlow(p) ? "No new contacts will enter until you resume." : p.pausedFrom === "scheduled" ? "It won't send until you resume or reschedule." : "Remaining messages are on hold." }),
      onError: fail("Couldn't pause"),
    });

  const resume = (c: Campaign) =>
    resumeM.mutate(c.id, {
      onSuccess: (r) => toast.success(`${r.name} resumed`, { description: r.status === "scheduled" ? "Back on schedule." : "Sending again." }),
      onError: (e) => {
        // The send time passed while paused: pick a new one.
        if (e instanceof ApiError && e.field === "reschedule") {
          toast.info("Choose a new send time", { description: e.message });
          setScheduling(c);
        } else fail("Couldn't resume")(e);
      },
    });

  const restore = (ids: string[], label: string, quiet = false) =>
    restoreM.mutate(ids, {
      onSuccess: (r) => !quiet && toast.success(r.done === 1 ? "Campaign restored" : `${pluralize(r.done, "campaign")} restored`, { description: label }),
      onError: fail("Couldn't restore"),
    });

  const archive = (ids: string[], label: string, onDone?: () => void) =>
    archiveM.mutate(ids, {
      onSuccess: (r) => {
        onDone?.();
        if (!r.done) {
          toast.error("Nothing archived", { description: "Campaigns that are sending must be paused first." });
          return;
        }
        toast.success(r.done === 1 ? "Campaign archived" : `${pluralize(r.done, "campaign")} archived`, {
          description: r.skipped ? `${label} · ${pluralize(r.skipped, "sending campaign")} skipped — pause it first` : label,
          action: { label: "Undo", onClick: () => restore(ids, label, true) },
        });
      },
      onError: fail("Couldn't archive"),
    });

  const askDelete = (ids: string[], label: string, sendingCount = 0) => setDeleting({ ids, label, sendingCount });

  const confirmDelete = (onDone?: (ids: string[]) => void) => {
    if (!deleting) return;
    const { ids, label } = deleting;
    deleteM.mutate(ids, {
      onSuccess: (r) => {
        setDeleting(null);
        onDone?.(ids);
        onDeleted?.(ids);
        if (!r.done) toast.error("Nothing deleted", { description: "Campaigns that are sending must be paused first." });
        else toast.success(r.done === 1 ? "Campaign deleted" : `${pluralize(r.done, "campaign")} deleted`, { description: r.skipped ? `${pluralize(r.skipped, "sending campaign")} kept` : label });
      },
      onError: fail("Couldn't delete"),
    });
  };

  /** The "⋯" menu for one campaign. `onDetails` hides "View details" on the details page itself. */
  const actionsFor = (c: Campaign, { onDetails = false }: { onDetails?: boolean } = {}): MenuAction[] => {
    const archived = c.status === "archived";
    return [
      !onDetails && { label: "View details", icon: ArrowSquareOutIcon, href: campaignHref(c.id) },
      !archived && { label: "Edit", icon: PencilSimpleIcon, onSelect: () => setEditing(c) },
      { label: "Preview", icon: EyeIcon, onSelect: () => setPreviewing(c) },
      { label: "Duplicate", icon: CopyIcon, onSelect: () => duplicate(c) },
      canSchedule(c) && { label: c.status === "scheduled" || c.status === "paused" ? "Reschedule" : "Schedule", icon: CalendarCheckIcon, onSelect: () => setScheduling(c), separatorBefore: true },
      canPause(c) && { label: "Pause", icon: PauseIcon, onSelect: () => pause(c), separatorBefore: !canSchedule(c) },
      canResume(c) && { label: "Resume", icon: PlayIcon, onSelect: () => resume(c), separatorBefore: !canSchedule(c) },
      archived
        ? { label: "Restore", icon: ArrowCounterClockwiseIcon, onSelect: () => restore([c.id], c.name), separatorBefore: true }
        : c.status !== "sending" && { label: "Archive", icon: ArchiveIcon, onSelect: () => archive([c.id], c.name), separatorBefore: true },
      c.status !== "sending" && { label: "Delete", icon: TrashIcon, destructive: true, onSelect: () => askDelete([c.id], c.name) },
    ];
  };

  const element = (onDeleteDone?: (ids: string[]) => void) => (
    <>
      <EditCampaignDialog campaign={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <ScheduleDialog campaign={scheduling} onOpenChange={(o) => !o && setScheduling(null)} />
      <PreviewDialog campaign={previewing} onOpenChange={(o) => !o && setPreviewing(null)} onEdit={setEditing} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting && deleting.ids.length > 1 ? `Delete ${deleting.ids.length} campaigns?` : "Delete this campaign?"}
        description={
          <>
            <p>
              <span className="font-medium text-ink">{deleting?.label}</span> will be removed permanently, including {deleting && deleting.ids.length > 1 ? "their" : "its"} reports. This can&apos;t be undone — archive instead to keep the results.
            </p>
            {!!deleting?.sendingCount && <p className="mt-2">{pluralize(deleting.sendingCount, "campaign")} still sending will be kept.</p>}
          </>
        }
        confirmLabel="Delete"
        pending={deleteM.isPending}
        onConfirm={() => confirmDelete(onDeleteDone)}
      />
    </>
  );

  return {
    actionsFor,
    edit: setEditing,
    preview: setPreviewing,
    schedule: setScheduling,
    duplicate,
    pause,
    resume,
    archive,
    restore,
    askDelete,
    element,
    busy: duplicateM.isPending || pauseM.isPending || resumeM.isPending || archiveM.isPending || restoreM.isPending,
  };
}
