import React, { useState } from "react";
import { Download, Eye, File, Image, Video, FileText, Music } from "lucide-react";

interface Props {
  file: {
    id: string;
    name: string;
    size: string;
    uploadedAt: string;
    mime?: string;
    thumbnailUrl?: string;
  };
  onDownload: (id: string) => void;
  onPreview: (id: string) => void;
  view?: "list" | "grid";
}

function getFileIcon(mime?: string) {
  if (!mime) return File;
  if (mime.startsWith("image/")) return Image;
  if (mime.startsWith("video/")) return Video;
  if (mime.startsWith("audio/")) return Music;
  if (mime.includes("pdf") || mime.includes("document")) return FileText;
  return File;
}

function FileCard({ file, onDownload, onPreview }: Omit<Props, "view">) {
  const isImage = file.mime?.startsWith("image/");
  const isVideo = file.mime?.startsWith("video/");
  const IconComponent = getFileIcon(file.mime);
  const [thumbError, setThumbError] = useState(false);
  const [thumbLoading, setThumbLoading] = useState(Boolean(isImage && file.thumbnailUrl));

  return (
    <div className="glass-card p-3 sm:p-4 flex flex-col items-start hover:shadow-elevated transition-all hover:scale-[1.02] active:scale-[0.98]">
      {/* Preview Area */}
      <div className="w-full h-32 sm:h-40 bg-white/5 rounded-md overflow-hidden flex items-center justify-center mb-3 relative group">
        {isImage && file.thumbnailUrl && !thumbError ? (
          <>
            <img
              src={file.thumbnailUrl}
              alt={file.name}
              className="object-cover w-full h-full"
              onError={() => {
                setThumbError(true);
                setThumbLoading(false);
              }}
              onLoad={() => setThumbLoading(false)}
            />
            {thumbLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-transparent rounded-full" />
              </div>
            )}
          </>
        ) : (
          <IconComponent className="h-12 w-12 sm:h-16 sm:w-16 text-muted-foreground/50" />
        )}
        {(isImage || isVideo) && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <Eye className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-white" />
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="w-full flex-1 mb-3">
        <div className="font-medium truncate text-sm sm:text-base" title={file.name}>
          {file.name}
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground mt-1">
          <span>{file.size}</span>
          <span className="hidden xs:inline"> • </span>
          <span className="block xs:inline text-xs">
            {new Date(file.uploadedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full flex flex-col xs:flex-row items-stretch xs:items-center gap-2">
        <div className="text-xs text-muted-foreground truncate flex-1" title={file.mime ?? "-"}>
          {file.mime ?? "-"}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-glass text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2 flex items-center justify-center gap-1.5 flex-1 xs:flex-none"
            onClick={() => onPreview(file.id)}
            aria-label={`Preview ${file.name}`}
          >
            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Preview</span>
          </button>
          <button
            className="btn-primary-glass text-xs sm:text-sm px-2 py-1.5 sm:px-3 sm:py-2 flex items-center justify-center gap-1.5 flex-1 xs:flex-none"
            onClick={() => onDownload(file.id)}
            aria-label={`Download ${file.name}`}
          >
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Download</span>
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

  const IconComponent = getFileIcon(file.mime);

  return (
    <div className="glass-card p-3 sm:p-4">
      {/* Mobile: Stack layout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-64 sm:max-w-none">
        {/* File Info Section */}
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          {/* Icon */}
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {file.mime?.startsWith("image/") && file.thumbnailUrl ? (
              <img
                src={file.thumbnailUrl}
                alt={file.name}
                className="object-cover w-full h-full"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.style.display = "none";
                }}
                onLoad={() => {
                  /* nothing for small icon */
                }}
              />
            ) : (
              <IconComponent className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
            )}
          </div>

          {/* File Details */}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate text-sm sm:text-base" title={file.name}>
              {file.name}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
              <span>{file.size}</span>
              <span className="hidden xs:inline"> • </span>
              <span className="block xs:inline">
                {new Date(file.uploadedAt).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </span>
            </div>
            {/* Mobile: Show MIME type below */}
            <div className="text-xs text-muted-foreground mt-1 sm:hidden truncate">
              {file.mime ?? "-"}
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Desktop: Show MIME type */}
          <div className="hidden sm:block text-xs text-muted-foreground mr-2 max-w-[120px] truncate" title={file.mime ?? "-"}>
            {file.mime ?? "-"}
          </div>

          {/* Action Buttons */}
          <button
            className="btn-glass text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
            onClick={() => onPreview(file.id)}
            aria-label={`Preview ${file.name}`}
          >
            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Preview</span>
          </button>
          <button
            className="btn-primary-glass text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 flex items-center justify-center gap-1.5 flex-1 sm:flex-none"
            onClick={() => onDownload(file.id)}
            aria-label={`Download ${file.name}`}
          >
            <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Download</span>
          </button>
        </div>
      </div>
    </div>
  );
}
