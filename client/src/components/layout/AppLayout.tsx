import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="glass-card m-3 sm:m-4 mb-1 sm:mb-2 p-2.5 sm:p-3 flex items-center gap-2 sm:gap-3">
            <SidebarTrigger />
            <div className="flex items-center gap-2 sm:gap-3">
              {/* <img
                src="/DriveMergeLogo.png"
                alt="DriveMerge"
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded-md p-1 bg-white/5"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              /> */}
              <h2 className="text-base sm:text-lg font-semibold truncate">
                DriveMerge - Unified Cloud Storage
              </h2>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 pt-1 sm:pt-2">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
