import type { Metadata } from "next";
import { GettingStartedView } from "@/components/getting-started/getting-started-view";

export const metadata: Metadata = { title: "Getting Started" };

export default function GettingStartedPage() {
  return <GettingStartedView />;
}
