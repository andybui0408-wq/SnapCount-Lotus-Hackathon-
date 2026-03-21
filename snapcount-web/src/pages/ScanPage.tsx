import { useState } from "react";
import { HomeScreen } from "../components/HomeScreen";
import { AnalyzeScreen } from "../components/AnalyzeScreen";
import { useScan } from "../context/ScanContext";
import { saveRecord, type ScanRecord } from "../services/scanHistory";
import type { MergedResult } from "../types";

type SubScreen = "home" | "analyze";

export function ScanPage() {
  const [sub, setSub] = useState<SubScreen>("home");
  const scan = useScan();

  function handleAnalyze(mode: "single" | "multi-angle", uris: string[], base64s: string[]) {
    scan.setScanData(mode, uris, base64s);
    setSub("analyze");
  }

  function handleResult(result: MergedResult) {
    scan.setResult(result);

    // Auto-save to scan history
    const record: ScanRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      thumbnailUrl: scan.imageUris[0] || "",
      results: {
        items: result.items.map((i) => ({
          name: i.name,
          count: i.totalEstimate,
          ocrText: i.ocrLabels?.[0] || "",
        })),
        totalObjects: result.totalBoxDetections,
        occlusionDelta: result.occlusionDelta,
      },
    };
    saveRecord(record);
  }

  function handleBack() {
    scan.clear();
    setSub("home");
  }

  if (sub === "analyze") {
    return (
      <AnalyzeScreen
        mode={scan.mode}
        imageUris={scan.imageUris}
        base64Images={scan.base64Images}
        onBack={handleBack}
        onRestock={handleResult}
      />
    );
  }

  return <HomeScreen onAnalyze={handleAnalyze} />;
}
