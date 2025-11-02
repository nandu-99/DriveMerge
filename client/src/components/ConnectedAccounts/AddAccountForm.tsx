import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiGet } from "@/lib/api";

interface Props {
  onDone?: () => void;
}

export default function AddAccountForm({ onDone }: Props) {
  const [email, setEmail] = useState("");
  const [total, setTotal] = useState<number>(15);
  const { toast } = useToast();
  const handleConnect = async (e?: React.FormEvent) => {
    e?.preventDefault();
    try {
      const data = await apiGet("/drive/auth-url");
      const url = data?.url ?? data;
      if (!url) {
        toast({ title: "Error", description: "Failed to get auth URL" });
        return;
      }
      // redirect to Google OAuth flow handled by backend
      window.location.href = String(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({
        title: "Error",
        description: msg ?? "Failed to start auth flow",
      });
    }
  };

  return (
    <form onSubmit={handleConnect} className="space-y-3">
      <div>
        <p className="text-sm text-muted-foreground">
          Connect a Google Drive account — you'll be redirected to Google to
          authorize DriveMerge.
        </p>
      </div>
      <div>
        <button type="submit" className="btn-primary-glass w-full">
          Connect Google Drive
        </button>
      </div>
    </form>
  );
}
