import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FileListItem from "./FileListItem";
import { apiGet, apiPost } from "@/lib/api";
import { Grid3x3, List, RefreshCw, Search } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || "";

type FileEntry = {
  id: string;
  name: string;
  size: string;
  sizeBytes: number;
  uploadedAt: string;
  mime?: string;
  thumbnailUrl?: string;
};

const mockFiles: FileEntry[] = [
  {
    id: "1",
    name: "photo.jpg",
    size: "2.1 MB",
    sizeBytes: 2100000,
    uploadedAt: new Date().toISOString(),
    mime: "image/jpeg",
  },
  {
    id: "2",
    name: "report.pdf",
    size: "550 KB",
    sizeBytes: 550000,
    uploadedAt: new Date().toISOString(),
    mime: "application/pdf",
  },
  {
    id: "3",
    name: "video.mp4",
    size: "24 MB",
    sizeBytes: 24000000,
    uploadedAt: new Date().toISOString(),
    mime: "video/mp4",
  },
];

import { formatBytes } from "@/lib/utils";

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
      sizeBytes: Number(f.size || 0),
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

  const [sortBy, setSortBy] = useState<"date" | "size" | "name">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    let filesToFilter = files;
    if (q) {
      filesToFilter = files.filter((f: FileEntry) =>
        f.name.toLowerCase().includes(q.toLowerCase())
      );
    }

    return [...filesToFilter].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortBy === 'size') {
        cmp = (a.sizeBytes || 0) - (b.sizeBytes || 0);
      } else if (sortBy === 'date') {
        // Handle potentially invalid dates gracefully, defaulting to 0
        const dateA = new Date(a.uploadedAt).getTime() || 0;
        const dateB = new Date(b.uploadedAt).getTime() || 0;
        cmp = dateA - dateB;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [files, q, sortBy, sortOrder]);

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
      const token =
        typeof window !== "undefined" ? localStorage.getItem("dm_token") : null;
      if (!token) {
        console.warn("No token found, showing preview without token");
        setPreview(f);
        return;
      }

      console.log("Requesting preview token...");
      const responseData = await apiPost("/drive/files/preview-token", { fileId: id }) as { previewToken: string };
      console.log("Preview token data:", responseData);
      const previewToken = responseData.previewToken;
      if (!previewToken) {
        console.warn("No preview token in response");
        setPreview(f);
        return;
      }

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-semibold">Files</h1>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">


            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-64 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-9 pr-3 py-2 h-9 text-sm border border-input rounded-md bg-background focus:ring-1 focus:ring-ring transition-colors"
                />
              </div>

              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [newSort, newOrder] = e.target.value.split('-');
                  setSortBy(newSort as any);
                  setSortOrder(newOrder as any);
                }}
                className="h-9 px-3 py-1 rounded-md border border-input bg-background/50 text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none min-w-[130px] cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <option value="date-desc">Newest</option>
                <option value="date-asc">Oldest</option>
                <option value="size-desc">Largest</option>
                <option value="size-asc">Smallest</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
            </div>


          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("grid")}
              className={`flex-1 sm:flex-none h-9 w-9 rounded-md transition-all flex items-center justify-center ${view === "grid"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background border border-input hover:bg-accent hover:text-accent-foreground"
                }`}
              aria-pressed={view === "grid"}
              aria-label="Grid view"
              title="Grid View"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex-1 sm:flex-none h-9 w-9 rounded-md transition-all flex items-center justify-center ${view === "list"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-background border border-input hover:bg-accent hover:text-accent-foreground"
                }`}
              aria-pressed={view === "list"}
              aria-label="List view"
              title="List View"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => refetch()}
              className="flex-1 sm:flex-none h-9 w-9 rounded-md bg-background border border-input hover:bg-accent hover:text-accent-foreground transition-all flex items-center justify-center"
              aria-label="Refresh files"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground text-center py-8">
          Loading files...
        </div>
      )}

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

      {view === "list" ? (
        <div className="border border-border/80 rounded-xl bg-card/50 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 pl-6 py-3 font-medium text-muted-foreground w-[40%]">Name</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell w-[15%]">Size</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell w-[25%]">Details</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((f: FileEntry) => (
                  <FileListItem
                    key={f.id}
                    file={f}
                    onDownload={handleDownload}
                    onPreview={handlePreview}
                    view="list"
                  />
                ))}
              </tbody>
            </table>
          </div>
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
