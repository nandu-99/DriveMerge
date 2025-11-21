import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FileListItem from "./FileListItem";
import { apiGet } from "@/lib/api";
import { Grid3x3, List, RefreshCw, Search } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "";

type FileEntry = {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
  mime?: string;
  thumbnailUrl?: string;
};

const mockFiles: FileEntry[] = [
  {
    id: "1",
    name: "photo.jpg",
    size: "2.1 MB",
    uploadedAt: new Date().toISOString(),
    mime: "image/jpeg",
  },
  {
    id: "2",
    name: "report.pdf",
    size: "550 KB",
    uploadedAt: new Date().toISOString(),
    mime: "application/pdf",
  },
  {
    id: "3",
    name: "video.mp4",
    size: "24 MB",
    uploadedAt: new Date().toISOString(),
    mime: "video/mp4",
  },
];

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

async function fetchFilesFromApi() {
  try {
    const data = await apiGet("/drive/files?limit=0");
    type ServerFile = {
      id: string;
      name: string;
      size?: number;
      modifiedAt?: string;
      mime?: string;
      thumbnailUrl?: string;
    };
    const files = (data.files || []).map((f: ServerFile) => ({
      id: f.id,
      name: f.name,
      size: formatBytes(Number(f.size || 0)),
      uploadedAt: f.modifiedAt ? new Date(f.modifiedAt).toLocaleString() : "",
      mime: f.mime,
      thumbnailUrl: f.thumbnailUrl
        ? `${f.thumbnailUrl}&access_token=${encodeURIComponent(localStorage.getItem("dm_token") || "")}`
        : undefined,
    }));
    return files as FileEntry[];
  } catch (e) {
    return mockFiles;
  }
}

export default function FileBrowser() {
  const query = useQuery<FileEntry[], Error>({
    queryKey: ["files"],
    queryFn: fetchFilesFromApi,
  });
  const files = React.useMemo(() => query.data ?? [], [query.data]);
  const isLoading = query.isLoading;
  const refetch = query.refetch;
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<FileEntry | null>(null);
  const [view, setView] = useState<"list" | "grid">("grid");
  const [searchOpen, setSearchOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!q) return files;
    return files.filter((f: FileEntry) =>
      f.name.toLowerCase().includes(q.toLowerCase())
    );
  }, [files, q]);

  async function handleDownload(id: string) {
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("dm_token") : null;

      const url = `${API_BASE}/drive/files/download?id=${encodeURIComponent(id)}&access_token=${encodeURIComponent(token || "")}`;

      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to initiate download. Please try again.");
    }
  }

  async function handlePreview(id: string) {
    const f = (files as FileEntry[]).find((x) => x.id === id) as
      | FileEntry
      | undefined;
    if (!f) {
      console.error("File not found:", id);
      return;
    }
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("dm_token") : null;
      if (!token) {
        console.warn("No token found, showing preview without token");
        setPreview(f);
        return;
      }

      const resp = await fetch(`${API_BASE}/drive/files/preview-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileId: id }),
      });
      if (!resp.ok) {
        const errorText = await resp.text();
        console.error("Preview token failed:", errorText);
        setPreview(f);
        return;
      }
      const data = await resp.json();
      const previewToken = data.previewToken;
      if (!previewToken) {
        console.warn("No preview token in response");
        setPreview(f);
        return;
      }

      const url = `${API_BASE}/drive/files/download?id=${encodeURIComponent(
        id
      )}&preview=1&preview_token=${encodeURIComponent(previewToken)}`;
      setPreview({ ...f, thumbnailUrl: url });
    } catch (err) {
      console.error("Preview error:", err);
      setPreview(f);
    }
  }

  function closePreview() {
    if (preview?.thumbnailUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(preview.thumbnailUrl);
    }
    setPreview(null);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Files</h1>
          <p className="text-muted-foreground mt-1">
            Browse and manage your cloud files
          </p>
        </div>

        {/* Controls - Responsive Layout */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Desktop: Always visible search */}
          <div className="w-full sm:w-72">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search files..."
                className="input-style pl-11 w-full"
              />
            </div>
          </div>

          {/* View Controls */}
          <div className="flex items-center gap-2 p-1 rounded-xl border border-white/5">
            <button
              onClick={() => setView("grid")}
              className={`p-2 rounded-lg transition-all ${view === "grid"
                ? "bg-background shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
              aria-pressed={view === "grid"}
              aria-label="Grid view"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2 rounded-lg transition-all ${view === "list"
                ? "bg-background shadow-sm text-primary"
                : "text-muted-foreground hover:text-foreground"
                }`}
              aria-pressed={view === "list"}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => refetch()}
            className="btn-glass p-2.5"
            aria-label="Refresh files"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <RefreshCw className="h-8 w-8 animate-spin mb-4 text-primary/50" />
          <p>Loading files...</p>
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 && !isLoading && (
        <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">No files found</h3>
          <p className="text-muted-foreground mt-1 max-w-xs mx-auto">
            {q ? "Try adjusting your search terms" : "Upload some files to get started"}
          </p>
          {q && (
            <button
              onClick={() => setQ("")}
              className="mt-4 text-sm text-primary hover:underline font-medium"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Files Display */}
      {view === "list" ? (
        <div className="space-y-2">
          {filtered.map((f: FileEntry) => (
            <FileListItem
              key={f.id}
              file={f}
              onDownload={handleDownload}
              onPreview={handlePreview}
              view="list"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((f: FileEntry) => (
            <FileListItem
              key={f.id}
              file={f}
              onDownload={handleDownload}
              onPreview={handlePreview}
              view="grid"
            />
          ))}
        </div>
      )}

      {/* Preview Modal - Responsive */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={closePreview}
        >
          <div
            className="glass-card p-4 sm:p-6 max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border-white/10 bg-[#0a0a0a]/90"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <div className="font-medium text-lg truncate pr-4 flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  {preview.mime?.startsWith("image/") ? <Grid3x3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </span>
                {preview.name}
              </div>
              <button
                onClick={closePreview}
                className="btn-glass px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center overflow-hidden bg-black/20 rounded-xl border border-white/5 relative min-h-[300px]">
              {preview.mime?.startsWith("image/") ? (
                <img
                  src={preview.thumbnailUrl || `${API_BASE}/drive/files/download?id=${encodeURIComponent(preview.id)}&preview=1`}
                  alt={preview.name}
                  className="max-h-full max-w-full object-contain"
                />
              ) : preview.mime?.startsWith("video/") ? (
                <video
                  src={preview.thumbnailUrl || `${API_BASE}/drive/files/download?id=${encodeURIComponent(preview.id)}&preview=1`}
                  controls
                  className="max-h-full max-w-full"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <List className="h-16 w-16 mb-4 opacity-20" />
                  <p>No preview available</p>
                  <button
                    onClick={() => handleDownload(preview.id)}
                    className="mt-4 btn-primary-glass text-sm"
                  >
                    Download to view
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
