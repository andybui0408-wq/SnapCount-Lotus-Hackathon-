import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ScanProvider } from "./context/ScanContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ScanProvider>
      <App />
    </ScanProvider>
  </StrictMode>
);
