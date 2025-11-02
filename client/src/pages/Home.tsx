import { FileDropzone } from "@/components/FileDropzone";
import { FilesList } from "@/components/FilesList";

const Home = () => {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <FileDropzone />
      <FilesList />
    </div>
  );
};

export default Home;
