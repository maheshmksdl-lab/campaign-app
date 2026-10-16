import type { Metadata } from "next";
import { SegmentEditorRoute } from "@/components/audience/segments";

export const metadata: Metadata = { title: "Segment" };

export default async function SegmentPage({ params }: PageProps<"/segments/[segmentId]">) {
  const { segmentId } = await params;
  return <SegmentEditorRoute id={decodeURIComponent(segmentId)} />;
}
