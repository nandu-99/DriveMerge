import FileUpload from "@/components/kokonutui/file-upload";
import { useToast } from "@/hooks/use-toast";

export function FileDropzone() {
  const { toast } = useToast();

  return (
    <div className="w-full max-w-4xl mx-auto">
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
        maxFileSize={20 * 1024 * 1024 * 1024}
      />
    </div>
  );
}

export default FileDropzone;
