import { useState } from "react";
import { useAddConnectedAccount } from "@/hooks/use-connected-accounts";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onDone?: () => void;
}

export default function AddAccountForm({ onDone }: Props) {
  const [email, setEmail] = useState("");
  const [total, setTotal] = useState<number>(15);
  const { toast } = useToast();
  const mutation = useAddConnectedAccount();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutation.mutateAsync({ email, total_space: total });
      toast({
        title: "Account added",
        description: `${email} connected (mock)`,
      });
      setEmail("");
      setTotal(15);
      onDone?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Error", description: msg ?? "Failed to add account" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Account Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 glass-card rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">
          Total Space (GB)
        </label>
        <input
          type="number"
          value={total}
          onChange={(e) => setTotal(Number(e.target.value))}
          min={1}
          className="w-full px-3 py-2 glass-card rounded-lg"
        />
      </div>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary-glass">
          Add Account
        </button>
      </div>
    </form>
  );
}
