"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHydrated } from "@/hooks/use-hydrated";
import { createItem, deleteItems, duplicateItem, getItem, listItems, updateItem, type CollectionKey, type NewItem } from "@/lib/api/workspace";
import { campaignKeys } from "./use-campaigns";

/**
 * Data hooks for WhatsApp, forms, workflows and files — same rules as the
 * campaign hooks: data is withheld until hydration, and a change refreshes
 * the collection and the dashboard's activity feed.
 */
export const workspaceKeys = {
  all: (key: CollectionKey) => ["workspace", key] as const,
  list: (key: CollectionKey) => ["workspace", key, "list"] as const,
  item: (key: CollectionKey, id: string) => ["workspace", key, "item", id] as const,
};

function gated<T extends { data: unknown }>(q: T, hydrated: boolean): T {
  return hydrated ? q : { ...q, data: undefined };
}

export function useItems<K extends CollectionKey>(key: K) {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: workspaceKeys.list(key), queryFn: () => listItems(key) }), hydrated);
}

export function useItem<K extends CollectionKey>(key: K, id: string, enabled = true) {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: workspaceKeys.item(key, id), queryFn: () => getItem(key, id), retry: false, enabled }), hydrated);
}

function useInvalidate(key: CollectionKey) {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: workspaceKeys.all(key) }), qc.invalidateQueries({ queryKey: campaignKeys.all })]);
}

export function useCreateItem<K extends CollectionKey>(key: K) {
  const invalidate = useInvalidate(key);
  return useMutation({ mutationFn: (input: NewItem<K>) => createItem(key, input), onSuccess: invalidate });
}

export function useUpdateItem<K extends CollectionKey>(key: K) {
  const invalidate = useInvalidate(key);
  return useMutation({ mutationFn: ({ id, patch, note }: { id: string; patch: Partial<NewItem<K>>; note?: string }) => updateItem(key, id, patch, note), onSuccess: invalidate });
}

export function useDuplicateItem<K extends CollectionKey>(key: K) {
  const invalidate = useInvalidate(key);
  return useMutation({ mutationFn: (id: string) => duplicateItem(key, id), onSuccess: invalidate });
}

export function useDeleteItems<K extends CollectionKey>(key: K) {
  const qc = useQueryClient();
  const invalidate = useInvalidate(key);
  return useMutation({
    mutationFn: (ids: string[]) => deleteItems(key, ids),
    onSuccess: (_r, ids) => {
      ids.forEach((id) => qc.removeQueries({ queryKey: workspaceKeys.item(key, id) }));
      return invalidate();
    },
  });
}
