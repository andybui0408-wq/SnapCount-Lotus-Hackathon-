import { useState, useRef, useEffect } from "react";
import { useInventoryAnalysis } from "../hooks/useInventoryAnalysis";
import { useScanContext } from "../context/ScanContext";
import BoundingBoxOverlay from "../components/BoundingBoxOverlay";
import VideoCapture from "../components/VideoCapture";
import SummaryCards from "../components/SummaryCards";
import ResultsList from "../components/ResultsList";
import ProductConfirmation from "../components/ProductConfirmation";
import VocabularyEditor from "../components/VocabularyEditor";
import CatalogBuilder from "../components/CatalogBuilder";
import { MAX_IMAGE_SIZE, JPEG_QUALITY } from "../constants/config";

export default function ScanPage() {
  const [mode, setMode] = useState<"quick" | "multi">("multi");
  const [showVocab, setShowVocab] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [productsSaved, setProductsSaved] = useState(false);
  const { photos, setPhotos, setLastResult } = useScanContext();
  const { loading, error, result, analyze } = useInventoryAnalysis();
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

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

  const handleQuickAnalyze = async () => {
    if (photos.length === 0) return;
    setProductsSaved(false);
    await analyze(photos, "quick");
  };

  const handleFramesReady = async (base64Frames: string[]) => {
    setPhotos(base64Frames);
    setSelectedFrame(0);
    setProductsSaved(false);
    await analyze(base64Frames, "multi");
  };

  useEffect(() => {
    if (result) setLastResult(result);
  }, [result]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Scan</h1>
        <div className="header-actions">
          <button className="btn btn-ghost" onClick={() => setShowVocab(true)}>Vocab</button>
          <button className="btn btn-ghost" onClick={() => setShowCatalog(true)}>Catalog</button>
        </div>
      </div>

      <div className="mode-selector">
        <button className={`mode-btn ${mode === "multi" ? "active" : ""}`} onClick={() => setMode("multi")}>
          Multi-angle
        </button>
        <button className={`mode-btn ${mode === "quick" ? "active" : ""}`} onClick={() => setMode("quick")}>
          Quick
        </button>
      </div>

      {mode === "quick" ? (
        <>
          <div className="upload-area">
            {photos.length > 0 ? (
              <div className="preview-container">
                <img src={`data:image/jpeg;base64,${photos[0]}`} alt="Preview" className="preview-img" />
                <button className="btn btn-ghost" onClick={() => setPhotos([])}>Clear</button>
              </div>
            ) : (
              <div className="quick-capture-options">
                <button className="upload-btn" onClick={() => cameraRef.current?.click()}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>Take Photo</span>
                </button>
                <button className="upload-btn" onClick={() => uploadRef.current?.click()}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <span>Upload Image</span>
                </button>
              </div>
            )}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} hidden />
            <input ref={uploadRef} type="file" accept="image/*" onChange={handleFile} hidden />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleQuickAnalyze}
            disabled={loading || photos.length === 0}
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </>
      ) : (
        <VideoCapture onFramesReady={handleFramesReady} />
      )}

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

      {result && (() => {
        const frameAnno = result.angleAnnotations?.[selectedFrame];
        const framePreds = (frameAnno?.predictions?.length ? frameAnno.predictions : result.predictions) || [];
        const frameW = frameAnno?.imageWidth || result.imageWidth || 1024;
        const frameH = frameAnno?.imageHeight || result.imageHeight || 768;
        const frameImg = `data:image/jpeg;base64,${photos[selectedFrame] || photos[0]}`;

        return (
        <>
          {framePreds.length > 0 ? (
            <BoundingBoxOverlay
              imageSrc={frameImg}
              predictions={framePreds}
              imageWidth={frameW}
              imageHeight={frameH}
              items={result.items}
            />
          ) : (
            <div className="bbox-container">
              <img src={frameImg} alt="Result" style={{ width: "100%", borderRadius: "var(--radius-md)" }} />
              {result.items.length === 0 && (
                <p className="text-secondary" style={{ textAlign: "center", marginTop: 4 }}>
                  No detections found. Try a clearer photo.
                </p>
              )}
            </div>
          )}

          {/* Frame selector for multi-angle */}
          {photos.length > 1 && (
            <div className="frame-selector">
              <span className="frame-selector-label">Annotate frame</span>
              <div className="frame-selector-grid">
                {photos.map((photo, i) => (
                  <button
                    key={i}
                    className={`frame-selector-thumb ${i === selectedFrame ? "active" : ""}`}
                    onClick={() => setSelectedFrame(i)}
                  >
                    <img src={`data:image/jpeg;base64,${photo}`} alt={`Frame ${i + 1}`} />
                    <span className="frame-selector-num">{i + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <SummaryCards
            frontCount={result.total_front}
            depthCount={result.total_depth}
            totalItems={result.total_items}
            ocrLabels={result.ocr_texts.length}
          />

          <ResultsList items={result.items} />

          {/* Product confirmation — onboarding + catalog building */}
          {!productsSaved && result.items.length > 0 && (
            <ProductConfirmation
              items={result.items}
              predictions={result.predictions || []}
              photoBase64={photos[0]}
              imageWidth={result.imageWidth || 1024}
              imageHeight={result.imageHeight || 768}
              onSaved={() => setProductsSaved(true)}
            />
          )}
        </>
        );
      })()}

      {showVocab && <VocabularyEditor onClose={() => setShowVocab(false)} />}
      {showCatalog && <CatalogBuilder onClose={() => setShowCatalog(false)} />}
    </div>
  );
}
