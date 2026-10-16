import { Suspense } from "react";
import type { Metadata } from "next";
import { ContactsView, ContactsViewFallback } from "@/components/contacts/contacts-view";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage() {
  return (
    // Tab and search live in the URL, so the view renders on the client inside Suspense.
    <Suspense fallback={<ContactsViewFallback />}>
      <ContactsView />
    </Suspense>
  );
}
