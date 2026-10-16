import type { Metadata } from "next";
import { CampaignRoute } from "@/components/campaigns/campaign-route";

export const metadata: Metadata = { title: "Campaign details" };

export default async function CampaignPage({ params, searchParams }: PageProps<"/campaigns/[campaignId]">) {
  const { campaignId } = await params;
  const { view, type } = await searchParams;
  return <CampaignRoute id={decodeURIComponent(campaignId)} view={typeof view === "string" ? view : undefined} type={typeof type === "string" ? type : undefined} />;
}
