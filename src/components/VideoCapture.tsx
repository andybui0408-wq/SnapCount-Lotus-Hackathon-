import { useState, useRef, useEffect, useCallback } from "react";
import { extractBestFrames, computeSharpness, selectBestFromCaptures } from "../services/frameExtractor";
import type { LiveCapture } from "../services/frameExtractor";
import type { ExtractedFrame } from "../types";
import { MAX_IMAGE_SIZE, JPEG_QUALITY } from "../constants/config";

type CaptureMode = "idle" | "previewing" | "recording" | "recorded";

interface Props {
  onFramesReady: (base64Frames: string[]) => void;
}

const MAX_DURATION = 10;
const TARGET_FRAMES = 3;
const TOTAL_CANDIDATES = 12;
const CAPTURE_INTERVAL_MS = 500;

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

  const captureTimerRef = useRef<number>(0);
  const capturedRef = useRef<LiveCapture[]>([]);
  const startTimeRef = useRef<number>(0);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.setAttribute("webkit-playsinline", "true");
      videoRef.current.setAttribute("x-webkit-airplay", "deny");
    }
  }, []);

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

  useEffect(() => {
    startCamera();
  }, [startCamera]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(() => {
    if (isRecordingRef.current) return;
    const stream = streamRef.current;
    if (!stream) return;

    isRecordingRef.current = true;
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
      isRecordingRef.current = false;
      clearInterval(captureTimerRef.current);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      setMode("recorded");

      const captures = capturedRef.current;
      if (captures.length >= 2) {
        const selected = selectBestFromCaptures(captures, TARGET_FRAMES);
        setFrames(selected);
      } else {
        setFrames(captures.map((c) => ({ ...c, blob: new Blob() })));
      }
    };

    recorder.start();
    setMode("recording");

    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }

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

    const captureCanvas = document.createElement("canvas");
    const captureCtx = captureCanvas.getContext("2d")!;
    let canvasReady = false;

    captureTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0) return;

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
        // Canvas draw can fail if video not ready
      }
    }, CAPTURE_INTERVAL_MS);
  }, [stopCamera]);

  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(captureTimerRef.current);
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

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
    setTimeout(() => startCamera(), 100);
  }, [stopRecording, stopCamera, startCamera]);

  const handleAnalyze = () => {
    if (frames.length === 0) return;
    onFramesReady(frames.map((f) => f.base64));
  };

  useEffect(() => {
    return () => {
      stopCamera();
      clearInterval(timerRef.current);
      clearInterval(captureTimerRef.current);
    };
  }, [stopCamera]);

  const remaining = Math.ceil(Math.max(0, MAX_DURATION - elapsed));
  const progress = Math.min(1, elapsed / MAX_DURATION);

  return (
    <div className={`video-capture ${mode === "recording" ? "vc-is-fullscreen" : ""}`}>
      {/* Fullscreen recording mode */}
      {mode === "recording" ? (
        <div className="vc-fullscreen">
          <video
            ref={videoRef}
            className="vc-fullscreen-video"
            autoPlay
            muted
            playsInline
            disablePictureInPicture
          />

          {/* Top bar: REC + countdown */}
          <div className="vc-fs-top">
            <div className="vc-rec-badge">
              <span className="vc-rec-dot" />
              REC
            </div>
            <div className="vc-fs-countdown">{remaining}s</div>
          </div>

          {/* Progress bar */}
          <div className="vc-fs-progress-track">
            <div className="vc-fs-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>

          {/* Bottom: stop button */}
          <div className="vc-fs-bottom">
            <button className="vc-fs-stop-btn" onClick={stopRecording}>
              <span className="vc-fs-stop-square" />
            </button>
            <span className="vc-fs-stop-label">Tap to stop</span>
          </div>
        </div>
      ) : (
        <>
          {/* Normal viewfinder */}
          <div className="vc-viewfinder">
            <video
              ref={videoRef}
              className="vc-video"
              autoPlay
              muted
              playsInline
              disablePictureInPicture
              loop={mode === "recorded"}
            />

            {mode === "idle" && (
              <div className="vc-idle-overlay">
                <button className="btn btn-primary" onClick={startCamera}>
                  Open Camera
                </button>
              </div>
            )}

            {extracting && (
              <div className="vc-extracting-overlay">
                <div className="spinner" />
                <span>Selecting best frames...</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="vc-controls">
            {mode === "previewing" && (
              <button className="vc-record-btn" onClick={startRecording}>
                <span className="vc-record-inner" />
                <span className="vc-record-label">Record</span>
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

          {/* Captured frames preview */}
          {frames.length > 0 && (
            <div className="vc-frames">
              <p className="text-secondary" style={{ fontSize: 12 }}>
                {frames.length} frames captured
              </p>
              <div className="vc-frame-grid-3">
                {frames.map((f, i) => (
                  <div key={i} className="vc-frame-thumb">
                    <img src={f.dataUrl} alt={`Frame ${i + 1}`} />
                    <span className="vc-frame-label">{f.timestamp.toFixed(1)}s</span>
                  </div>
                ))}
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
        </>
      )}
    </div>
  );
}
