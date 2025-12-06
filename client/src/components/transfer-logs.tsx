import { motion } from "framer-motion";
import { CheckCircle2, Circle, Clock, Loader2, Terminal, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface TransferLogsProps {
    logs: string[];
    className?: string;
    running?: boolean;
}

export function TransferLogs({ logs, className, running = true }: TransferLogsProps) {
    // We'll treat the logs as a sequence of steps.
    // The last log is usually the "current" or "active" one if running,
    // unless it says "completed".

    const parsedLogs = useMemo(() => {
        return logs.map((log, index) => {
            const isLast = index === logs.length - 1;
            const isCompleted = log.toLowerCase().includes("completed") || log.toLowerCase().includes("success");
            const isError = log.toLowerCase().includes("failed") || log.toLowerCase().includes("error");
            const isPending = !isLast && !isCompleted && !isError; // Previous steps are assumed done

            // In this specific "re-calculated" log system from Transfers.tsx, 
            // the list grows/changes. But actually it looks like it returns a fixed set of *current status messages* rather than a history.
            // Wait, Transfers.tsx returns an array like [msg1, msg2, msg3].
            // If it returns [msg1, msg2], it means we are at step 2?
            // Actually looking at Transfers.tsx:
            // return [ "Starting...", "Splitting...", "Allocating...", "Uploading...", "Progress..." ]
            // It returns ALL of them up to the current state? 
            // No, looking at the code:
            // return [ `Starting...`, `Splitting...`, `Allocating...`, `Uploading...`, `Progress...` ]
            // It returns a FIXED array of 5 items every time roughly?
            // Let's re-read Transfers.tsx logic carefully.

            /*
            return [
              `Starting file upload...`,
              `Splitting file into ${chunks} chunks...`,
              `Allocating chunks...`,
              `Uploading chunk...`,
              prog >= 100 ? `Upload completed...` : `Progress: ${prog}%`,
            ];
            */

            // It always returns these 5 lines! It creates them new every render.
            // So they are basically "steps" of the process.
            // We should render them as a list of steps.

            let status: "pending" | "loading" | "success" | "error" = "success";

            // Customize status based on index and progress
            // Since `Transfers.tsx` always returns all 5, we need to guess the active one.
            // Actually, line 4 (index 3) is "Uploading chunk X/Y".
            // Line 5 (index 4) is "Progress" or "Completed".

            // If "Progress" is < 100, then "Uploading" is active.
            // If "Progress" is 100, then "Uploading" is done.

            // Let's simplify:
            // If the log text contains "Progress:", it's the active status line.
            // If it says "Uploading chunk", it's also active/ongoing.
            // But purely based on text is brittle.

            // However, for the visual effect:
            if (isError) status = "error";
            else if (isCompleted) status = "success";
            else if (log.includes("Progress:")) status = "loading";
            else if (log.includes("Uploading chunk")) status = "loading";
            else status = "success"; // Assume previous steps are done

            return {
                id: index,
                message: log,
                status,
                timestamp: new Date().toLocaleTimeString(), // Mock timestamp as we don't have real ones
            };
        });
    }, [logs]);

    return (
        <div className={cn("flex flex-col h-full overflow-hidden rounded-xl border bg-black/40 backdrop-blur-xl", className)}>
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Build Logs</span>
                <div className="ml-auto flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-muted-foreground">Live</span>
                </div>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {parsedLogs.map((log, i) => (
                        <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="group flex gap-3 text-sm font-mono"
                        >
                            <div className="mt-0.5 shrink-0">
                                {log.status === "loading" ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                ) : log.status === "success" ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : log.status === "error" ? (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground" />
                                )}
                            </div>

                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "truncate",
                                        log.status === "loading" && "text-blue-400",
                                        log.status === "success" && "text-foreground",
                                        log.status === "error" && "text-red-400"
                                    )}>
                                        {log.message}
                                    </span>
                                </div>
                            </div>

                            <div className="shrink-0 text-xs text-muted-foreground/50 tabular-nums select-none">
                                {/* We don't have real timestamps, so maybe omit or show a relative time if we tracked it */}
                                00:0{i}s
                            </div>
                        </motion.div>
                    ))}

                    {running && parsedLogs.length > 0 && !parsedLogs[parsedLogs.length - 1].message.includes("completed") && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex gap-3 text-sm font-mono opacity-50 pl-7"
                        >
                            <span className="animate-pulse">...</span>
                        </motion.div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
