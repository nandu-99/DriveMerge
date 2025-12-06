
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
    <div className="w-full max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Files</h2>
          <p className="text-sm text-muted-foreground">
            Manage and monitor your uploaded assets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/files")}
            className="px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors"
          >
            View All
          </button>
        </div>
      </div>

      {error && <div className="text-xs font-mono text-red-500 bg-red-500/10 p-3 rounded-md">{error}</div>}

      <div className="border border-border/80 rounded-xl bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-4 pl-6 py-3 font-medium text-muted-foreground w-[40%]">Name</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-[15%]">Size</th>
                <th className="px-4 py-3 font-medium text-muted-foreground w-[25%]">Details</th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-sm">
                    Loading files...
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-sm">
                    No files uploaded yet.
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr
                    key={file.id}
                    className="group hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-4 pl-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-muted/50 text-muted-foreground group-hover:text-foreground group-hover:bg-muted transition-colors">
                          <File className="h-4 w-4" />
                        </div>
                        <span className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[300px]" title={file.name}>
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {formatBytes(file.sizeBytes)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <HardDrive className="h-3 w-3 opacity-70" />
                          {file.accounts} account{file.accounts !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60 font-mono">
                          {file.uploadDate}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right pr-6">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        <button
                          onClick={() => handleDownload(file.id, file.name)}
                          className="p-2 rounded-md hover:bg-background hover:text-foreground text-muted-foreground transition-colors border border-transparent hover:border-border hover:shadow-sm"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 rounded-md hover:bg-red-500/10 hover:text-red-500 text-muted-foreground transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
