import { motion, AnimatePresence } from "framer-motion";
import { Package, Play, Pause, Cloud, Cpu, Wifi } from "lucide-react";
import { useMemo, useState } from "react";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useUploads } from "@/context/uploads";
import { cn, formatBytes } from "@/lib/utils";



const Transfers = () => {
  const { data: accounts = [] } = useConnectedAccounts();
  const { uploads } = useUploads();

  const [running, setRunning] = useState(true);

  const activeUpload = uploads.find((u) => u.status === "uploading");
  const recentUpload = activeUpload || uploads[0] || null;
  const isUploading = recentUpload?.status === "uploading";

  const totalChunks = useMemo(() => {
    if (!recentUpload) return 10;
    return Math.min(
      20,
      Math.max(5, Math.ceil(recentUpload.size / (5 * 1024 * 1024)))
    );
  }, [recentUpload]);

  const logs = useMemo(() => {
    if (!recentUpload) {
      return [
        {
          time: new Date().toLocaleTimeString(),
          text: "System ready.",
          type: "info",
        },
        {
          time: new Date().toLocaleTimeString(),
          text: "Waiting for file upload...",
          type: "info",
        },
      ];
    }

    // Use server-provided logs if available (Accurate Mode)
    if (recentUpload.logs && recentUpload.logs.length > 0) {
      // Show last 6 logs and map generic type to specific union
      return recentUpload.logs.slice(-6).map(l => ({
        time: l.time,
        text: l.text,
        type: l.type as "info" | "start" | "process" | "success" | "error"
      }));
    }

    // Fallback: Just show "Initializing" if started but no logs yet
    const startTime = new Date(recentUpload.startedAt).toLocaleTimeString();
    return [{
      time: startTime,
      text: `Initializing upload: ${recentUpload.name} (${formatBytes(recentUpload.size)})`,
      type: "start"
    }];
  }, [recentUpload]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Transfers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time data distribution visualization
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRunning((s) => !s)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all duration-200 text-sm",
              running
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-500 hover:bg-amber-500/20 border border-amber-500/20"
                : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
            )}
          >
            {running ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>{running ? "Pause Visuals" : "Resume"}</span>
          </button>
        </div>
      </div>

      <div className="border border-border rounded-lg bg-card p-8 min-h-[500px] relative overflow-hidden group flex flex-col">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-[0.12] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center flex-1">
          <div className="lg:col-span-3">
            <div className="relative p-6 rounded-2xl border border-border bg-gradient-to-b from-background to-muted/40 shadow-sm overflow-hidden">
              <div
                className="
                  absolute inset-px rounded-[1.6rem]
                  bg-[linear-gradient(to_right,rgba(15,23,42,0.06)_1px,transparent_1px),
                      linear-gradient(to_bottom,rgba(15,23,42,0.06)_1px,transparent_1px)]
                  dark:bg-[linear-gradient(to_right,rgba(148,163,184,0.18)_1px,transparent_1px),
                           linear-gradient(to_bottom,rgba(148,163,184,0.18)_1px,transparent_1px)]
                  bg-[size:22px_22px]
                  opacity-70
                  pointer-events-none
                "
              />

              <div className="relative z-10 flex flex-col items-center gap-4 py-8">
                <div className="relative">
                  <div
                    className={cn(
                      "h-20 w-20 rounded-2xl border flex items-center justify-center bg-background/80 backdrop-blur-sm shadow-sm transition-all",
                      isUploading
                        ? "border-primary/60 shadow-primary/20"
                        : "border-border/70"
                    )}
                  >
                    <Package
                      className={cn(
                        "h-10 w-10 transition-colors",
                        isUploading
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    />
                  </div>

                  {isUploading && (
                    <motion.div
                      className="absolute inset-0 -z-10 rounded-3xl bg-primary/30 blur-xl"
                      animate={{
                        opacity: [0.35, 0.7, 0.35],
                        scale: [1, 1.12, 1],
                      }}
                      transition={{
                        duration: 2.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  )}
                </div>

                <div className="text-center space-y-1">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                    Source file
                  </p>
                  <p className="font-semibold text-lg text-foreground truncate max-w-[14rem]">
                    {recentUpload?.name || "Idle"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {recentUpload
                      ? formatBytes(recentUpload.size)
                      : "Waiting for file..."}
                  </p>
                </div>

                <div className="mt-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/80 border border-border text-[11px] text-muted-foreground">
                    {isUploading ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        <span>
                          Streaming chunks •{" "}
                          {Math.round(recentUpload?.progress ?? 0)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                        <span>Ready for next transfer</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative h-full min-h-[200px] flex flex-col items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg className="w-full h-20 overflow-visible">
                <defs>
                  <linearGradient
                    id="lineGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop
                      offset="0%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity="0.05"
                    />
                    <stop
                      offset="50%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity="0.45"
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity="0.05"
                    />
                  </linearGradient>
                </defs>
                <path
                  d="M0,40 C150,40 150,40 300,40 S450,40 600,40"
                  fill="none"
                  stroke="url(#lineGradient)"
                  strokeWidth="2"
                />
              </svg>
            </div>

            <div className="relative w-full h-24 flex items-center overflow-hidden">
              <AnimatePresence>
                {running &&
                  isUploading &&
                  [...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute left-0 flex items-center gap-2"
                      initial={{ x: -50, opacity: 0, scale: 0.5 }}
                      animate={{
                        x: "120%",
                        opacity: [0, 1, 1, 0],
                        scale: [0.5, 1, 1, 0.5],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        delay: i * 0.45,
                        ease: "easeInOut",
                      }}
                    >
                      <div className="h-8 w-12 rounded-lg bg-primary/14 border border-primary/40 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-primary/10">
                        <div className="w-6 h-0.5 bg-primary/50 rounded-full" />
                      </div>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>

            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/80 border border-border backdrop-blur-md text-xs font-medium text-muted-foreground">
                {isUploading ? (
                  <>
                    <Wifi className="h-3 w-3 animate-pulse text-primary" />
                    <span className="text-primary">
                      Syncing data across drives...
                    </span>
                  </>
                ) : (
                  <>
                    <Cpu className="h-3 w-3" />
                    <span>System Idle</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-4 h-full justify-center">
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {accounts.map((account, index) => (
                <motion.div
                  key={account.id}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.08 }}
                  className="border border-border bg-background/90 backdrop-blur-sm p-4 rounded-lg hover:border-primary/35 hover:bg-background transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-md bg-muted text-muted-foreground">
                      <Cloud className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-medium text-sm truncate text-foreground"
                        title={account.email}
                      >
                        {account.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {account.provider.toUpperCase()}
                      </p>
                    </div>
                    {isUploading && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-2 w-2 rounded-full bg-emerald-500"
                      />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Storage</span>
                      <span className="font-mono">
                        {account.used_space !== undefined && account.total_space
                          ? `${formatBytes(account.used_space)} / ${formatBytes(account.total_space)}`
                          : "0 B / 0 B"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(
                            100,
                            account.total_space
                              ? (account.used_space /
                                Math.max(1, account.total_space)) *
                              100
                              : 0
                          )}%`,
                        }}
                        transition={{ duration: 1.3, ease: "easeOut" }}
                        className="h-full bg-primary"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}

              {accounts.length === 0 && (
                <div className="text-center p-6 border-2 border-dashed border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    No accounts connected
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg overflow-hidden border border-border bg-card shadow-sm flex flex-col h-[400px]">
        <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </div>
            <span className="text-xs font-medium text-blue-500 uppercase tracking-wider">
              Live Mode
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            <span>--:--:--</span>
            <div className="h-3 w-[1px] bg-border" />
            <span>Filter</span>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-border bg-muted/50 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          <div className="col-span-2">Time</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-3">Path</div>
          <div className="col-span-6">Message</div>
        </div>

        <div className="flex-1 p-2 font-mono text-xs overflow-y-auto custom-scrollbar bg-card">
          <AnimatePresence mode="popLayout">
            {logs.map((log, i) => (
              <motion.div
                key={`${i}-${log.text}`}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="grid grid-cols-12 gap-4 px-2 py-1.5 hover:bg-muted/50 rounded transition-colors group"
              >
                <div className="col-span-2 text-muted-foreground truncate">
                  {log.time}
                </div>

                <div className="col-span-1">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold",
                      log.type === "error"
                        ? "bg-red-500/10 text-red-500"
                        : log.type === "success"
                          ? "bg-green-500/10 text-green-500"
                          : log.type === "start"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-muted text-muted-foreground"
                    )}
                  >
                    {log.type === "error"
                      ? "500"
                      : log.type === "success"
                        ? "200"
                        : log.type === "start"
                          ? "INIT"
                          : "202"}
                  </span>
                </div>

                <div className="col-span-3 text-muted-foreground/80 truncate font-medium">
                  {log.type === "start"
                    ? "/upload/init"
                    : log.type === "success"
                      ? "/upload/complete"
                      : log.type === "error"
                        ? "/upload/fail"
                        : "/upload/chunk"}
                </div>

                <div
                  className={cn(
                    "col-span-6 truncate",
                    log.type === "error"
                      ? "text-red-500"
                      : log.type === "success"
                        ? "text-green-500"
                        : "text-foreground"
                  )}
                >
                  {log.text}
                </div>
              </motion.div>
            ))}

            {isUploading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-12 gap-4 px-2 py-1.5"
              >
                <div className="col-span-2 text-muted-foreground animate-pulse">
                  ...
                </div>
                <div className="col-span-10 flex items-center gap-2">
                  <span className="h-2 w-1 bg-blue-500 animate-pulse" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Transfers;
