import { FileDropzone } from "@/components/FileDropzone";
import { FilesList } from "@/components/FilesList";

const Home = () => {
  return (
    <div className="space-y-6">
      <FileDropzone />
      <FilesList />
    </div>
  );
};

export default Home;
