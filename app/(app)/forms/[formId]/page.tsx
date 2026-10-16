import type { Metadata } from "next";
import { FormEditorRoute } from "@/components/forms/forms";

export const metadata: Metadata = { title: "Form builder" };

export default async function FormPage({ params }: PageProps<"/forms/[formId]">) {
  const { formId } = await params;
  return <FormEditorRoute id={decodeURIComponent(formId)} />;
}
