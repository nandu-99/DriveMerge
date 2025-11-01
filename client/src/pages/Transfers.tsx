import { motion } from "framer-motion";
import { HardDrive, Package } from "lucide-react";

const Transfers = () => {
  // Mock transfer visualization data
  const accounts = [
    { id: "1", email: "acc1@gmail.com", chunks: 800 },
    { id: "2", email: "acc2@gmail.com", chunks: 1200 },
  ];

  return (
    <div className="space-y-6">
      <div className="glass-card p-6">
        <h1 className="text-2xl font-bold mb-2">Transfer Visualization</h1>
        <p className="text-muted-foreground">
          Watch your files being split and distributed across your connected accounts in real-time
        </p>
      </div>

      {/* Visualization Area */}
      <div className="glass-card p-8 min-h-[600px]">
        <div className="flex items-center justify-between h-full">
          {/* Source File */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="glass-card p-8 rounded-2xl">
              <Package className="h-16 w-16 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold">large-video.mp4</p>
              <p className="text-sm text-muted-foreground">20 GB</p>
              <p className="text-xs text-muted-foreground mt-1">2000 chunks</p>
            </div>
          </motion.div>

          {/* Transfer Animation Area */}
          <div className="flex-1 px-12 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1 }}
                className="w-full h-1 bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30"
              />
            </div>
            <div className="relative flex justify-center gap-4">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ x: -100, opacity: 0 }}
                  animate={{ x: 0, opacity: [0, 1, 0] }}
                  transition={{
                    duration: 2,
                    delay: i * 0.3,
                    repeat: Infinity,
                    repeatDelay: 1,
                  }}
                  className="w-8 h-8 rounded bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/50"
                />
              ))}
            </div>
          </div>

          {/* Destination Accounts */}
          <div className="flex flex-col gap-6">
            {accounts.map((account, index) => (
              <motion.div
                key={account.id}
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: index * 0.2 }}
                className="glass-card p-6 rounded-2xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <HardDrive className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium text-sm">{account.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.chunks} chunks
                    </p>
                  </div>
                </div>
                <div className="h-2 bg-white/40 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 3, delay: 1 }}
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
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {[
            "Starting file upload: large-video.mp4 (20 GB)",
            "Splitting file into 2000 chunks...",
            "Allocating chunks to accounts...",
            "Uploading chunk 1/2000 to acc1@gmail.com",
            "Uploading chunk 2/2000 to acc1@gmail.com",
            "Uploading chunk 3/2000 to acc2@gmail.com",
            "Chunk 1/2000 completed (100%)",
            "Chunk 2/2000 completed (100%)",
          ].map((log, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="text-sm text-muted-foreground font-mono p-2 rounded bg-white/20"
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
