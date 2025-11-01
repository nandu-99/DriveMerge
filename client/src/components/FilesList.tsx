import { File, Download, Trash2, HardDrive } from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  size: string;
  uploadDate: string;
  accounts: number;
  chunks: number;
}

// Mock data
const mockFiles: FileItem[] = [
  {
    id: "1",
    name: "large-video.mp4",
    size: "20 GB",
    uploadDate: "2025-10-30",
    accounts: 2,
    chunks: 2000,
  },
  {
    id: "2",
    name: "presentation.pdf",
    size: "5 GB",
    uploadDate: "2025-10-29",
    accounts: 1,
    chunks: 500,
  },
  {
    id: "3",
    name: "backup-archive.zip",
    size: "15 GB",
    uploadDate: "2025-10-28",
    accounts: 1,
    chunks: 1500,
  },
];

export function FilesList() {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Your Files</h2>
        <span className="text-sm text-muted-foreground">
          {mockFiles.length} file(s) stored
        </span>
      </div>

      <div className="space-y-3">
        {mockFiles.map((file) => (
          <div
            key={file.id}
            className="glass-card p-4 glass-hover flex items-center justify-between"
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                <File className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium mb-1">{file.name}</h3>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{file.size}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" />
                    {file.accounts} account{file.accounts > 1 ? "s" : ""}
                  </span>
                  <span>•</span>
                  <span>{file.chunks} chunks</span>
                  <span>•</span>
                  <span>{file.uploadDate}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-white/40 transition-colors text-primary">
                <Download className="h-5 w-5" />
              </button>
              <button className="p-2 rounded-lg hover:bg-white/40 transition-colors text-destructive">
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
