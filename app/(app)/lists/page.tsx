import type { Metadata } from "next";
import { ListsView } from "@/components/audience/lists";

export const metadata: Metadata = { title: "Lists" };

export default function ListsPage() {
  return <ListsView />;
}
