import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";

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
      try {
        const data = await apiGet("/drive/accounts");

        if (!Array.isArray(data)) return [];
        return data.map((a: Record<string, unknown>) => ({
          id: String(a.id ?? ""),
          email: String(a.email ?? ""),
          // Backend returns GB, we convert to bytes for the UI formatter
          used_space: Number(a.usedSpace ?? 0) * 1024 * 1024 * 1024,
          total_space: Number(a.totalSpace ?? 0) * 1024 * 1024 * 1024,
          provider: "google",
        })).filter(a => a.id !== "");
      } catch (err) {

        return [];
      }
    },
  });
}
