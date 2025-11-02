import { Home, Settings, Eye, Plus, HardDrive } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import AddAccountForm from "@/components/ConnectedAccounts/AddAccountForm";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useState } from "react";

const menuItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Files", url: "/files", icon: HardDrive },
  { title: "Transfers", url: "/transfers", icon: Eye },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { data: accounts = [], isLoading } = useConnectedAccounts();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <Sidebar className="border-r-0">
      <SidebarContent className="glass-card m-2 p-4">
        {/* Logo/Title */}
        <div className="mb-6 px-2">
          <div
            className={`flex items-center gap-3 transition-all ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <img
              src="/DriveMergeLogo.png"
              alt="DriveMerge"
              className={
                collapsed
                  ? "object-contain h-7 w-7 mx-auto rounded-md p-0.5 bg-white/5"
                  : "object-contain h-14 w-14 rounded-md p-1 bg-white/5"
              }
              style={{ display: "block" }}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = "none";
              }}
            />{" "}
            <span className="sr-only">DriveMerge</span>
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                          isActive
                            ? "bg-gradient-to-r from-primary/20 to-accent/20 text-primary font-medium"
                            : "hover:bg-white/40"
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Connected Accounts */}
        {!collapsed && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>Connected Accounts</span>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="text-primary hover:text-accent transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="space-y-3 mt-2">
                {showAdd && (
                  <div className="glass-card p-3">
                    <AddAccountForm onDone={() => setShowAdd(false)} />
                  </div>
                )}

                {isLoading && (
                  <div className="text-sm text-muted-foreground">
                    Loading accounts...
                  </div>
                )}

                {accounts.length === 0 && !isLoading && (
                  <div className="text-sm text-muted-foreground">
                    No connected accounts yet
                  </div>
                )}

                {accounts.map((account) => {
                  const acct = account as {
                    id: string;
                    email: string;
                    used_space?: number;
                    total_space?: number;
                  };
                  const used = Number(acct.used_space ?? 0);
                  const total = Number(acct.total_space ?? 15);
                  const percentage = Math.max(
                    0,
                    Math.min(100, Math.round((used / total) * 100))
                  );
                  return (
                    <div
                      key={acct.id}
                      className="glass-card p-3 space-y-2 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <HardDrive className="h-5 w-5 text-primary" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {acct.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {used} GB / {total} GB
                          </div>
                        </div>
                      </div>
                      <div className="w-24 text-right">
                        <div className="text-sm font-semibold">
                          {percentage}%
                        </div>
                        <div className="h-2 bg-white/40 rounded-full overflow-hidden mt-1">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
