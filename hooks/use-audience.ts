"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHydrated } from "@/hooks/use-hydrated";
import { estimateAudience } from "@/lib/api/audiences";
import {
  addContactsToList,
  addContactTags,
  checkImport,
  createContact,
  deleteContacts,
  getContact,
  getContactTags,
  importContacts,
  listContacts,
  removeContactsFromList,
  removeContactTags,
  setContactsExcluded,
  setContactsSubscription,
  updateContact,
} from "@/lib/api/contacts";
import { createList, deleteList, duplicateList, getList, listLists, updateList } from "@/lib/api/lists";
import { createSegment, deleteSegment, duplicateSegment, getSegment, listSegments, previewSegment, updateSegment } from "@/lib/api/segments";
import type { AudienceSelection, Contact, ContactInput, ContactQuery, ImportOptions, ImportRow, ListInput, SegmentInput } from "@/lib/types/audience";
import { campaignKeys } from "./use-campaigns";

/**
 * Data hooks for Contacts, Lists and Segments. Same rules as the campaign
 * hooks: data is withheld until hydration, and every change refreshes every
 * view that could show it (audience pickers and campaigns included).
 */
export const audienceKeys = {
  all: ["audience"] as const,
  contacts: (q: ContactQuery) => ["audience", "contacts", q] as const,
  contact: (id: string) => ["audience", "contact", id] as const,
  tags: ["audience", "tags"] as const,
  lists: ["audience", "lists"] as const,
  list: (id: string) => ["audience", "list", id] as const,
  segments: ["audience", "segments"] as const,
  segment: (id: string) => ["audience", "segment", id] as const,
  segmentPreview: (def: Pick<SegmentInput, "match" | "conditions">) => ["audience", "segment-preview", def] as const,
  estimate: (sel: AudienceSelection) => ["audience", "estimate", sel] as const,
};

function gated<T extends { data: unknown }>(q: T, hydrated: boolean): T {
  return hydrated ? q : { ...q, data: undefined };
}

export function useContacts(q: ContactQuery) {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: audienceKeys.contacts(q), queryFn: () => listContacts(q), placeholderData: keepPreviousData }), hydrated);
}

export function useContact(id: string) {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: audienceKeys.contact(id), queryFn: () => getContact(id), retry: false }), hydrated);
}

export function useContactTags() {
  return useQuery({ queryKey: audienceKeys.tags, queryFn: getContactTags });
}

export function useLists() {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: audienceKeys.lists, queryFn: listLists }), hydrated);
}

export function useList(id: string) {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: audienceKeys.list(id), queryFn: () => getList(id), retry: false }), hydrated);
}

export function useSegments() {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: audienceKeys.segments, queryFn: listSegments }), hydrated);
}

export function useSegment(id: string) {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: audienceKeys.segment(id), queryFn: () => getSegment(id), retry: false }), hydrated);
}

/** Live count for the segment builder. */
export function useSegmentPreview(def: Pick<SegmentInput, "match" | "conditions">, enabled = true) {
  return useQuery({ queryKey: audienceKeys.segmentPreview(def), queryFn: () => previewSegment(def), enabled, placeholderData: keepPreviousData });
}

/** Unique and eligible recipients for a campaign's audience selection. */
export function useAudienceEstimate(sel: AudienceSelection, enabled = true) {
  return useQuery({ queryKey: audienceKeys.estimate(sel), queryFn: () => estimateAudience(sel), enabled, placeholderData: keepPreviousData });
}

/** Audience changes can affect campaign audiences and history, so both refresh. */
function useInvalidateAudience() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: audienceKeys.all }),
      qc.invalidateQueries({ queryKey: campaignKeys.audiences }),
      qc.invalidateQueries({ queryKey: campaignKeys.all }),
    ]);
}

// ── Contacts ─────────────────────────────────────────────────────────

export function useCreateContact() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: (input: ContactInput) => createContact(input), onSuccess: invalidate });
}

export function useUpdateContact() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: ContactInput }) => updateContact(id, input), onSuccess: invalidate });
}

export function useDeleteContacts() {
  const qc = useQueryClient();
  const invalidate = useInvalidateAudience();
  return useMutation({
    mutationFn: (ids: string[]) => deleteContacts(ids),
    onSuccess: (_r, ids) => {
      ids.forEach((id) => qc.removeQueries({ queryKey: audienceKeys.contact(id) }));
      return invalidate();
    },
  });
}

export function useAddToList() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: ({ ids, listId }: { ids: string[]; listId: string }) => addContactsToList(ids, listId), onSuccess: invalidate });
}

export function useRemoveFromList() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: ({ ids, listId }: { ids: string[]; listId: string }) => removeContactsFromList(ids, listId), onSuccess: invalidate });
}

export function useAddTags() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: ({ ids, tags }: { ids: string[]; tags: string[] }) => addContactTags(ids, tags), onSuccess: invalidate });
}

export function useRemoveTags() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: ({ ids, tags }: { ids: string[]; tags: string[] }) => removeContactTags(ids, tags), onSuccess: invalidate });
}

export function useSetExcluded() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: ({ ids, excluded }: { ids: string[]; excluded: boolean }) => setContactsExcluded(ids, excluded), onSuccess: invalidate });
}

export function useSetSubscription() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: ({ ids, status }: { ids: string[]; status: Contact["subscription"] }) => setContactsSubscription(ids, status), onSuccess: invalidate });
}

export function useCheckImport() {
  return useMutation({ mutationFn: (rows: ImportRow[]) => checkImport(rows) });
}

export function useImportContacts() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: ({ rows, options }: { rows: ImportRow[]; options: ImportOptions }) => importContacts(rows, options), onSuccess: invalidate });
}

// ── Lists ────────────────────────────────────────────────────────────

export function useCreateList() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: (input: ListInput) => createList(input), onSuccess: invalidate });
}

export function useUpdateList() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: ListInput }) => updateList(id, input), onSuccess: invalidate });
}

export function useDuplicateList() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: (id: string) => duplicateList(id), onSuccess: invalidate });
}

export function useDeleteList() {
  const qc = useQueryClient();
  const invalidate = useInvalidateAudience();
  return useMutation({
    mutationFn: (id: string) => deleteList(id),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: audienceKeys.list(id) });
      return invalidate();
    },
  });
}

// ── Segments ─────────────────────────────────────────────────────────

export function useCreateSegment() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: (input: SegmentInput) => createSegment(input), onSuccess: invalidate });
}

export function useUpdateSegment() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: ({ id, input }: { id: string; input: SegmentInput }) => updateSegment(id, input), onSuccess: invalidate });
}

export function useDuplicateSegment() {
  const invalidate = useInvalidateAudience();
  return useMutation({ mutationFn: (id: string) => duplicateSegment(id), onSuccess: invalidate });
}

export function useDeleteSegment() {
  const qc = useQueryClient();
  const invalidate = useInvalidateAudience();
  return useMutation({
    mutationFn: (id: string) => deleteSegment(id),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: audienceKeys.segment(id) });
      return invalidate();
    },
  });
}
