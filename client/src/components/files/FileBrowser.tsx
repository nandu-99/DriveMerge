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
    };
    const files = (data.files || []).map((f: ServerFile) => ({
      id: f.id,
      name: f.name,
      size: formatBytes(Number(f.size || 0)),
      uploadedAt: f.modifiedAt ? new Date(f.modifiedAt).toLocaleString() : "",
      mime: f.mime,
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
      const res = await fetch(
        `${API_BASE}/drive/files/download?id=${encodeURIComponent(id)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      if (!res.ok) {
        const blob = new Blob([`File ${id} - mock content`], {
          type: "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `file-${id}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename\*=UTF-8''(.+)|filename="?([^;\n"]+)"?/);
      a.download = m ? decodeURIComponent(m[1] || m[2]) : `file-${id}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  }

  async function handlePreview(id: string) {
    const f = (files as FileEntry[]).find((x) => x.id === id) as
      | FileEntry
      | undefined;
    if (!f) return;
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("dm_token") : null;
      const res = await fetch(
        `${API_BASE}/drive/files/download?id=${encodeURIComponent(id)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );
      if (!res.ok) {
        setPreview(f);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreview({ ...f, mime: blob.type, name: url });
    } catch (err) {
      console.error(err);
      setPreview(f);
    }
  }

  function closePreview() {
    if (preview?.name?.startsWith("blob:")) {
      URL.revokeObjectURL(preview.name as string);
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
                  src={preview.name}
                  alt={preview.id}
                  className="max-h-[60vh] sm:max-h-[70vh] w-auto max-w-full rounded-md"
                />
              ) : preview.mime?.startsWith("video/") ? (
                <video
                  src={preview.name}
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
