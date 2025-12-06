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
      thumbnailUrl: f.thumbnailUrl,
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
    console.log("Download clicked for file:", id);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("dm_token") : null;
      console.log("Token available:", !!token);
      const url = `${API_BASE}/drive/files/download?id=${encodeURIComponent(id)}`;
      console.log("Downloading from:", url);
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      console.log("Download response:", res.status, res.statusText);
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Download failed:", errorText);
        alert(`Failed to download file: ${res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename\*=UTF-8''(.+)|filename="?([^;\n"]+)"?/);
      a.download = m ? decodeURIComponent(m[1] || m[2]) : `file-${id}`;
      console.log("Download filename:", a.download);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download file. Please try again.");
    }
  }

  async function handlePreview(id: string) {
    console.log("Preview clicked for file:", id);
    const f = (files as FileEntry[]).find((x) => x.id === id) as
      | FileEntry
      | undefined;
    if (!f) {
      console.error("File not found:", id);
      return;
    }
    console.log("File to preview:", f);
    try {
      // Request a short-lived preview token from the server (safer than sharing long-lived tokens)
      const token =
        typeof window !== "undefined" ? localStorage.getItem("dm_token") : null;
      if (!token) {
        console.warn("No token found, showing preview without token");
        setPreview(f);
        return;
      }

      console.log("Requesting preview token...");
      const resp = await fetch(`${API_BASE}/drive/files/preview-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fileId: id }),
      });
      console.log("Preview token response:", resp.status, resp.statusText);
      if (!resp.ok) {
        const errorText = await resp.text();
        console.error("Preview token failed:", errorText);
        setPreview(f);
        return;
      }
      const data = await resp.json();
      console.log("Preview token data:", data);
      const previewToken = data.previewToken;
      if (!previewToken) {
        console.warn("No preview token in response");
        setPreview(f);
        return;
      }

      // Use the preview token in the streaming URL. The token is short-lived and bound to the file.
      const url = `${API_BASE}/drive/files/download?id=${encodeURIComponent(
        id
      )}&preview=1&preview_token=${encodeURIComponent(previewToken)}`;
      console.log("Preview URL:", url);
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
    <div className="space-y-4 p-4 sm:p-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-semibold">Files</h1>

        {/* Controls - Responsive Layout */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Bar - Mobile Toggle */}
          <div className="relative">
            {/* Mobile: Icon button to toggle search */}
            {/* <button
              onClick={() => setSearchOpen(!searchOpen)}
              className="sm:hidden w-full px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
              aria-label="Toggle search"
            >
              <Search className="h-4 w-4" />
              <span className="text-sm">Search</span>
            </button> */}

            {/* Desktop: Always visible search */}
            <div className="w-80 sm:w-64">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search files..."
                  className="w-full pl-9 pr-3 py-2 border rounded-md bg-white/5 focus:bg-white/10 transition-colors"
                />
              </div>
            </div>

            {/* Mobile: Expandable search */}
            {/* {searchOpen && (
              <div className="sm:hidden mt-2 w-full">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search files..."
                    className="w-full pl-9 pr-3 py-2 border rounded-md bg-white/5 focus:bg-white/10 transition-colors"
                    autoFocus
                  />
                </div>
              </div>
            )} */}
          </div>

          {/* View Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("grid")}
              className={`flex-1 sm:flex-none px-3 py-2 rounded-md transition-all flex items-center justify-center gap-2 ${
                view === "grid"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-white/10 hover:bg-white/20"
              }`}
              aria-pressed={view === "grid"}
              aria-label="Grid view"
            >
              <Grid3x3 className="h-4 w-4" />
              <span className="text-sm sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex-1 sm:flex-none px-3 py-2 rounded-md transition-all flex items-center justify-center gap-2 ${
                view === "list"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-white/10 hover:bg-white/20"
              }`}
              aria-pressed={view === "list"}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
              <span className="text-sm sm:inline">List</span>
            </button>
            <button
              onClick={() => refetch()}
              className="flex-1 sm:flex-none px-3 py-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
              aria-label="Refresh files"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-sm text-muted-foreground text-center py-8">
          Loading files...
        </div>
      )}

      {/* Empty State */}
      {filtered.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-2">No files found</div>
          {q && (
            <button
              onClick={() => setQ("")}
              className="text-sm text-primary hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Files Display */}
      {view === "list" ? (
        <div className="space-y-2 sm:space-y-3">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6"
          onClick={closePreview}
        >
          <div
            className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <div className="font-medium text-base sm:text-lg truncate pr-4">
                Preview
              </div>
              <button
                onClick={closePreview}
                className="text-sm px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
              >
                Close
              </button>
            </div>
            <div className="flex items-center justify-center">
              {preview.mime?.startsWith("image/") ? (
                <img
                  src={preview.thumbnailUrl || `${API_BASE}/drive/files/download?id=${encodeURIComponent(preview.id)}&preview=1`}
                  alt={preview.name}
                  className="max-h-[60vh] sm:max-h-[70vh] w-auto max-w-full rounded-md"
                />
              ) : preview.mime?.startsWith("video/") ? (
                <video
                  src={preview.thumbnailUrl || `${API_BASE}/drive/files/download?id=${encodeURIComponent(preview.id)}&preview=1`}
                  controls
                  className="max-h-[60vh] sm:max-h-[70vh] w-auto max-w-full rounded-md"
                />
              ) : (
                <div className="text-sm text-center py-8 text-muted-foreground">
                  No preview available for this file.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
