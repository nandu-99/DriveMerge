import { Bell, Shield, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { apiGet, apiFetch } from "@/lib/api";

const Settings = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const profile = await apiGet("/auth/me");
        if (!mounted) return;
        setEmail(profile?.email ?? "");
        setName(profile?.name ?? "");
      } catch (err) {
        // ignore if unauthenticated
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      await apiFetch("/auth/me", { method: "PATCH", json: { name, email } });
      toast({
        title: "Settings saved!",
        description: "Your profile was updated.",
      });
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as Record<string, unknown>).message)
          : "Failed to save";
      toast({ title: "Save failed", description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Manage your account and application preferences
          </p>
        </div>

        {/* Account Card */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0">
              <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
                {(name || email || "").charAt(0) || "U"}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-semibold">Account</h2>
                <div className="text-sm text-muted-foreground">
                  Member since —
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Display name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-style"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-style"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Preferences</h3>
            </div>
            <div className="text-sm text-muted-foreground">
              Notifications & alerts
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span>Upload completion notifications</span>
              <input type="checkbox" defaultChecked className="w-5 h-5" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Storage warnings</span>
              <input type="checkbox" defaultChecked className="w-5 h-5" />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span>Account connection alerts</span>
              <input type="checkbox" className="w-5 h-5" />
            </label>
          </div>
        </div>

        {/* Security & Danger */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Security</h3>
            </div>
            <div className="space-y-3">
              <button className="w-full btn-glass text-left">
                Change Password
              </button>
              <button className="w-full btn-glass text-left">
                Two-Factor Authentication
              </button>
              <button className="w-full btn-glass text-left">
                Manage Connected Accounts
              </button>
            </div>
          </div>

          <div className="glass-card p-6 border-destructive/50">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="h-5 w-5 text-destructive" />
              <h3 className="text-lg font-medium text-destructive">
                Danger Zone
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Deleting your account is irreversible. This will remove all data
              associated with your DriveMerge account.
            </p>
            <button className="w-full px-6 py-3 rounded-xl font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
              Delete Account
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4">
          <button className="btn-glass">Cancel</button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-primary-glass"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
