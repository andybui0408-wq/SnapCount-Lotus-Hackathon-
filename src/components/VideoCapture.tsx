import { useState, useRef, useEffect, useCallback } from "react";
import { extractBestFrames, computeSharpness, selectBestFromCaptures } from "../services/frameExtractor";
import type { LiveCapture } from "../services/frameExtractor";
import type { ExtractedFrame } from "../types";
import { MAX_IMAGE_SIZE, JPEG_QUALITY } from "../constants/config";

type CaptureMode = "idle" | "previewing" | "recording" | "recorded";

interface Props {
  onFramesReady: (base64Frames: string[]) => void;
}

const MAX_DURATION = 10; // seconds
const TARGET_FRAMES = 5;
const TOTAL_CANDIDATES = 20;
const CAPTURE_INTERVAL_MS = 500; // capture a frame every 500ms during recording

const GUIDANCE: { start: number; end: number; text: string }[] = [
  { start: 0, end: 3, text: "Start facing the shelf straight on" },
  { start: 3, end: 7, text: "Now slowly move to the side \u2192" },
  { start: 7, end: 10, text: "Keep going for the other angle" },
];

export default function VideoCapture({ onFramesReady }: Props) {
  const [mode, setMode] = useState<CaptureMode>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live frame capture during recording
  const captureTimerRef = useRef<number>(0);
  const capturedRef = useRef<LiveCapture[]>([]);
  const startTimeRef = useRef<number>(0);

  // Start camera preview
  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setMode("previewing");
    } catch {
      setError("Camera not available. Use the upload button instead.");
      setMode("idle");
    }
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Start recording — also begins live frame capture
  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    capturedRef.current = [];
    setElapsed(0);
    setFrames([]);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      clearInterval(captureTimerRef.current);
      const blob = new Blob(chunksRef.current, { type: mimeType });
      stopCamera();

      // Show recorded video playback
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = URL.createObjectURL(blob);
        videoRef.current.play();
      }

      setMode("recorded");

      // Use frames captured DURING recording (instant, no blob extraction)
      const captures = capturedRef.current;
      console.log("[VideoCapture] Live captures: %d frames", captures.length);

      if (captures.length >= 2) {
        const selected = selectBestFromCaptures(captures, TARGET_FRAMES);
        setFrames(selected);
      } else {
        // Very short recording — just use what we have
        setFrames(captures.map((c) => ({
          ...c,
          blob: new Blob(),
        })));
      }
    };

    recorder.start();
    setMode("recording");

    // Timer
    const startTime = Date.now();
    startTimeRef.current = startTime;
    timerRef.current = window.setInterval(() => {
      const sec = (Date.now() - startTime) / 1000;
      setElapsed(sec);
      if (sec >= MAX_DURATION) {
        clearInterval(timerRef.current);
        clearInterval(captureTimerRef.current);
        if (recorder.state === "recording") recorder.stop();
      }
    }, 100);

    // Live frame capture — grab frames from the live video stream
    const captureCanvas = document.createElement("canvas");
    const captureCtx = captureCanvas.getContext("2d")!;
    let canvasReady = false;

    captureTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;

      // Initialize canvas size on first valid frame
      if (!canvasReady) {
        const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(video.videoWidth, video.videoHeight));
        captureCanvas.width = Math.round(video.videoWidth * scale);
        captureCanvas.height = Math.round(video.videoHeight * scale);
        canvasReady = true;
      }

      try {
        captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        const sharpness = computeSharpness(captureCtx, captureCanvas.width, captureCanvas.height);
        const dataUrl = captureCanvas.toDataURL("image/jpeg", JPEG_QUALITY);
        const base64 = dataUrl.split(",")[1];

        capturedRef.current.push({
          dataUrl,
          base64,
          timestamp: (Date.now() - startTimeRef.current) / 1000,
          sharpness,
        });
      } catch {
        // Canvas draw can fail if video not ready yet
      }
    }, CAPTURE_INTERVAL_MS);
  }, [stopCamera]);

  // Stop recording
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(captureTimerRef.current);
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  // Extract best frames from uploaded video file (blob-based)
  const doExtractFrames = async (blob: Blob) => {
    setExtracting(true);
    setError(null);
    try {
      const extracted = await extractBestFrames(blob, TARGET_FRAMES, TOTAL_CANDIDATES);
      setFrames(extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract frames");
    }
    setExtracting(false);
  };

  // Handle file upload fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    stopCamera();

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = URL.createObjectURL(file);
      videoRef.current.play();
    }

    setMode("recorded");
    await doExtractFrames(file);
  };

  // Reset to initial state
  const handleReset = useCallback(() => {
    stopRecording();
    stopCamera();
    capturedRef.current = [];
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = "";
    }
    setMode("idle");
    setElapsed(0);
    setFrames([]);
    setError(null);
  }, [stopRecording, stopCamera]);

  // Analyze with extracted frames
  const handleAnalyze = () => {
    if (frames.length === 0) return;
    onFramesReady(frames.map((f) => f.base64));
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      clearInterval(timerRef.current);
      clearInterval(captureTimerRef.current);
    };
  }, [stopCamera]);

  // Get current guidance text
  const guidanceText = GUIDANCE.find((g) => elapsed >= g.start && elapsed < g.end)?.text || "";

  // Compute max sharpness for normalizing bars
  const maxSharpness = frames.length > 0 ? Math.max(...frames.map((f) => f.sharpness)) : 1;

  return (
    <div className="video-capture">
      {/* Viewfinder */}
      <div className="vc-viewfinder">
        <video
          ref={videoRef}
          className="vc-video"
          muted
          playsInline
          loop={mode === "recorded"}
        />

        {mode === "idle" && (
          <div className="vc-idle-overlay">
            <button className="btn btn-primary" onClick={startCamera}>
              Open Camera
            </button>
          </div>
        )}

        {mode === "recording" && (
          <div className="vc-recording-overlay">
            <div className="vc-rec-indicator">
              <span className="vc-rec-dot" />
              <span className="vc-rec-time">
                {Math.floor(elapsed)}s / {MAX_DURATION}s
              </span>
            </div>
            {guidanceText && <div className="vc-guidance">{guidanceText}</div>}
          </div>
        )}

        {extracting && (
          <div className="vc-extracting-overlay">
            <div className="spinner" />
            <span>Selecting sharpest frames...</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="vc-controls">
        {mode === "previewing" && (
          <button className="vc-record-btn" onClick={startRecording}>
            <span className="vc-record-icon" />
            Record
          </button>
        )}

        {mode === "recording" && (
          <button className="vc-stop-btn" onClick={stopRecording}>
            <span className="vc-stop-icon" />
            Stop
          </button>
        )}

        {mode === "recorded" && (
          <button className="btn btn-ghost" onClick={handleReset}>
            Re-record
          </button>
        )}

        {(mode === "idle" || mode === "previewing") && (
          <>
            <button
              className="btn btn-ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload video instead
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileUpload}
              hidden
            />
          </>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {/* Extracted frames preview */}
      {frames.length > 0 && (
        <div className="vc-frames">
          <p className="text-secondary" style={{ fontSize: 12 }}>
            Selected {frames.length} sharpest frames
          </p>
          <div className="vc-frame-grid-5">
            {frames.map((f, i) => {
              const pct = maxSharpness > 0 ? (f.sharpness / maxSharpness) * 100 : 100;
              const barColor = pct > 70 ? "var(--accent-light)" : "var(--warning)";
              return (
                <div key={i} className="vc-frame-thumb">
                  <img src={f.dataUrl} alt={`Frame ${i + 1}`} />
                  <div className="vc-sharpness-bar">
                    <div
                      className="vc-sharpness-fill"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                  <span className="vc-frame-label">
                    {f.timestamp.toFixed(1)}s
                  </span>
                </div>
              );
            })}
          </div>
          <button
            className="btn btn-primary btn-large"
            onClick={handleAnalyze}
            disabled={extracting}
          >
            Analyze Shelf
          </button>
        </div>
      )}
    </div>
  );
}
