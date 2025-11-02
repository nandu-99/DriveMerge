import FileUpload from "@/components/kokonutui/file-upload";
import { useToast } from "@/hooks/use-toast";

export function FileDropzone() {
  const { toast } = useToast();

  return (
    <div className="w-full">
      <FileUpload
        onUploadSuccess={(file) => {
          toast({
            title: "Upload complete",
            description: `${file.name} uploaded`,
          });
        }}
        onUploadError={(err) => {
          toast({
            title: "Upload error",
            description: err.message,
            variant: "destructive",
          });
        }}
        // Allow all file types by default (videos, archives, documents, etc.)
        // If you want to restrict types, pass an explicit array of MIME types.
        // Allow larger uploads (20GB) — server also has a MAX_UPLOAD_BYTES env (default 20GB)
        maxFileSize={20 * 1024 * 1024 * 1024}
      />
    </div>
  );
}

export default FileDropzone;
