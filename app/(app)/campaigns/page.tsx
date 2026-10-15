import { Suspense } from "react";
import type { Metadata } from "next";
import { CampaignsView, CampaignsViewFallback } from "@/components/campaigns/campaigns-view";

export const metadata: Metadata = { title: "Campaigns" };

export default function CampaignsPage() {
  return (
    // The list reads its state from the URL, so it renders on the client inside Suspense.
    <Suspense fallback={<CampaignsViewFallback />}>
      <CampaignsView />
    </Suspense>
  );
}
