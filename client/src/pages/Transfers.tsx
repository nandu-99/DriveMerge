import { motion, AnimatePresence } from "framer-motion";
import {
  HardDrive,
  Package,
  Play,
  Pause,
  List,
  ArrowRight,
  CheckCircle2,
  Cloud,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useUploads } from "@/context/uploads";
import { UnderDevelopment } from "@/components/UnderDevelopment";
import { cn } from "@/lib/utils";

type TransferJob = {
  uploadId: string;
  fileName: string;
  status: string;
  totalBytes: number | null;
  transferredBytes: number | null;
  driveFileId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

const Transfers = () => {
  const { data: accounts = [] } = useConnectedAccounts();
  const { uploads } = useUploads();

  const [running, setRunning] = useState(true);
  const [jobs, setJobs] = useState<TransferJob[]>([]);

  const recentUpload = uploads?.[0] ?? null;

  const formatBytes = (bytes: number, decimals = 2): string => {
    if (!bytes) return "0 B";
    const k = 1024;
    const dm = Math.max(0, decimals);
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const chunks = useMemo(() => {
    if (!recentUpload) return 0;
    // approximate chunks: 10 MB per chunk
    return Math.max(1, Math.round(recentUpload.size / (10 * 1024 * 1024)));
  }, [recentUpload]);

  const logs = useMemo(() => {
    if (!recentUpload) {
      if (jobs.length === 0) {
        return ["No active uploads — drop a file on Home to start a transfer."];
      }
      return ["No active uploads."];
    }

    const prog = Math.round(recentUpload.progress);
    const completedChunks = Math.round((prog / 100) * chunks);
    return [
      `Starting file upload: ${recentUpload.name} (${formatBytes(
        recentUpload.size
      )})`,
      `Splitting file into ${chunks} chunks...`,
      `Allocating chunks to ${accounts.length} connected accounts...`,
      `Uploading chunk ${Math.max(0, completedChunks)}/${chunks} to ${accounts[0]?.email ?? "(pending)"
      }`,
      prog >= 100
        ? `Upload completed: ${recentUpload.name} (${prog}%)`
        : `Progress: ${prog}%`,
    ];
  }, [recentUpload, chunks, accounts, jobs.length]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem("dm_token");
        const res = await fetch(`/drive/transfers`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const data = await res.json();
        setJobs(data.jobs || []);
      } catch (e) {
        console.debug("fetch transfers failed", e);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <UnderDevelopment />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transfers</h1>
          <p className="text-muted-foreground mt-1">
            Real-time visualization of your data distribution
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRunning((s) => !s)}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200",
              running
                ? "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20"
                : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
            )}
          >
            {running ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>{running ? "Pause Visualization" : "Resume"}</span>
          </button>
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="glass-card p-8 min-h-[500px] relative overflow-hidden group">
        {/* Background Grid Effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center h-full">

          {/* Source: The File */}
          <div className="lg:col-span-3 flex flex-col items-center justify-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative"
            >
              <div className={cn(
                "w-48 h-48 rounded-2xl glass-card flex flex-col items-center justify-center p-6 border-2 transition-colors duration-300",
                recentUpload ? "border-primary/50 bg-primary/5" : "border-dashed border-muted"
              )}>
                <div className="relative">
                  <Package className={cn(
                    "h-16 w-16 mb-4 transition-colors duration-300",
                    recentUpload ? "text-primary" : "text-muted"
                  )} />
                  {recentUpload && (
                    <motion.div
                      className="absolute -inset-4 rounded-full bg-primary/20 blur-xl"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>

                <div className="text-center w-full">
                  <p className="font-semibold truncate w-full px-2">
                    {recentUpload ? recentUpload.name : "No Active Upload"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {recentUpload
                      ? `${formatBytes(recentUpload.size)} • ${chunks} chunks`
                      : "Waiting for file..."}
                  </p>
                </div>

                {recentUpload && (
                  <div className="w-full mt-4 space-y-1">
                    <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                      <span>Progress</span>
                      <span>{Math.round(recentUpload.progress)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted/30 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${recentUpload.progress}%` }}
                        transition={{ type: "spring", stiffness: 50 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Middle: The Pipeline */}
          <div className="lg:col-span-6 relative h-full min-h-[200px] flex flex-col items-center justify-center">
            {/* Connection Lines */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg className="w-full h-20 overflow-visible">
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                    <stop offset="50%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <path
                  d="M0,40 C150,40 150,40 300,40 S450,40 600,40"
                  fill="none"
                  stroke="url(#lineGradient)"
                  strokeWidth="2"
                  className="w-full"
                />
              </svg>
            </div>

            {/* Flying Chunks Animation */}
            <div className="relative w-full h-24 flex items-center overflow-hidden">
              <AnimatePresence>
                {running && (recentUpload || jobs.length > 0) && [...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute left-0 flex items-center gap-2"
                    initial={{ x: -50, opacity: 0, scale: 0.5 }}
                    animate={{
                      x: "120%",
                      opacity: [0, 1, 1, 0],
                      scale: [0.5, 1, 1, 0.5]
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      delay: i * 0.5,
                      ease: "easeInOut"
                    }}
                  >
                    <div className="h-8 w-12 rounded bg-primary/20 border border-primary/40 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-primary/10">
                      <div className="w-6 h-0.5 bg-primary/40 rounded-full" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="mt-8 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/50 border border-border/50 backdrop-blur-md text-xs font-medium text-muted-foreground">
                {recentUpload ? (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                    Processing Chunks
                  </>
                ) : (
                  "System Idle"
                )}
              </div>
            </div>
          </div>

          {/* Destination: Accounts */}
          <div className="lg:col-span-3 flex flex-col gap-4 h-full justify-center">
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {accounts.map((account, index) => (
                <motion.div
                  key={account.id}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card p-4 rounded-xl group/card hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-secondary text-secondary-foreground">
                      <Cloud className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate" title={account.email}>
                        {account.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {account.provider.toUpperCase()}
                      </p>
                    </div>
                    {recentUpload && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-2 w-2 rounded-full bg-green-500"
                      />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Storage</span>
                      <span>
                        {account.used_space && account.total_space
                          ? `${Math.round((account.used_space / account.total_space) * 100)}%`
                          : "0%"}
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(
                            100,
                            account.total_space
                              ? (account.used_space / Math.max(1, account.total_space)) * 100
                              : 0
                          )}%`,
                        }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-primary to-accent"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}

              {accounts.length === 0 && (
                <div className="text-center p-6 border-2 border-dashed border-muted rounded-xl">
                  <p className="text-sm text-muted-foreground">No accounts connected</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Logs Section */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <List className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Activity Log</h2>
        </div>
        <div className="space-y-2 font-mono text-xs sm:text-sm max-h-40 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {logs.map((log, i) => (
              <motion.div
                key={`${i}-${log}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-2 text-muted-foreground p-2 rounded hover:bg-white/5 transition-colors"
              >
                <span className="text-primary mt-0.5">›</span>
                <span>{log}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Transfers;
