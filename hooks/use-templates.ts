"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHydrated } from "@/hooks/use-hydrated";
import { createTemplate, deleteTemplate, duplicateTemplate, getTemplate, listTemplates, updateTemplate } from "@/lib/api/templates";
import type { TemplateEdit, TemplateInput, TemplateQuery } from "@/lib/types/templates";
import { campaignKeys } from "./use-campaigns";

/** Data hooks for Email Templates (same hydration rule as the other hooks). */
export const templateKeys = {
  all: ["templates"] as const,
  list: (q: TemplateQuery) => ["templates", "list", q] as const,
  detail: (id: string) => ["templates", "detail", id] as const,
};

function gated<T extends { data: unknown }>(q: T, hydrated: boolean): T {
  return hydrated ? q : { ...q, data: undefined };
}

export function useTemplates(q: TemplateQuery = {}) {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: templateKeys.list(q), queryFn: () => listTemplates(q), placeholderData: keepPreviousData }), hydrated);
}

export function useTemplate(id: string) {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: templateKeys.detail(id), queryFn: () => getTemplate(id), retry: false }), hydrated);
}

/** Template changes show in the library and in the dashboard's activity feed. */
function useInvalidateTemplates() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: templateKeys.all }), qc.invalidateQueries({ queryKey: campaignKeys.all })]);
}

export function useCreateTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({ mutationFn: (input: TemplateInput) => createTemplate(input), onSuccess: invalidate });
}

export function useUpdateTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({ mutationFn: ({ id, edit }: { id: string; edit: TemplateEdit }) => updateTemplate(id, edit), onSuccess: invalidate });
}

export function useDuplicateTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({ mutationFn: ({ id, name }: { id: string; name?: string }) => duplicateTemplate(id, name), onSuccess: invalidate });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: templateKeys.detail(id) });
      return invalidate();
    },
  });
}
