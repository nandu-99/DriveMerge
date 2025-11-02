import { motion } from "framer-motion";
import { HardDrive, Package, Play, Pause, List } from "lucide-react";
import { useMemo, useState } from "react";
import { useConnectedAccounts } from "@/hooks/use-connected-accounts";
import { useUploads } from "@/context/uploads";

const Transfers = () => {
  const { data: accounts = [] } = useConnectedAccounts();
  const { uploads } = useUploads();

  const [running, setRunning] = useState(true);

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
      return ["No active uploads — drop a file on Home to start a transfer."];
    }

    const prog = Math.round(recentUpload.progress);
    const completedChunks = Math.round((prog / 100) * chunks);
    return [
      `Starting file upload: ${recentUpload.name} (${formatBytes(
        recentUpload.size
      )})`,
      `Splitting file into ${chunks} chunks...`,
      `Allocating chunks to ${accounts.length} connected accounts...`,
      `Uploading chunk ${Math.max(0, completedChunks)}/${chunks} to ${
        accounts[0]?.email ?? "(pending)"
      }`,
      prog >= 100
        ? `Upload completed: ${recentUpload.name} (${prog}%)`
        : `Progress: ${prog}%`,
    ];
  }, [recentUpload, chunks, accounts]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transfers</h1>
          <p className="text-sm text-muted-foreground">
            Live visualization of your ongoing transfers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRunning((s) => !s)}
            className="inline-flex items-center gap-2 btn-glass px-4 py-2"
            aria-pressed={running}
          >
            {running ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>{running ? "Pause" : "Start"}</span>
          </button>
          <button className="inline-flex items-center gap-2 btn-primary-glass px-4 py-2">
            <List className="h-4 w-4" />
            View All Logs
          </button>
        </div>
      </div>

      {/* Visualization Area */}
      <div className="glass-card p-6 min-h-[48vh]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center h-full">
          {/* Source File (shows active upload) */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="md:col-span-3 flex flex-col items-center gap-4"
          >
            <div className="glass-card p-6 rounded-xl flex flex-col items-center justify-center w-44 h-44">
              <Package className="h-12 w-12 text-primary mb-2" />
              <div className="w-28 text-center">
                <p className="text-sm font-medium truncate">
                  {recentUpload ? recentUpload.name : "No active upload"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {recentUpload
                    ? `${formatBytes(recentUpload.size)} • ${chunks} chunks`
                    : "—"}
                </p>
              </div>

              {/* progress ring / bar */}
              <div className="mt-3 w-full">
                <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${
                        recentUpload
                          ? Math.min(100, Math.round(recentUpload.progress))
                          : 0
                      }%`,
                    }}
                    transition={{ ease: "linear", duration: 0.2 }}
                    className="h-full bg-gradient-to-r from-primary to-accent"
                  />
                </div>
                <div className="mt-2 text-xs text-center text-muted-foreground">
                  {recentUpload ? `${Math.round(recentUpload.progress)}%` : ""}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Transfer Animation Area */}
          <div className="md:col-span-6 relative flex flex-col items-center justify-center">
            <div className="w-full h-2 rounded-full bg-white/10 mb-6 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${
                    recentUpload
                      ? Math.min(100, Math.round(recentUpload.progress))
                      : running
                      ? 100
                      : 0
                  }%`,
                }}
                transition={{ duration: 0.4 }}
                className="h-full bg-gradient-to-r from-primary to-accent"
              />
            </div>

            <div className="relative flex justify-center gap-4">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ y: -20, opacity: 0 }}
                  animate={
                    running
                      ? { y: [0, -24, 0], opacity: [0, 1, 0] }
                      : { y: 0, opacity: 0.6 }
                  }
                  transition={{
                    duration: 2 + i * 0.2,
                    delay: i * 0.15,
                    repeat: running ? Infinity : 0,
                    repeatDelay: 0.6,
                  }}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent shadow-md"
                />
              ))}
            </div>

            <div className="mt-6 text-sm text-muted-foreground">
              {recentUpload
                ? `Transferring ${recentUpload.name} — ${Math.round(
                    recentUpload.progress
                  )}%`
                : "Transferring chunks to destination accounts"}
            </div>
          </div>

          {/* Destination Accounts */}
          <div className="md:col-span-3 flex flex-col gap-4">
            {accounts.map((account, index) => (
              <motion.div
                key={account.id}
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.15 }}
                className="glass-card p-4 rounded-xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <HardDrive className="h-7 w-7 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium text-sm truncate">
                      {account.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.used_space || account.total_space
                        ? `${formatBytes(
                            account.used_space || 0
                          )} / ${formatBytes(account.total_space || 0)}`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="h-2 bg-white/8 rounded-full overflow-hidden">
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
                    transition={{ duration: 2 }}
                    className="h-full bg-gradient-to-r from-primary to-accent"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Transfer Log */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4">Transfer Log</h2>
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {logs.map((log, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="text-sm text-muted-foreground font-mono p-2 rounded bg-white/4"
            >
              {log}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Transfers;
