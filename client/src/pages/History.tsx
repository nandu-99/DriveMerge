import { useEffect, useState, useMemo } from "react";
import { useUploads, UploadItem } from "@/context/uploads";
import { formatDistanceToNow } from "date-fns";
import {
    CheckCircle2,
    XCircle,
    Clock,
    File as FileIcon,
    Loader2,
} from "lucide-react";
import { motion } from "framer-motion";

type TransferJob = {
    uploadId: string;
    fileName: string;
    status: "pending" | "in_progress" | "succeeded" | "failed";
    totalBytes: number;
    transferredBytes: number;
    createdAt: string;
    updatedAt: string;
};

const formatBytes = (bytes: number, decimals = 2): string => {
    if (!bytes) return "0 B";
    const k = 1024;
    const dm = Math.max(0, decimals);
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

const calculateETR = (startedAt: string, progress: number) => {
    if (progress <= 0 || progress >= 100) return null;
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const elapsed = now - start;

    // elapsed / progress = total / 100
    // total = (elapsed * 100) / progress
    // remaining = total - elapsed

    const totalEstimated = (elapsed * 100) / progress;
    const remaining = totalEstimated - elapsed;

    if (remaining < 0) return null;

    // Format remaining time
    const seconds = Math.floor(remaining / 1000);
    if (seconds < 60) return `${seconds}s remaining`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s remaining`;
};

export default function History() {
    const { uploads } = useUploads();
    const [historyJobs, setHistoryJobs] = useState<TransferJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const token = localStorage.getItem("dm_token");
                const res = await fetch("/drive/transfers", {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (res.ok) {
                    const data = await res.json();
                    setHistoryJobs(data.jobs || []);
                }
            } catch (error) {
                console.error("Failed to fetch history", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
        // Poll for updates every 5 seconds to keep history fresh
        const interval = setInterval(fetchHistory, 5000);
        return () => clearInterval(interval);
    }, []);

    // Merge active uploads from context with historical jobs
    const mergedItems = useMemo(() => {
        const items = [...historyJobs];

        const historyMap = new Map(historyJobs.map(j => [j.uploadId, j]));

        // Add or update items from active uploads context
        uploads.forEach(upload => {
            if (historyMap.has(upload.id)) {
                // If it exists in history, we might want to prefer the context for 'progress'
                // if it's currently uploading, but history for 'status' if it's done.
                // For simplicity, if it's in 'uploads' context, it's likely active or recently done in this session.
                // We'll override specific fields.
            } else {
                items.unshift({
                    uploadId: upload.id,
                    fileName: upload.name,
                    status: upload.status === 'uploading' ? 'in_progress' :
                        upload.status === 'error' ? 'failed' : 'succeeded',
                    totalBytes: upload.size,
                    transferredBytes: Math.floor((upload.size * upload.progress) / 100),
                    createdAt: upload.startedAt,
                    updatedAt: new Date().toISOString(),
                });
            }
        });

        // Sort by date desc
        return items.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }, [historyJobs, uploads]);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">History</h1>
                    <p className="text-muted-foreground mt-1">
                        View your file upload history and progress
                    </p>
                </div>
            </div>

            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-white/5 border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4 font-medium">File</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium">Progress</th>
                                <th className="px-6 py-4 font-medium">Size</th>
                                <th className="px-6 py-4 font-medium">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading && mergedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-primary" />
                                        Loading history...
                                    </td>
                                </tr>
                            ) : mergedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                        No uploads found
                                    </td>
                                </tr>
                            ) : (
                                mergedItems.map((item) => {
                                    const activeUpload = uploads.find(u => u.id === item.uploadId);
                                    const isUploading = activeUpload?.status === 'uploading' || item.status === 'in_progress';
                                    const progress = activeUpload ? activeUpload.progress :
                                        item.status === 'succeeded' ? 100 :
                                            item.status === 'pending' ? 0 :
                                                (item.transferredBytes / item.totalBytes) * 100;

                                    const etr = activeUpload && isUploading ? calculateETR(activeUpload.startedAt, activeUpload.progress) : null;

                                    return (
                                        <motion.tr
                                            key={item.uploadId}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="group hover:bg-white/5 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                                                        <FileIcon className="h-5 w-5" />
                                                    </div>
                                                    <span className="font-medium truncate max-w-[200px] sm:max-w-[300px]">
                                                        {item.fileName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.status === 'succeeded' ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        <span>Completed</span>
                                                    </div>
                                                ) : item.status === 'failed' ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                                        <XCircle className="h-3.5 w-3.5" />
                                                        <span>Failed</span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        <span>Uploading</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 min-w-[200px]">
                                                {isUploading ? (
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-xs font-medium">
                                                            <span>{Math.round(progress)}%</span>
                                                            {etr && <span className="text-muted-foreground">{etr}</span>}
                                                        </div>
                                                        <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                                                            <motion.div
                                                                className="h-full bg-primary"
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${progress}%` }}
                                                                transition={{ duration: 0.5 }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                                                {formatBytes(item.totalBytes)}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground text-xs">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
