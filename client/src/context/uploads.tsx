import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type UploadStatus = "uploading" | "done" | "error" | "cancelled";

export type UploadItem = {
  id: string;
  name: string;
  size: number;
  progress: number; // 0-100
  status: UploadStatus;
  startedAt: string;
};

type UploadsContextValue = {
  uploads: UploadItem[];
  addUpload: (
    u: Omit<UploadItem, "progress" | "status" | "startedAt">
  ) => string;
  updateProgress: (id: string, progress: number) => void;
  markDone: (id: string) => void;
  markError: (id: string) => void;
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

  const updateProgress = useCallback((id: string, progress: number) => {
    setUploads((s) => s.map((it) => (it.id === id ? { ...it, progress } : it)));
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

  const removeUpload = useCallback((id: string) => {
    setUploads((s) => s.filter((it) => it.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      uploads,
      addUpload,
      updateProgress,
      markDone,
      markError,
      removeUpload,
    }),
    [uploads, addUpload, updateProgress, markDone, markError, removeUpload]
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
