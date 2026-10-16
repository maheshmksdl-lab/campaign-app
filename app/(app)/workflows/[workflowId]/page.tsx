import type { Metadata } from "next";
import { WorkflowRoute } from "@/components/workflows/workflows";

export const metadata: Metadata = { title: "Workflow" };

export default async function WorkflowPage({ params }: PageProps<"/workflows/[workflowId]">) {
  const { workflowId } = await params;
  return <WorkflowRoute id={decodeURIComponent(workflowId)} />;
}
