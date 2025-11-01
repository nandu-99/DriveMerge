import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Temporary implementation using localStorage to avoid requiring DB migrations / server updates.
// This provides a working Connected Accounts UX for development. Later this should be backed by
// Supabase table queries (server-side) or using proper typed supabase.from(...) calls.

const STORAGE_KEY_PREFIX = "cf_connected_accounts_";

export function useConnectedAccounts() {
  return useQuery<
    Array<{
      id: string;
      email: string;
      used_space: number;
      total_space: number;
      provider?: string;
      created_at?: string;
    }>
  >({
    queryKey: ["connected_accounts"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user as { id: string } | null;
      if (!user) return [];
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + user.id);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    },
  });
}

export function useAddConnectedAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      email: string;
      total_space?: number;
      provider?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user as { id: string } | null;
      if (!user) throw new Error("Not authenticated");

      const key = STORAGE_KEY_PREFIX + user.id;
      const raw = localStorage.getItem(key);
      const existing = raw ? (JSON.parse(raw) as unknown[]) : [];
      const newEntry = {
        id: crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2),
        email: payload.email,
        used_space: 0,
        total_space: payload.total_space ?? 15,
        provider: payload.provider ?? "mock",
        created_at: new Date().toISOString(),
      };
      existing.unshift(newEntry);
      localStorage.setItem(key, JSON.stringify(existing));
      return newEntry;
    },
    onSuccess() {
      qc.invalidateQueries({ queryKey: ["connected_accounts"] });
    },
  });
}
