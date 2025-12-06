import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { UploadsProvider } from "./context/uploads";
import { ThemeProvider } from "@/components/theme-provider";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <UploadsProvider>
      <App />
    </UploadsProvider>
  </ThemeProvider>
);
