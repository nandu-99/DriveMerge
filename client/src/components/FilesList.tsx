
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { File, Download, Trash2, HardDrive } from "lucide-react";
import { apiGet } from "@/lib/api";

interface FileItem {
  id: string;
  name: string;
  sizeBytes: number;
  uploadDate: string;
  accounts: number;
  chunks: number;
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${Number(val.toFixed(2))} ${units[i]}`;
}

export function FilesList() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiGet("/drive/files?limit=5");
        const byId = new Map();
        for (const f of data.files || []) {
          const existing = byId.get(f.id) || {
            id: f.id,
            name: f.name,
            sizeBytes: f.size || 0,
            modifiedAt: f.modifiedAt,
            accounts: new Set(),
          };
          existing.sizeBytes = Math.max(existing.sizeBytes, f.size || 0);
          existing.modifiedAt = existing.modifiedAt || f.modifiedAt;
          existing.accounts.add(f.accountEmail || "");
          byId.set(f.id, existing);
        }

        type Grouped = {
          id: string;
          name: string;
          sizeBytes: number;
          modifiedAt?: string;
          accounts: Set<string>;
        };

        const list: FileItem[] = Array.from(byId.values()).map((v: Grouped) => {
          const sizeBytes = Number(v.sizeBytes || 0);
          const chunks = Math.max(1, Math.ceil(sizeBytes / (10 * 1024 * 1024)));
          return {
            id: v.id,
            name: v.name,
            sizeBytes,
            uploadDate: v.modifiedAt
              ? new Date(v.modifiedAt).toLocaleDateString()
              : "-",
            accounts: v.accounts.size || 1,
            chunks,
          };
        });

        if (mounted) setFiles(list);
      } catch (err: unknown) {
        console.error(err);
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "";

  async function handleDownload(id: string, name?: string) {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("dm_token") : null;
      const res = await fetch(
        `${API_BASE}/drive/files/download?id=${encodeURIComponent(id)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name || `file-${id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="glass-card p-4 sm:p-6 w-full max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h2 className="text-lg sm:text-xl font-semibold">Your Files</h2>
        <span className="text-sm text-muted-foreground">
          {loading ? "Loading..." : `${files.length} file(s) stored`}
        </span>
      </div>

      {error && <div className="text-sm text-red-400 mb-2">{error}</div>}

      <div className="space-y-3">
        {files.map((file) => (
          <div
            key={file.id}
            className="glass-card max-w-80 sm:max-w-none p-4 glass-hover flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-start sm:items-center gap-3 flex-1 w-full">
              <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex-shrink-0">
                <File className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="font-medium mb-1 truncate break-all">{file.name}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                  <span>{formatBytes(file.sizeBytes)}</span>
                  <span className="hidden xs:inline">•</span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    {file.accounts} account{file.accounts > 1 ? "s" : ""}
                  </span>
                  <span className="hidden xs:inline">•</span>
                  <span>{file.chunks} chunks</span>
                  <span className="hidden xs:inline">•</span>
                  <span>{file.uploadDate}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => handleDownload(file.id, file.name)}
                className="p-2 rounded-lg hover:bg-white/40 transition-colors text-primary"
              >
                <Download className="h-5 w-5" />
              </button>
              <button className="p-2 rounded-lg hover:bg-white/40 transition-colors text-destructive">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
        {!loading && files.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4">
            No files found
          </div>
        )}
        {!loading && files.length > 0 && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => navigate("/files")}
              className="px-4 py-2 rounded-md bg-white/5 text-sm"
            >
              More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
