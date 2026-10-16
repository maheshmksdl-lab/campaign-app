import type { Metadata } from "next";
import { ListDetailView } from "@/components/audience/lists";

export const metadata: Metadata = { title: "List" };

export default async function ListPage({ params }: PageProps<"/lists/[listId]">) {
  const { listId } = await params;
  return <ListDetailView id={decodeURIComponent(listId)} />;
}
