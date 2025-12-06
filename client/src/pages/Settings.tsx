import { Bell, Shield, Trash2, User, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { apiGet, apiFetch } from "@/lib/api";
import { UnderDevelopment } from "@/components/UnderDevelopment";

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
    <div className="max-w-4xl mx-auto space-y-8 py-6 px-1">
      <UnderDevelopment />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account and application preferences
        </p>
      </div>

      <div className="grid gap-8">
        {}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-2">
            <User className="h-4 w-4" />
            Account Information
          </h2>
          <div className="border border-border rounded-lg bg-card p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-8 items-start">
              <div className="flex-shrink-0 mx-auto sm:mx-0">
                <div className="h-24 w-24 rounded-full bg-muted border border-border flex items-center justify-center text-foreground text-3xl font-bold shadow-sm">
                  {(name || email || "").charAt(0).toUpperCase() || "U"}
                </div>
              </div>

              <div className="flex-1 w-full space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Display Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-background border border-border rounded-md py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-all"
                        placeholder="Your name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-background border border-border rounded-md py-2 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground transition-all"
                        placeholder="name@example.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Preferences
          </h2>
          <div className="border border-border rounded-lg bg-card p-6">
            <div className="space-y-4 divide-y divide-border">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Upload Notifications</p>
                  <p className="text-xs text-muted-foreground">Get notified when transfers complete</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-foreground rounded border-border bg-background" />
              </div>
              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Storage Warnings</p>
                  <p className="text-xs text-muted-foreground">Alert when storage is running low</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-foreground rounded border-border bg-background" />
              </div>
            </div>
          </div>
        </section>

        {}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-mono flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </h2>
            <div className="border border-border rounded-lg bg-card p-6 space-y-3">
              <button className="w-full px-4 py-2 text-left flex justify-between items-center group hover:bg-muted rounded-md transition-colors text-sm text-foreground">
                Change Password
                <span className="text-muted-foreground group-hover:translate-x-1 transition-transform">→</span>
              </button>
              <button className="w-full px-4 py-2 text-left flex justify-between items-center group hover:bg-muted rounded-md transition-colors text-sm text-foreground">
                Two-Factor Authentication
                <span className="text-muted-foreground group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-medium text-red-500 uppercase tracking-wider font-mono flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Danger Zone
            </h2>
            <div className="border border-red-500/20 rounded-lg bg-red-500/5 p-6">
              <p className="text-xs text-muted-foreground mb-4">
                Deleting your account is irreversible. This will remove all data
                associated with your DriveMerge account.
              </p>
              <button className="w-full px-4 py-2 rounded-md font-medium bg-background text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all duration-200 text-sm">
                Delete Account
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings;
