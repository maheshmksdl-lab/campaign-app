import type { Metadata } from "next";
import { WaTemplateEditorRoute } from "@/components/whatsapp/wa-templates";

export const metadata: Metadata = { title: "WhatsApp template" };

export default async function WhatsAppTemplatePage({ params }: PageProps<"/templates/whatsapp/[templateId]">) {
  const { templateId } = await params;
  return <WaTemplateEditorRoute id={decodeURIComponent(templateId)} />;
}
