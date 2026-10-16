import type { Metadata } from "next";
import { FormsView } from "@/components/forms/forms";

export const metadata: Metadata = { title: "Forms" };

export default function FormsPage() {
  return <FormsView />;
}
