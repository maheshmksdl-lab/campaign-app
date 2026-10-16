import type { Metadata } from "next";
import { ContactDetailView } from "@/components/audience/contact-detail";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage({ params }: PageProps<"/contacts/[contactId]">) {
  const { contactId } = await params;
  return <ContactDetailView id={decodeURIComponent(contactId)} />;
}
