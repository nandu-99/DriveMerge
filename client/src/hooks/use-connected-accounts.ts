import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Supabase was removed from the client. For local/dev usage we keep connected accounts
// stored in localStorage keyed by a simple local user id. If you have an external auth
// provider, replace `getCurrentUserId` to return the authenticated user's id.

const STORAGE_KEY_PREFIX = "cf_connected_accounts_";

async function getCurrentUserId(): Promise<string | null> {
  // Developers can set a persistent id for local testing, e.g.:
  // localStorage.setItem('dm_user_id', 'my-local-user')
  return localStorage.getItem("dm_user_id") ?? "local-dev-user";
}

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
      const userId = await getCurrentUserId();
      if (!userId) return [];
      const raw = localStorage.getItem(STORAGE_KEY_PREFIX + userId);
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
      const userId = await getCurrentUserId();
      if (!userId) throw new Error("Not authenticated");

      const key = STORAGE_KEY_PREFIX + userId;
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
