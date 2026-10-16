import type { Metadata } from "next";
import { SegmentsView } from "@/components/audience/segments";

export const metadata: Metadata = { title: "Segments" };

export default function SegmentsPage() {
  return <SegmentsView />;
}
