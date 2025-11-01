import React from "react";

interface Props {
  file: {
    id: string;
    name: string;
    size: string;
    uploadedAt: string;
    mime?: string;
  };
  onDownload: (id: string) => void;
  onPreview: (id: string) => void;
  view?: "list" | "grid";
}

function FileCard({ file, onDownload, onPreview }: Omit<Props, "view">) {
  const isImage = file.mime?.startsWith("image/");

  return (
    <div className="glass-card p-3 flex flex-col items-start hover:shadow-elevated transition">
      <div className="w-full h-40 bg-white/5 rounded-md overflow-hidden flex items-center justify-center mb-3">
        {isImage ? (
          // placeholder; preview will show actual blob when opened
          <div className="text-sm text-muted-foreground">Image</div>
        ) : (
          <div className="text-sm text-muted-foreground">No preview</div>
        )}
      </div>

      <div className="w-full flex-1">
        <div className="font-medium truncate">{file.name}</div>
        <div className="text-sm text-muted-foreground mt-1">
          {file.size} • {new Date(file.uploadedAt).toLocaleDateString()}
        </div>
      </div>

      <div className="w-full mt-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">{file.mime ?? "-"}</div>
        <div className="flex items-center gap-2">
          <button
            className="btn-glass text-sm"
            onClick={() => onPreview(file.id)}
          >
            Preview
          </button>
          <button
            className="btn-primary-glass text-sm"
            onClick={() => onDownload(file.id)}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FileListItem({
  file,
  onDownload,
  onPreview,
  view = "list",
}: Props) {
  if (view === "grid") {
    return (
      <FileCard file={file} onDownload={onDownload} onPreview={onPreview} />
    );
  }

  return (
    <div className="glass-card p-3 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <div className="w-12 h-12 rounded-md bg-white/5 flex items-center justify-center">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            className="text-muted-foreground"
          >
            <path
              d="M12 2L12 22"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 12L22 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="flex-1">
          <div className="font-medium truncate">{file.name}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {file.size} • {new Date(file.uploadedAt).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="btn-glass"
          onClick={() => onPreview(file.id)}
          aria-label={`Preview ${file.name}`}
        >
          Preview
        </button>
        <button
          className="btn-primary-glass"
          onClick={() => onDownload(file.id)}
          aria-label={`Download ${file.name}`}
        >
          Download
        </button>
      </div>
    </div>
  );
}
