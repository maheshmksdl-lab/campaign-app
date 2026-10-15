import type { Metadata } from "next";
import { CampaignDetailView } from "@/components/campaigns/campaign-detail-view";

export const metadata: Metadata = { title: "Campaign details" };

export default async function CampaignPage({ params }: PageProps<"/campaigns/[campaignId]">) {
  const { campaignId } = await params;
  return <CampaignDetailView id={decodeURIComponent(campaignId)} />;
}
