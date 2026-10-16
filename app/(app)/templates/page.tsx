import type { Metadata } from "next";
import { CreateTemplateView } from "@/components/templates/create-template-view";

export const metadata: Metadata = { title: "Email Templates" };

export default function TemplatesPage() {
  return <CreateTemplateView />;
}
