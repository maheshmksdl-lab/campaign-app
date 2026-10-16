import { Suspense } from "react";
import type { Metadata } from "next";
import { TemplateGallery, TemplateGalleryFallback } from "@/components/templates/template-gallery";

export const metadata: Metadata = { title: "Template Gallery" };

export default function TemplateGalleryPage() {
  return (
    // Section, category and the campaign being edited come from the URL.
    <Suspense fallback={<TemplateGalleryFallback />}>
      <TemplateGallery />
    </Suspense>
  );
}
