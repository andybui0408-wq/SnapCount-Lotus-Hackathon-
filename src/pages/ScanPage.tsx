import { useState, useRef, useEffect } from "react";
import { useInventoryAnalysis } from "../hooks/useInventoryAnalysis";
import { useScanContext } from "../context/ScanContext";
import BoundingBoxOverlay from "../components/BoundingBoxOverlay";
import PhotoCollector from "../components/PhotoCollector";
import SummaryCards from "../components/SummaryCards";
import ResultsList from "../components/ResultsList";
import VocabularyEditor from "../components/VocabularyEditor";
import CatalogBuilder from "../components/CatalogBuilder";
import { MAX_IMAGE_SIZE, JPEG_QUALITY } from "../constants/config";

export default function ScanPage() {
  const [mode, setMode] = useState<"quick" | "multi">("multi");
  const [showVocab, setShowVocab] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const { photos, setPhotos, setLastResult } = useScanContext();
  const { loading, error, result, analyze } = useInventoryAnalysis();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > MAX_IMAGE_SIZE || h > MAX_IMAGE_SIZE) {
        const ratio = Math.min(MAX_IMAGE_SIZE / w, MAX_IMAGE_SIZE / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      setPhotos([dataUrl.split(",")[1]]);
    };
    img.src = URL.createObjectURL(file);
    e.target.value = "";
  };

  const handleAnalyze = async () => {
    if (photos.length === 0) return;
    await analyze(photos, mode);
  };

  useEffect(() => {
    if (result) setLastResult(result);
  }, [result]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Scan Inventory</h1>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={() => setShowVocab(true)}>Vocabulary</button>
          <button className="btn btn-ghost" onClick={() => setShowCatalog(true)}>Catalog</button>
        </div>
      </div>

      <div className="mode-selector">
        <button className={`mode-btn ${mode === "multi" ? "active" : ""}`} onClick={() => setMode("multi")}>
          Multi-angle (2-3 photos)
        </button>
        <button className={`mode-btn ${mode === "quick" ? "active" : ""}`} onClick={() => setMode("quick")}>
          Quick Scan (1 photo)
        </button>
      </div>

      {mode === "quick" ? (
        <div className="upload-area">
          {photos.length > 0 ? (
            <div className="preview-container">
              <img src={`data:image/jpeg;base64,${photos[0]}`} alt="Preview" className="preview-img" />
              <button className="btn btn-ghost" onClick={() => setPhotos([])}>Clear</button>
            </div>
          ) : (
            <button className="upload-btn" onClick={() => inputRef.current?.click()}>
              <span className="upload-icon">+</span>
              <span>Take Photo or Upload</span>
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} hidden />
        </div>
      ) : (
        <PhotoCollector
          photos={photos}
          onAddPhoto={(b64) => setPhotos([...photos, b64])}
          onRemovePhoto={(i) => setPhotos(photos.filter((_, idx) => idx !== i))}
          maxPhotos={3}
        />
      )}

      <button
        className="btn btn-primary btn-large"
        onClick={handleAnalyze}
        disabled={loading || photos.length === 0 || (mode === "multi" && photos.length < 2)}
      >
        {loading ? "Analyzing..." : "Analyze Inventory"}
      </button>

      {loading && photos.length > 0 && (
        <div className="scan-loading-overlay">
          <img src={`data:image/jpeg;base64,${photos[0]}`} alt="Analyzing" />
          <div className="scan-loading-content">
            <div className="scan-spinner" />
            <span className="scan-loading-text">Analyzing inventory<span className="scan-loading-dots" /></span>
          </div>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}

      {result && (
        <>
          {/* Per-angle annotated images (multi-angle mode) */}
          {result.angleAnnotations && result.angleAnnotations.length > 0 ? (
            <div className="angle-annotations">
              {result.angleAnnotations.map((ann, i) => (
                <div key={i} className="angle-annotation">
                  <h3 className="angle-label">{ann.label} view</h3>
                  <BoundingBoxOverlay
                    imageSrc={`data:image/jpeg;base64,${photos[i]}`}
                    predictions={ann.predictions}
                    imageWidth={ann.imageWidth}
                    imageHeight={ann.imageHeight}
                    items={result.items}
                  />
                </div>
              ))}
            </div>
          ) : result.predictions && result.predictions.length > 0 ? (
            <BoundingBoxOverlay
              imageSrc={`data:image/jpeg;base64,${photos[0]}`}
              predictions={result.predictions}
              imageWidth={result.imageWidth || 1024}
              imageHeight={result.imageHeight || 768}
              items={result.items}
            />
          ) : (
            <div className="bbox-container">
              <img src={`data:image/jpeg;base64,${photos[0]}`} alt="Result" className="bbox-canvas" />
              <p className="text-secondary" style={{ textAlign: "center", marginTop: 4 }}>
                No bounding boxes detected. Try a clearer photo.
              </p>
            </div>
          )}

          <SummaryCards
            frontCount={result.total_front}
            depthCount={result.total_depth}
            totalItems={result.total_items}
            ocrLabels={result.ocr_texts.length}
          />

          {result.depth_notes && (
            <div className="depth-insight">
              <strong>Depth insight:</strong> {result.depth_notes}
            </div>
          )}

          <ResultsList items={result.items} />
        </>
      )}

      {showVocab && <VocabularyEditor onClose={() => setShowVocab(false)} />}
      {showCatalog && <CatalogBuilder onClose={() => setShowCatalog(false)} />}
    </div>
  );
}
