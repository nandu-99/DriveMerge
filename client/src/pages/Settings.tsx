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
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      <UnderDevelopment />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and application preferences
        </p>
      </div>

      <div className="grid gap-8">
        {/* Account Card */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Account Information
          </h2>
          <div className="glass-card p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row gap-8 items-start">
              <div className="flex-shrink-0 mx-auto sm:mx-0">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground text-3xl font-bold shadow-lg">
                  {(name || email || "").charAt(0).toUpperCase() || "U"}
                </div>
              </div>

              <div className="flex-1 w-full space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Display Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-style pl-11"
                        placeholder="Your name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-style pl-11"
                        placeholder="name@example.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="btn-primary-glass min-w-[120px]"
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Preferences */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Preferences
          </h2>
          <div className="glass-card p-6">
            <div className="space-y-4 divide-y divide-border/50">
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="font-medium">Upload Notifications</p>
                  <p className="text-sm text-muted-foreground">Get notified when transfers complete</p>
                </div>
                <input type="checkbox" defaultChecked className="h-5 w-5 accent-primary rounded border-input" />
              </div>
              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium">Storage Warnings</p>
                  <p className="text-sm text-muted-foreground">Alert when storage is running low</p>
                </div>
                <input type="checkbox" defaultChecked className="h-5 w-5 accent-primary rounded border-input" />
              </div>
            </div>
          </div>
        </section>

        {/* Security & Danger */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Security
            </h2>
            <div className="glass-card p-6 space-y-3">
              <button className="w-full btn-glass text-left flex justify-between items-center group">
                Change Password
                <span className="text-muted-foreground group-hover:translate-x-1 transition-transform">→</span>
              </button>
              <button className="w-full btn-glass text-left flex justify-between items-center group">
                Two-Factor Authentication
                <span className="text-muted-foreground group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Danger Zone
            </h2>
            <div className="glass-card p-6 border-destructive/20 bg-destructive/5">
              <p className="text-sm text-muted-foreground mb-4">
                Deleting your account is irreversible. This will remove all data
                associated with your DriveMerge account.
              </p>
              <button className="w-full px-4 py-2.5 rounded-xl font-medium bg-white text-destructive hover:bg-destructive hover:text-white border border-destructive/20 transition-all duration-200 shadow-sm">
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
