import { User, Bell, Shield, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "Settings saved!",
      description: "Your preferences have been updated successfully.",
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="glass-card p-6">
        <h1 className="text-2xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and application preferences
        </p>
      </div>

      {/* Account Settings */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <User className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Account Settings</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              defaultValue="user@example.com"
              className="w-full px-4 py-2 glass-card rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Display Name</label>
            <input
              type="text"
              defaultValue="John Doe"
              className="w-full px-4 py-2 glass-card rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Notifications</h2>
        </div>
        <div className="space-y-4">
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

      {/* Security */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Security</h2>
        </div>
        <div className="space-y-4">
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

      {/* Danger Zone */}
      <div className="glass-card p-6 border-destructive/50">
        <div className="flex items-center gap-3 mb-6">
          <Trash2 className="h-6 w-6 text-destructive" />
          <h2 className="text-xl font-semibold text-destructive">Danger Zone</h2>
        </div>
        <button className="w-full px-6 py-3 rounded-xl font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
          Delete Account
        </button>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <button className="btn-glass">Cancel</button>
        <button onClick={handleSave} className="btn-primary-glass">
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default Settings;
