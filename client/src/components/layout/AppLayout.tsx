import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="sticky top-0 z-10 m-3 sm:m-4 mb-0 rounded-xl glass-card px-4 py-3 flex items-center gap-4 transition-all duration-200">
            <SidebarTrigger />
            <div className="h-6 w-px bg-border/50" />
            <div className="flex items-center gap-3">
              {/* <img
                src="/DriveMergeLogo.png"
                alt="DriveMerge"
                className="h-8 w-8 object-contain"
              /> */}
              <h2 className="text-base font-semibold tracking-tight">
                DriveMerge
              </h2>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 overflow-y-auto scroll-smooth">
            <div className="max-w-7xl mx-auto w-full h-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
