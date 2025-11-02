import React from "react";
import { Wrench } from "lucide-react";

export function UnderDevelopment() {
  return (
    <div className="p-3 border border-blue-950">
    <div className="glass-card p-4 w-full max-w-5xl mx-auto border-2 border-blue-900 rounded-none">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex-shrink-0">
          <Wrench className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Under Development</p>
          <p className="text-xs text-muted-foreground">This feature will be available in the next phase</p>
        </div>
      </div>
    </div>
    </div>
  );
}
