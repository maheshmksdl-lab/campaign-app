import type { Metadata } from "next";
import { WaCampaignRoute } from "@/components/whatsapp/wa-campaigns";

export const metadata: Metadata = { title: "WhatsApp campaign" };

export default async function WhatsAppCampaignPage({ params }: PageProps<"/campaigns/whatsapp/[waId]">) {
  const { waId } = await params;
  return <WaCampaignRoute id={decodeURIComponent(waId)} />;
}
