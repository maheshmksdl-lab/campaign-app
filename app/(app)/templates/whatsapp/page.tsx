import type { Metadata } from "next";
import { WaTemplatesView } from "@/components/whatsapp/wa-templates";

export const metadata: Metadata = { title: "WhatsApp Templates" };

export default function WhatsAppTemplatesPage() {
  return <WaTemplatesView />;
}
