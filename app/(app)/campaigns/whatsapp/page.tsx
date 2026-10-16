import type { Metadata } from "next";
import { WaCampaignsView } from "@/components/whatsapp/wa-campaigns";

export const metadata: Metadata = { title: "WhatsApp Campaigns" };

export default function WhatsAppCampaignsPage() {
  return <WaCampaignsView />;
}
