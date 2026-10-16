"use client";

import { useMemo } from "react";
import { useCampaign } from "@/hooks/use-campaigns";
import { useHydrated } from "@/hooks/use-hydrated";
import { demoNow } from "@/lib/api/store";
import { DEFAULT_SENDER } from "@/lib/mock-data/campaigns";
import { NEW_CAMPAIGN_ID } from "@/lib/routes";
import type { Campaign } from "@/lib/types/campaigns";
import { CampaignDetailView } from "./campaign-detail-view";
import { CampaignEditor, EditorSkeleton, opensInEditor } from "./editor/campaign-editor";

/** An unsaved campaign for Create Campaign: empty fields, defaults only where the form needs one. */
function blankCampaign(type: "email" | "sms"): Campaign {
  const now = demoNow();
  const sms = type === "sms";
  return {
    id: NEW_CAMPAIGN_ID,
    name: sms ? "Untitled SMS Campaign" : "Untitled Email Campaign",
    type,
    status: "draft",
    subject: sms ? undefined : "",
    previewText: sms ? undefined : "",
    message: sms ? "" : undefined,
    senderName: sms ? DEFAULT_SENDER.name : "",
    senderEmail: sms ? undefined : "",
    senderId: sms ? DEFAULT_SENDER.smsId : undefined,
    replyTo: sms ? undefined : "",
    audienceId: "",
    audienceIds: [],
    audience: "",
    recipients: 0,
    topic: "Marketing",
    trackReplies: false,
    trackOpens: true,
    trackClicks: true,
    createdAt: now,
    updatedAt: now,
    history: [],
  };
}

function NewCampaign({ type }: { type: "email" | "sms" }) {
  const hydrated = useHydrated();
  const campaign = useMemo(() => blankCampaign(type), [type]);
  // The unsaved draft lives in this tab's session storage, which only exists after hydration.
  if (!hydrated) return <EditorSkeleton />;
  return <CampaignEditor key={`new-${type}`} campaign={campaign} isNew />;
}

/**
 * /campaigns/[id]: campaigns that haven't sent open the full-page editor
 * (also what Edit opens); sent, sending and archived ones open their report.
 * `?view=report` shows the report and activity for any campaign.
 * /campaigns/new is Create Campaign: the same editor on a blank campaign.
 */
export function CampaignRoute({ id, view, type }: { id: string; view?: string; type?: string }) {
  if (id === NEW_CAMPAIGN_ID) return <NewCampaign type={type === "sms" ? "sms" : "email"} />;
  return <ExistingCampaign id={id} view={view} />;
}

function ExistingCampaign({ id, view }: { id: string; view?: string }) {
  const { data, isError } = useCampaign(id);
  const c = data?.campaign;
  if (view !== "report" && !isError) {
    if (!c) return <EditorSkeleton />;
    if (opensInEditor(c)) return <CampaignEditor key={c.id} campaign={c} />;
  }
  return <CampaignDetailView id={id} />;
}
