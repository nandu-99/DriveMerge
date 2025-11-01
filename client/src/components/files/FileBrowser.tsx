import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import FileListItem from "./FileListItem";

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

async function fetchFilesFromApi() {
  try {
    const res = await fetch("/api/files/list");
    if (!res.ok) throw new Error("no-api");
    const data = await res.json();
    return data.files as FileEntry[];
  } catch (e) {
    // fallback to mock
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

  const filtered = useMemo(() => {
    if (!q) return files;
    return files.filter((f: FileEntry) =>
      f.name.toLowerCase().includes(q.toLowerCase())
    );
  }, [files, q]);

  async function handleDownload(id: string) {
    try {
      const res = await fetch(
        `/api/files/download?id=${encodeURIComponent(id)}`
      );
      if (!res.ok) {
        // fallback: create a small text blob
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
      // try to extract filename from headers
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
      const res = await fetch(
        `/api/files/download?id=${encodeURIComponent(id)}`
      );
      if (!res.ok) {
        setPreview(f);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      // attach preview url to object for modal
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Files</h1>

        <div className="flex items-center gap-3">
          <div className="w-64">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search files..."
              className="w-full px-3 py-2 border rounded-md"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("grid")}
              className={`px-3 py-2 rounded-md ${
                view === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/5"
              }`}
              aria-pressed={view === "grid"}
            >
              Grid
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-2 rounded-md ${
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/5"
              }`}
              aria-pressed={view === "list"}
            >
              List
            </button>
            <button
              onClick={() => refetch()}
              className="px-3 py-2 rounded-md bg-white/5"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Loading files...</div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="text-sm">No files found</div>
      )}

      {view === "list" ? (
        <div className="space-y-3">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-4 rounded-md max-w-3xl w-full">
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium">Preview</div>
              <button
                onClick={closePreview}
                className="text-sm text-muted-foreground"
              >
                Close
              </button>
            </div>
            <div>
              {preview.mime?.startsWith("image/") ? (
                <img
                  src={preview.name}
                  alt={preview.id}
                  className="max-h-[60vh] w-auto mx-auto"
                />
              ) : preview.mime?.startsWith("video/") ? (
                <video
                  src={preview.name}
                  controls
                  className="max-h-[60vh] w-auto mx-auto"
                />
              ) : (
                <div className="text-sm">
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
