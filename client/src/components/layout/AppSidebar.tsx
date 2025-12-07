import { Home, Settings, Eye, Plus, HardDrive, LogOut, History, Trash2 } from "lucide-react";
import { formatBytes } from "@/lib/utils";
import { NavLink, useNavigate } from "react-router-dom";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const menuItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Files", url: "/files", icon: HardDrive },
  { title: "History", url: "/history", icon: History },
  { title: "Transfers", url: "/transfers", icon: Eye },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const { data: accounts = [], isLoading } = useConnectedAccounts();
  const [showAdd, setShowAdd] = useState(false);

  const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "";


  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; account?: { id: string; email: string } }>({
    open: false,
  });

  const handleLogout = () => {
    localStorage.removeItem("dm_token");
    localStorage.removeItem("dm_user_id");
    localStorage.removeItem("dm_user_name");
    navigate("/login");
  };

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar-background">
      <SidebarContent className="bg-sidebar-background p-4">

        <div className="px-2 mb-6">
          <div
          >
            <img
              src="/DriveMergeLogo.png"
              alt="DriveMerge"
              className={
                collapsed
                  ? "object-contain h-8 mx-auto"
                  : "object-contain h-12 mx-auto"
              }
              style={{ display: "block" }}
              onError={(e) => {
                const el = e.currentTarget as HTMLImageElement;
                el.style.display = "none";
              }}
            />{" "}

          </div>
        </div>


        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavLink
                    to={item.url}
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-md transition-all text-sm ${isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                        : "text-gray-700 dark:text-gray-200 hover:text-foreground hover:bg-sidebar-accent"
                      }`
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


        {!collapsed && (
          <SidebarGroup className="mt-8">
            <SidebarGroupLabel className="flex items-center justify-between text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
              <span>Connected Accounts</span>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="space-y-3 mt-2">
                {showAdd && (
                  <div className="border border-sidebar-border rounded-lg p-3 bg-sidebar-accent/50">
                    <AddAccountForm onDone={() => setShowAdd(false)} />
                  </div>
                )}

                {isLoading && (
                  <div className="text-xs font-mono text-muted-foreground">
                    Loading accounts...
                  </div>
                )}

                {accounts.length === 0 && !isLoading && (
                  <div className="text-xs font-mono text-muted-foreground">
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
                  const openDeleteDialog = () => {
                    setDeleteDialog({ open: true, account: { id: acct.id, email: acct.email } });
                  };
                  return (
                    <div
                      key={acct.id}
                      className="group/item border border-transparent hover:border-sidebar-border rounded-md p-2 space-y-1.5 hover:bg-sidebar-accent/50 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-md bg-sidebar-accent text-sidebar-foreground/70 group-hover/item:text-sidebar-foreground group-hover/item:bg-background shadow-none group-hover/item:shadow-sm transition-all">
                          <HardDrive className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-foreground/90 truncate font-mono tracking-tight group-hover/item:text-foreground">
                            {acct.email}
                          </div>
                          <div className="text-[10px] text-muted-foreground/80 font-mono mt-0.5 group-hover/item:text-muted-foreground">
                            {formatBytes(used)} of {formatBytes(total)} used
                          </div>
                          
                        </div>
                        <button
                            onClick={openDeleteDialog}
                            className="transition-opacity text-destructive hover:bg-destructive/10 rounded p-1"
                            title="Remove account"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                      </div>
                      <div className="w-full px-0.5">
                        <div className="h-1 bg-sidebar-border/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-sidebar-primary/80 group-hover/item:bg-sidebar-primary rounded-full transition-all"
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

        <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove account?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove <span className="font-medium">{deleteDialog.account?.email}</span>?
                <br />
                This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!deleteDialog.account) return;

                  try {
                    await fetch(`${API_BASE}/drive/disconnect`, {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${localStorage.getItem("dm_token")}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ email: deleteDialog.account?.email }),
                    });
                    window.location.reload();
                  } catch (err) {
                    alert("Failed to delete account");
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2 rounded-md transition-all text-muted-foreground hover:text-foreground hover:bg-sidebar-accent w-full text-sm"
                  >
                    <LogOut className="h-4 w-4" />
                    {!collapsed && <span>Logout</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
