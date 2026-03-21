import { useEffect, useRef, useState } from "react";
import { compressImage } from "../services/compressImage";
import { checkServerHealth } from "../services/florenceDetector";
import { COLORS } from "../constants/config";
import { VocabularyEditor } from "./VocabularyEditor";
import { CatalogBuilder } from "./CatalogBuilder";

type Mode = "single" | "multi-angle";

interface Props {
  onAnalyze: (mode: Mode, uris: string[], base64s: string[]) => void;
}

export function HomeScreen({ onAnalyze }: Props) {
  const [mode, setMode] = useState<Mode>("single");
  const [photos, setPhotos] = useState<{ uri: string; base64: string }[]>([]);
  const [processing, setProcessing] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKey, setApiKey] = useState(() => {
    const stored = localStorage.getItem("snapcount_openrouter_key");
    if (stored) return stored;
    const defaultKey = "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";
    localStorage.setItem("snapcount_openrouter_key", defaultKey);
    return defaultKey;
  });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkServerHealth().then(setServerOnline);
  }, []);

  function saveApiKey(key: string) {
    setApiKey(key);
    if (key) localStorage.setItem("snapcount_openrouter_key", key);
    else localStorage.removeItem("snapcount_openrouter_key");
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setProcessing(true);
    try {
      if (mode === "single") {
        const r = await compressImage(files[0]);
        onAnalyze("single", [r.uri], [r.base64]);
      } else {
        const newPhotos = [...photos];
        for (const file of Array.from(files).slice(0, 3 - photos.length)) {
          if (newPhotos.length >= 3) break;
          const r = await compressImage(file);
          newPhotos.push(r);
        }
        setPhotos(newPhotos);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setProcessing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removePhoto(i: number) {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
  }

  function handleModeChange(m: Mode) {
    setMode(m);
    setPhotos([]);
  }

  function handleAnalyzeMulti() {
    if (photos.length < 2) { alert("Need at least 2 photos"); return; }
    onAnalyze("multi-angle", photos.map((p) => p.uri), photos.map((p) => p.base64));
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: COLORS.background }}>
      <input ref={fileRef} type="file" accept="image/*" multiple={mode === "multi-angle"}
        onChange={(e) => handleFiles(e.target.files)} style={{ display: "none" }} />

      {/* Server status banner */}
      {serverOnline === false && (
        <div style={{ padding: "10px 16px", background: COLORS.danger + "22", borderBottom: `1px solid ${COLORS.danger}44`, textAlign: "center" }}>
          <span style={{ color: COLORS.danger, fontSize: 13, fontWeight: 600 }}>
            Florence-2 server offline — run: cd server && uvicorn main:app --port 8000
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "40px 24px 16px", background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ color: COLORS.accentLight, fontSize: 28, fontWeight: 800, letterSpacing: 1, margin: 0 }}>SnapCount</h1>
            <p style={{ color: COLORS.textSecondary, fontSize: 14, margin: "4px 0 0" }}>YOLO-World + Florence-2 OCR + DINOv2</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {serverOnline === true && (
              <span style={{ width: 8, height: 8, borderRadius: 4, background: COLORS.accentLight }} />
            )}
            {serverOnline === null && (
              <span style={{ color: COLORS.textSecondary, fontSize: 10 }}>...</span>
            )}
          </div>
        </div>
      </div>

      {/* Mode selector */}
      <div style={{ display: "flex", gap: 10, padding: 16 }}>
        {(["single", "multi-angle"] as Mode[]).map((m) => (
          <button key={m} onClick={() => handleModeChange(m)} style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10,
            padding: "14px 16px", borderRadius: 12, border: `1.5px solid ${mode === m ? COLORS.accentLight : COLORS.border}`,
            background: mode === m ? "rgba(5,150,105,0.15)" : COLORS.surface, cursor: "pointer",
          }}>
            <span style={{ color: COLORS.accentLight, fontSize: 20, fontWeight: 800, fontFamily: "monospace", width: 26, textAlign: "center" }}>
              {m === "single" ? "1" : "3"}
            </span>
            <div style={{ textAlign: "left" }}>
              <div style={{ color: mode === m ? COLORS.accentLight : COLORS.textSecondary, fontSize: 14, fontWeight: 600 }}>
                {m === "single" ? "Quick Scan" : "Multi-Angle"}
              </div>
              <div style={{ color: COLORS.textSecondary, fontSize: 11, marginTop: 1 }}>
                {m === "single" ? "Single photo analysis" : "2-3 photos, cross-referenced"}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 0 80px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", width: "100%" }}>
          {/* Multi-angle slots */}
          {mode === "multi-angle" && (
            <div style={{ padding: "0 16px 16px" }}>
              <p style={{ color: COLORS.textSecondary, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                Photos ({photos.length}/3)
              </p>
              <div style={{ display: "flex", gap: 10 }}>
                {[0, 1, 2].map((i) => {
                  const photo = photos[i];
                  return (
                    <div key={i} style={{ flex: 1, aspectRatio: "1", maxWidth: 120 }}>
                      {photo ? (
                        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 10, overflow: "hidden", border: `1.5px solid ${COLORS.accentLight}` }}>
                          <img src={photo.uri} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <button onClick={() => removePhoto(i)} style={{
                            position: "absolute", top: 4, right: 4, width: 24, height: 24, borderRadius: 12,
                            background: COLORS.danger, color: "#fff", border: "none", cursor: "pointer",
                            fontSize: 14, fontWeight: 700, lineHeight: "24px", padding: 0,
                          }}>x</button>
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, textAlign: "center", padding: 2 }}>
                            Angle {i + 1}
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => fileRef.current?.click()} style={{
                          width: "100%", height: "100%", borderRadius: 10, border: `1.5px dashed ${COLORS.border}`,
                          background: COLORS.surface, cursor: "pointer", display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          <span style={{ color: COLORS.textSecondary, fontSize: 24, fontWeight: 300 }}>+</span>
                          <span style={{ color: COLORS.textSecondary, fontSize: 9, marginTop: 2 }}>{i < 2 ? "Required" : "Optional"}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload area */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={processing || (mode === "multi-angle" && photos.length >= 3)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              width: "calc(100% - 32px)", margin: "0 16px", padding: "40px 24px", borderRadius: 16,
              border: `2px dashed ${COLORS.border}`, background: COLORS.surface, cursor: "pointer",
              opacity: processing ? 0.5 : 1,
            }}
          >
            <span style={{ fontSize: 48, marginBottom: 12 }}>{processing ? "..." : ""}</span>
            <span style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              {processing ? "Processing..." : mode === "single" ? "Upload Photo" : photos.length >= 3 ? "Max 3 photos" : "Add Photos"}
            </span>
            <span style={{ color: COLORS.textSecondary, fontSize: 13, textAlign: "center" }}>
              {mode === "single" ? "Select an image of your inventory shelf" : `Select up to ${3 - photos.length} more photo(s)`}
            </span>
          </button>

          {/* Analyze multi */}
          {mode === "multi-angle" && photos.length >= 2 && (
            <button onClick={handleAnalyzeMulti} style={{
              display: "block", width: "calc(100% - 32px)", margin: "16px 16px 0", padding: "16px",
              borderRadius: 12, background: COLORS.accent, color: "#fff", fontSize: 16, fontWeight: 700,
              border: "none", cursor: "pointer",
            }}>
              Analyze {photos.length} Photos
            </button>
          )}

          {/* Settings */}
          <div style={{ padding: "24px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>
            {/* API Key */}
            <div style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showKeyInput ? 10 : 0 }}>
                <div>
                  <h3 style={{ color: COLORS.accentLight, fontSize: 14, fontWeight: 700, margin: 0 }}>OpenRouter API Key</h3>
                  <p style={{ color: COLORS.textSecondary, fontSize: 11, margin: "2px 0 0" }}>
                    {apiKey ? "Key set — Gemini AI reasoning enabled" : "Not set — detection only, no hidden item analysis"}
                  </p>
                </div>
                <button onClick={() => setShowKeyInput(!showKeyInput)} style={{
                  background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6,
                  color: COLORS.textSecondary, fontSize: 12, padding: "4px 10px", cursor: "pointer",
                }}>
                  {showKeyInput ? "Hide" : apiKey ? "Change" : "Set"}
                </button>
              </div>
              {showKeyInput && (
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="password" placeholder="sk-or-..." value={apiKey}
                    onChange={(e) => saveApiKey(e.target.value)}
                    style={{
                      flex: 1, background: COLORS.background, border: `1px solid ${COLORS.border}`,
                      borderRadius: 6, color: COLORS.textPrimary, padding: "8px 10px", fontSize: 13,
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Vocabulary & Catalog — only show when server is online */}
            {serverOnline && (
              <>
                <VocabularyEditor />
                <CatalogBuilder />
              </>
            )}

            {/* How it works */}
            <div style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16 }}>
              <h3 style={{ color: COLORS.accentLight, fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>How it works</h3>
              <p style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                1. Upload a photo of your inventory shelf<br />
                2. YOLO-World detects products by name (open vocabulary)<br />
                3. Florence-2 reads text off product labels (OCR)<br />
                4. DINOv2 matches against your product catalog<br />
                5. Gemini AI estimates hidden items (optional, needs API key)<br />
                6. Generate smart restock orders
              </p>
            </div>

            <div style={{ background: COLORS.surface, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 16 }}>
              <h3 style={{ color: COLORS.accentLight, fontSize: 14, fontWeight: 700, margin: "0 0 8px" }}>Triple-Model Architecture</h3>
              <p style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                <strong style={{ color: COLORS.info }}>YOLO-World</strong> — open-vocabulary detection. Describe products as text, get bounding boxes.<br />
                <strong style={{ color: COLORS.info }}>Florence-2</strong> — reads text from labels: "Coca-Cola", "Hảo Hảo".<br />
                <strong style={{ color: COLORS.accentLight }}>DINOv2</strong> — photograph each product once, future detections match against your catalog.<br />
                <strong style={{ color: COLORS.warning }}>Gemini 2.5 Flash</strong> — estimates hidden/occluded items (optional, via OpenRouter).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
