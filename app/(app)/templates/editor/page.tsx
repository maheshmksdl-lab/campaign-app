import type { Metadata } from "next";
import { ContentEditor } from "@/components/templates/content-editor";

export const metadata: Metadata = { title: "Email editor" };

export default function ContentEditorPage() {
  return <ContentEditor />;
}
