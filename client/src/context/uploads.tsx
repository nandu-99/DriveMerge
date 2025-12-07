import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type UploadStatus = "uploading" | "done" | "error" | "cancelled" | "duplicate";

export type UploadItem = {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: UploadStatus;
  startedAt: string;
  totalChunks?: number;
  currentChunk?: number;
  logs?: Array<{ text: string; type: string; time: string }>;
};

type UploadsContextValue = {
  uploads: UploadItem[];
  addUpload: (
    u: Omit<UploadItem, "progress" | "status" | "startedAt">
  ) => string;
  updateProgress: (id: string, progress: number, data?: { totalChunks?: number; currentChunk?: number; log?: { text: string; type: string; time: string } }) => void;
  updateUploadId: (oldId: string, newId: string) => void;
  markDone: (id: string) => void;
  markError: (id: string) => void;
  markDuplicate: (id: string) => void;
  removeUpload: (id: string) => void;
};

const UploadsContext = createContext<UploadsContextValue | undefined>(
  undefined
);

export const UploadsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const addUpload = useCallback(
    (u: Omit<UploadItem, "progress" | "status" | "startedAt">) => {
      const id =
        u.id ?? String(Date.now()) + Math.random().toString(36).slice(2, 8);
      const item: UploadItem = {
        id,
        name: u.name,
        size: u.size,
        progress: 0,
        status: "uploading",
        startedAt: new Date().toISOString(),
      };
      setUploads((s) => [item, ...s]);
      return id;
    },
    []
  );

  const updateProgress = useCallback((id: string, progress: number, data?: { totalChunks?: number; currentChunk?: number; log?: { text: string; type: string; time: string } }) => {
    setUploads((s) => s.map((it) => {
      if (it.id === id) {
        const newLogs = data?.log ? [...(it.logs || []), data.log] : it.logs;
        return { ...it, progress, totalChunks: data?.totalChunks, currentChunk: data?.currentChunk, logs: newLogs };
      }
      return it;
    }));
  }, []);

  const updateUploadId = useCallback((oldId: string, newId: string) => {
    setUploads((s) => s.map((it) => (it.id === oldId ? { ...it, id: newId } : it)));
  }, []);

  const markDone = useCallback((id: string) => {
    setUploads((s) =>
      s.map((it) =>
        it.id === id ? { ...it, progress: 100, status: "done" } : it
      )
    );
  }, []);

  const markError = useCallback((id: string) => {
    setUploads((s) =>
      s.map((it) => (it.id === id ? { ...it, status: "error" } : it))
    );
  }, []);

  const markDuplicate = useCallback((id: string) => {
    setUploads((s) =>
      s.map((it) => (it.id === id ? { ...it, status: "duplicate" } : it))
    );
  }, []);

  const removeUpload = useCallback((id: string) => {
    setUploads((s) => s.filter((it) => it.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      uploads,
      addUpload,
      updateProgress,
      updateUploadId,
      markDone,
      markError,
      markDuplicate,
      removeUpload,
    }),
    [uploads, addUpload, updateProgress, updateUploadId, markDone, markError, markDuplicate, removeUpload]
  );

  return (
    <UploadsContext.Provider value={value}>{children}</UploadsContext.Provider>
  );
};

export function useUploads() {
  const ctx = useContext(UploadsContext);
  if (!ctx) throw new Error("useUploads must be used within UploadsProvider");
  return ctx;
}
