import { useState, useRef, useEffect, memo } from "react";
import { Download, Eye, File, Image, Video, FileText, Music, FileArchive } from "lucide-react";

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

interface FileStyles {
  icon: React.ElementType;
}

function getFileStyles(mime?: string): FileStyles {
  if (!mime) return { icon: File };
  const m = mime.toLowerCase();

  if (m.startsWith("image/")) return { icon: Image };
  if (m.startsWith("video/")) return { icon: Video };
  if (m.startsWith("audio/")) return { icon: Music };
  if (m.includes("pdf") || m.includes("document") || m.includes("text")) return { icon: FileText };
  if (m.includes("zip") || m.includes("compressed") || m.includes("tar") || m.includes("gz")) return { icon: FileArchive };

  return { icon: File };
}

function FileCard({ file, onDownload, onPreview }: Omit<Props, "view">) {
  const isImage = file.mime?.startsWith("image/");
  const { icon: IconComponent } = getFileStyles(file.mime);
  const [thumbError, setThumbError] = useState(false);
  const [thumbLoading, setThumbLoading] = useState(Boolean(isImage && file.thumbnailUrl));

  return (
    <div
      className="group relative flex flex-col rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/20 overflow-hidden cursor-pointer"
      onClick={() => onPreview(file.id)}
    >
      {/* Thumbnail Container - Unified Aspect Ratio */}
      <div className="relative aspect-[16/10] w-full border-b border-border/50 bg-muted/20">
        {isImage && file.thumbnailUrl && !thumbError ? (
          <>
            <img
              src={file.thumbnailUrl}
              alt={file.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => {
                setThumbError(true);
                setThumbLoading(false);
              }}
              onLoad={() => setThumbLoading(false)}
            />
            {thumbLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
            {/* Subtle overlay for images on hover */}
            <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/10" />
          </>
        ) : (
          /* Non-Image Placeholder - Solid, Consistent Look */
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/50 transition-colors group-hover:text-foreground/80">
            <IconComponent className="h-10 w-10" strokeWidth={1.5} />
          </div>
        )}

        {/* Quick Actions Overlay - Top Right */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <button
            className="rounded-md bg-background/90 p-1.5 text-foreground shadow-sm hover:bg-background hover:text-primary transition-colors border border-border/50 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(file.id);
            }}
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Footer Content */}
      <div className="flex flex-col p-3 gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            {!isImage && <IconComponent className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span className="truncate text-sm font-medium text-foreground leading-none" title={file.name}>
              {file.name}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
          <span>{file.size}</span>
          <div className="flex items-center gap-1.5">
            <span className="uppercase">{file.name.split('.').pop()?.slice(0, 4) || 'FILE'}</span>
            <span>•</span>
            <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
          </div>
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

  const { icon: IconComponent } = getFileStyles(file.mime);
  const isImage = file.mime?.startsWith("image/");

  return (
    <tr className="group hover:bg-muted/50 transition-colors border-b border-border/60 last:border-0 cursor-pointer" onClick={() => onPreview(file.id)}>
      <td className="px-4 pl-6 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-muted/20 flex items-center justify-center transition-colors overflow-hidden shrink-0">
            {isImage && file.thumbnailUrl ? (
              <img
                src={file.thumbnailUrl}
                alt={file.name}
                className="object-cover w-full h-full"
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  el.style.display = "none";
                }}
              />
            ) : (
              <IconComponent className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[300px] text-sm" title={file.name}>
              {file.name}
            </span>
            <span className="text-[10px] text-muted-foreground sm:hidden">
              {file.size}
            </span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">
        {file.size}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={file.mime}>
            {file.mime || "-"}
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            {new Date(file.uploadedAt).toLocaleDateString()}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-right pr-6">
        <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all sm:translate-x-2 sm:group-hover:translate-x-0">
          <button
            onClick={() => onPreview(file.id)}
            className="p-2 rounded-md hover:bg-background hover:text-foreground text-muted-foreground transition-colors border border-transparent hover:border-border hover:shadow-sm"
            aria-label={`Preview ${file.name} `}
            title="Preview"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDownload(file.id)}
            className="p-2 rounded-md hover:bg-background hover:text-foreground text-muted-foreground transition-colors border border-transparent hover:border-border hover:shadow-sm"
            aria-label={`Download ${file.name} `}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
