import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ScanProvider } from "./context/ScanContext";
import { seedDemoData } from "./services/scanHistory";
import "./index.css";

// Seed demo data + suppliers on first load
seedDemoData();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ScanProvider>
      <App />
    </ScanProvider>
  </StrictMode>
);
