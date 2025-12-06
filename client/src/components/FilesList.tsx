
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

import { formatBytes } from "@/lib/utils";

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

    const handleUploadSuccess = () => {
      load();
    };

    window.addEventListener('upload-success', handleUploadSuccess);

    return () => {
      mounted = false;
      window.removeEventListener('upload-success', handleUploadSuccess);
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
    <div className="w-full max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3 px-1">
        <h2 className="text-sm font-medium text-foreground tracking-tight">Your Files</h2>
        <span className="text-xs font-mono text-muted-foreground">
          {loading ? "Loading..." : `${files.length} file(s) stored`}
        </span>
      </div>

      {error && <div className="text-xs font-mono text-red-400 mb-4 px-1">{error}</div>}

      <div className="space-y-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="group border border-border rounded-md p-3 bg-card hover:bg-accent/50 hover:border-accent-foreground/20 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div className="flex items-start sm:items-center gap-3 flex-1 w-full">
              <div className="p-2 rounded-md bg-muted border border-border flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                <File className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <h3 className="text-sm font-medium text-foreground mb-1 truncate break-all group-hover:text-primary transition-colors">{file.name}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] sm:text-xs font-mono text-muted-foreground">
                  <span>{formatBytes(file.sizeBytes)}</span>
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="h-3 w-3" />
                    {file.accounts} account{file.accounts > 1 ? "s" : ""}
                  </span>
                  <span>{file.chunks} chunks</span>
                  <span>{file.uploadDate}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => handleDownload(file.id, file.name)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                className="p-1.5 rounded-md hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {!loading && files.length === 0 && (
          <div className="text-xs font-mono text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
            No files found
          </div>
        )}
        {!loading && files.length > 0 && (
          <div className="flex justify-center mt-6">
            <button
              onClick={() => navigate("/files")}
              className="px-4 py-1.5 rounded-md border border-border bg-muted/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              View All Files
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
