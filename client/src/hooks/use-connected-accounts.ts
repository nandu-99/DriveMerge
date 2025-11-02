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
        // Expecting array of { email, usedSpace, totalSpace }
        if (!Array.isArray(data)) return [];
        return data.map((a: Record<string, unknown>) => ({
          id: String(a.email ?? ""),
          email: String(a.email ?? ""),
          used_space: Number(a.usedSpace ?? 0),
          total_space: Number(a.totalSpace ?? 0),
          provider: "google",
        }));
      } catch (err) {
        // On error (unauthenticated or server down), return empty list
        return [];
      }
    },
  });
}
