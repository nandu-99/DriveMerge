import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { UploadsProvider } from "./context/uploads";

createRoot(document.getElementById("root")!).render(
  <UploadsProvider>
    <App />
  </UploadsProvider>
);
