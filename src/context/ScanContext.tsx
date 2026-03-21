import { createContext, useContext, useState, type ReactNode } from "react";
import type { ScanResult } from "../types";

interface ScanContextType {
  photos: string[];
  setPhotos: (photos: string[]) => void;
  lastResult: ScanResult | null;
  setLastResult: (result: ScanResult | null) => void;
}

const ScanContext = createContext<ScanContextType | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);

  return (
    <ScanContext.Provider value={{ photos, setPhotos, lastResult, setLastResult }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScanContext() {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScanContext must be inside ScanProvider");
  return ctx;
}
