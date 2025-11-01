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
            description: `${file.name} uploaded (simulated)`,
          });
        }}
        onUploadError={(err) => {
          toast({
            title: "Upload error",
            description: err.message,
            variant: "destructive",
          });
        }}
        acceptedFileTypes={["image/png", "image/jpeg", "image/svg+xml", "image/gif", "application/pdf"]}
        maxFileSize={20 * 1024 * 1024}
      />
    </div>
  );
}

export default FileDropzone;
