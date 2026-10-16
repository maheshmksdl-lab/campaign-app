"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  archiveCampaigns,
  createCampaign,
  deleteCampaigns,
  duplicateCampaign,
  getAudiences,
  getCampaign,
  getDashboard,
  getPlanUsage,
  listCampaigns,
  pauseCampaign,
  restoreCampaigns,
  resumeCampaign,
  scheduleCampaign,
  searchCampaigns,
  updateCampaign,
} from "@/lib/api/campaigns";
import type { CampaignEdit, CampaignInput } from "@/lib/types/campaigns";

/**
 * Data hooks for every Campaigns screen. Data is withheld until hydration so
 * server HTML always matches the first client render (same rule as Inventory).
 */
export const campaignKeys = {
  all: ["campaigns"] as const,
  list: ["campaigns", "list"] as const,
  detail: (id: string) => ["campaigns", "detail", id] as const,
  dashboard: (days: number) => ["campaigns", "dashboard", days] as const,
  search: (term: string) => ["campaigns", "search", term] as const,
  audiences: ["audiences"] as const,
  plan: ["campaigns", "plan"] as const,
};

function gated<T extends { data: unknown }>(q: T, hydrated: boolean): T {
  return hydrated ? q : { ...q, data: undefined };
}

export function useCampaigns() {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: campaignKeys.list, queryFn: listCampaigns }), hydrated);
}

export function useCampaign(id: string) {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: campaignKeys.detail(id), queryFn: () => getCampaign(id), retry: false }), hydrated);
}

export function useDashboard(days: number) {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: campaignKeys.dashboard(days), queryFn: () => getDashboard(days), placeholderData: keepPreviousData }), hydrated);
}

export function useCampaignSearch(term: string) {
  return useQuery({ queryKey: campaignKeys.search(term), queryFn: () => searchCampaigns(term), enabled: term.trim().length > 0, placeholderData: keepPreviousData });
}

export function useAudiences() {
  return useQuery({ queryKey: campaignKeys.audiences, queryFn: getAudiences, staleTime: Infinity });
}

export function usePlanUsage() {
  const hydrated = useHydrated();
  return gated(useQuery({ queryKey: campaignKeys.plan, queryFn: getPlanUsage, staleTime: Infinity }), hydrated);
}

/** Lists and segments show which campaigns use them (audienceKeys.all in use-audience). */
const AUDIENCE_ROOT = ["audience"] as const;

/** Every campaign view reads the same store, so a change refreshes them all. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: campaignKeys.all }), qc.invalidateQueries({ queryKey: AUDIENCE_ROOT })]);
}

export function useCreateCampaign() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (input: CampaignInput) => createCampaign(input), onSuccess: invalidate });
}

export function useUpdateCampaign() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: ({ id, edit }: { id: string; edit: CampaignEdit }) => updateCampaign(id, edit), onSuccess: invalidate });
}

export function useDuplicateCampaign() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => duplicateCampaign(id), onSuccess: invalidate });
}

export function useScheduleCampaign() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: ({ id, at }: { id: string; at: string }) => scheduleCampaign(id, at), onSuccess: invalidate });
}

export function usePauseCampaign() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => pauseCampaign(id), onSuccess: invalidate });
}

export function useResumeCampaign() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => resumeCampaign(id), onSettled: invalidate });
}

export function useArchiveCampaigns() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (ids: string[]) => archiveCampaigns(ids), onSettled: invalidate });
}

export function useRestoreCampaigns() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (ids: string[]) => restoreCampaigns(ids), onSettled: invalidate });
}

export function useDeleteCampaigns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => deleteCampaigns(ids),
    // Deleted detail pages must not refetch (they'd show "not found" behind the redirect).
    onSuccess: (_r, ids) => {
      ids.forEach((id) => qc.removeQueries({ queryKey: campaignKeys.detail(id) }));
      return Promise.all([qc.invalidateQueries({ queryKey: campaignKeys.all }), qc.invalidateQueries({ queryKey: AUDIENCE_ROOT })]);
    },
  });
}
