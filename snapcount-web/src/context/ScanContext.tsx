import { createContext, useContext, useState, type ReactNode } from "react";
import type { MergedResult } from "../types";

interface ScanState {
  mode: "single" | "multi-angle";
  imageUris: string[];
  base64Images: string[];
  result: MergedResult | null;
}

interface ScanContextValue extends ScanState {
  setScanData: (mode: "single" | "multi-angle", uris: string[], base64s: string[]) => void;
  setResult: (r: MergedResult) => void;
  clear: () => void;
}

const ScanContext = createContext<ScanContextValue | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ScanState>({
    mode: "single",
    imageUris: [],
    base64Images: [],
    result: null,
  });

  function setScanData(mode: "single" | "multi-angle", uris: string[], base64s: string[]) {
    setState({ mode, imageUris: uris, base64Images: base64s, result: null });
  }

  function setResult(r: MergedResult) {
    setState((prev) => ({ ...prev, result: r }));
  }

  function clear() {
    setState({ mode: "single", imageUris: [], base64Images: [], result: null });
  }

  return (
    <ScanContext.Provider value={{ ...state, setScanData, setResult, clear }}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScan(): ScanContextValue {
  const ctx = useContext(ScanContext);
  if (!ctx) throw new Error("useScan must be used within ScanProvider");
  return ctx;
}
