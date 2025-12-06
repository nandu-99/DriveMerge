import { useEffect, useState, useMemo } from "react";
import { useUploads, UploadItem } from "@/context/uploads";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { apiGet } from "@/lib/api";
import {
    CheckCircle2,
    XCircle,
    Clock,
    File as FileIcon,
    Loader2,
    RotateCw,
    Download,
    Eye,
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

import { formatBytes } from "@/lib/utils";

const calculateETR = (startedAt: string, progress: number) => {
    if (progress <= 0 || progress >= 100) return null;
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const elapsed = now - start;





    const totalEstimated = (elapsed * 100) / progress;
    const remaining = totalEstimated - elapsed;

    if (remaining < 0) return null;


    const seconds = Math.floor(remaining / 1000);
    if (seconds < 60) return `${seconds}s remaining`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s remaining`;
};

export default function History() {
    const { uploads } = useUploads();
    const [historyJobs, setHistoryJobs] = useState<TransferJob[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const handleReupload = (fileName: string) => {

        navigate('/', { state: { reuploadFile: fileName } });
    };

    const handleFileClick = (fileName: string) => {

        navigate('/files');
    };

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const data = await apiGet("/drive/transfers");
                if (data) {
                    setHistoryJobs(data.jobs || []);
                }
            } catch (error) {
                console.error("Failed to fetch history", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();

        const interval = setInterval(fetchHistory, 5000);
        return () => clearInterval(interval);
    }, []);


    const mergedItems = useMemo(() => {
        const items = [...historyJobs];

        const historyMap = new Map(historyJobs.map(j => [j.uploadId, j]));


        uploads.forEach(upload => {
            if (!historyMap.has(upload.id)) {
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


        return items.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }, [historyJobs, uploads]);

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between px-1">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">History</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        View your file upload history and progress
                    </p>
                </div>
            </div>

            <div className="border border-border rounded-lg bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs font-mono text-muted-foreground uppercase bg-muted/50 border-b border-border">
                            <tr>
                                <th className="px-6 py-3 font-medium">File</th>
                                <th className="px-6 py-3 font-medium">Status</th>
                                <th className="px-6 py-3 font-medium">Progress</th>
                                <th className="px-6 py-3 font-medium">Size</th>
                                <th className="px-6 py-3 font-medium">Date</th>
                                <th className="px-6 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border stagger-animation">
                            {loading && mergedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3 text-primary" />
                                        <span className="text-xs font-mono">Loading history...</span>
                                    </td>
                                </tr>
                            ) : mergedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        <span className="text-xs font-mono">No uploads found</span>
                                    </td>
                                </tr>
                            ) : (
                                mergedItems.map((item) => {
                                    const activeUpload = uploads.find(u => u.id === item.uploadId);
                                    const isServerDone = item.status === 'succeeded' || item.status === 'failed';
                                    const isUploading = !isServerDone && (activeUpload?.status === 'uploading' || item.status === 'in_progress' || item.status === 'pending');

                                    const clientProgress = activeUpload ? activeUpload.progress : 0;
                                    const serverProgress = item.totalBytes ? (item.transferredBytes / item.totalBytes) * 100 : 0;

                                    const progress = isServerDone ? (item.status === 'succeeded' ? 100 : 0) : Math.max(clientProgress, serverProgress);

                                    const etr = activeUpload && isUploading ? calculateETR(activeUpload.startedAt, activeUpload.progress) : null;

                                    return (
                                        <motion.tr
                                            key={item.uploadId}
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="group hover:bg-muted/50 transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 rounded-md bg-muted border border-border text-muted-foreground group-hover:text-foreground transition-colors">
                                                        <FileIcon className="h-4 w-4" />
                                                    </div>
                                                    <button
                                                        onClick={() => handleFileClick(item.fileName)}
                                                        className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[300px] hover:text-primary transition-colors cursor-pointer text-left"
                                                    >
                                                        {item.fileName}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.status === 'succeeded' ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 font-mono uppercase tracking-wide">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        <span>Completed</span>
                                                    </div>
                                                ) : item.status === 'failed' ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-mono uppercase tracking-wide">
                                                        <XCircle className="h-3 w-3" />
                                                        <span>Failed</span>
                                                    </div>
                                                ) : Math.round(progress) >= 100 ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono uppercase tracking-wide">
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                        <span>Finalizing</span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono uppercase tracking-wide">
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                        <span>Uploading</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 min-w-[200px]">
                                                {isUploading ? (
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-[10px] font-mono font-medium text-muted-foreground">
                                                            <span>{Math.round(progress)}%</span>
                                                            {etr && <span>{etr}</span>}
                                                        </div>
                                                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                            <motion.div
                                                                className="h-full bg-primary"
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${progress}%` }}
                                                                transition={{ duration: 0.5 }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground font-mono text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground font-mono text-xs">
                                                {formatBytes(item.totalBytes)}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground text-xs font-mono">
                                                <div className="flex items-center gap-2">
                                                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.status === 'failed' && (
                                                    <button
                                                        onClick={() => handleReupload(item.fileName)}
                                                        className="p-1.5 rounded-md text-foreground hover:bg-muted transition-colors"
                                                        title="Retry upload"
                                                    >
                                                        <RotateCw className="h-4 w-4" />
                                                    </button>
                                                )}
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
