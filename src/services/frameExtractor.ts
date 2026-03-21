import type { ExtractedFrame } from "../types";
import { MAX_IMAGE_SIZE, JPEG_QUALITY } from "../constants/config";

// ── Internal candidate type (includes sharpness before selection) ─

interface CandidateFrame {
  dataUrl: string;
  base64: string;
  blob: Blob;
  timestamp: number;
  sharpness: number;
}

// ── SHARPNESS SCORING (Laplacian variance) ──────────────────
function computeSharpness(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): number {
  const sampleWidth = 256;
  const sampleHeight = Math.round((height / width) * sampleWidth);

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sCtx = sampleCanvas.getContext("2d")!;
  sCtx.drawImage(ctx.canvas, 0, 0, sampleWidth, sampleHeight);

  const imageData = sCtx.getImageData(0, 0, sampleWidth, sampleHeight);
  const pixels = imageData.data;

  const gray: number[] = new Array(sampleWidth * sampleHeight);
  for (let i = 0; i < gray.length; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  let sum = 0;
  let count = 0;
  for (let y = 1; y < sampleHeight - 1; y++) {
    for (let x = 1; x < sampleWidth - 1; x++) {
      const idx = y * sampleWidth + x;
      const laplacian =
        gray[idx - sampleWidth] +
        gray[idx - 1] +
        gray[idx + 1] +
        gray[idx + sampleWidth] -
        4 * gray[idx];
      sum += laplacian * laplacian;
      count++;
    }
  }

  return count > 0 ? sum / count : 0;
}

// ── SEEK AND CAPTURE (with timeout fallback) ────────────────
function seekAndCapture(
  video: HTMLVideoElement,
  time: number,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): Promise<CandidateFrame | null> {
  return new Promise((resolve) => {
    const TIMEOUT_MS = 4000;
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      video.onseeked = null;

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const sharpness = computeSharpness(ctx, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        const base64 = dataUrl.split(",")[1];

        canvas.toBlob(
          (blob) => {
            resolve({
              dataUrl,
              base64,
              blob: blob!,
              timestamp: video.currentTime,
              sharpness,
            });
          },
          "image/jpeg",
          JPEG_QUALITY,
        );
      } catch {
        resolve(null);
      }
    };

    // Timeout: if onseeked never fires, capture whatever frame is showing
    const timer = setTimeout(() => {
      console.warn("[FrameExtractor] Seek timeout at t=%.1f — capturing current frame", time);
      finish();
    }, TIMEOUT_MS);

    video.onseeked = () => {
      clearTimeout(timer);
      finish();
    };

    video.currentTime = time;
  });
}

// ── PLAYBACK-BASED EXTRACTION (mobile fallback) ─────────────
// Instead of seeking, plays the video and captures frames at intervals
// using timeupdate events. More reliable on mobile.
async function extractViaPlayback(
  videoFile: Blob,
  count: number,
): Promise<CandidateFrame[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = URL.createObjectURL(videoFile);

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video for playback extraction"));
    };

    video.onloadedmetadata = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const duration = video.duration;
      const effectiveDuration = (!duration || !isFinite(duration)) ? 10 : duration;
      const interval = effectiveDuration / (count + 1);
      const captureTargets = Array.from({ length: count }, (_, i) => interval * (i + 1));

      const candidates: CandidateFrame[] = [];
      let nextTargetIdx = 0;
      let lastCaptureTime = -1;

      const captureFrame = () => {
        if (nextTargetIdx >= captureTargets.length) return;
        // Don't capture the same time twice
        if (Math.abs(video.currentTime - lastCaptureTime) < 0.1) return;

        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const sharpness = computeSharpness(ctx, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
          const base64 = dataUrl.split(",")[1];

          candidates.push({
            dataUrl,
            base64,
            blob: new Blob(), // placeholder, not needed for analysis
            timestamp: video.currentTime,
            sharpness,
          });
          lastCaptureTime = video.currentTime;
          nextTargetIdx++;
        } catch {
          // Canvas draw can fail if video isn't ready
        }
      };

      video.ontimeupdate = () => {
        if (nextTargetIdx >= captureTargets.length) {
          video.pause();
          video.ontimeupdate = null;
          URL.revokeObjectURL(video.src);
          resolve(candidates);
          return;
        }

        if (video.currentTime >= captureTargets[nextTargetIdx]) {
          captureFrame();
        }
      };

      video.onended = () => {
        video.ontimeupdate = null;
        URL.revokeObjectURL(video.src);
        resolve(candidates);
      };

      // Safety timeout — resolve with whatever we have after 15s
      setTimeout(() => {
        if (candidates.length < count) {
          video.pause();
          video.ontimeupdate = null;
          URL.revokeObjectURL(video.src);
          resolve(candidates);
        }
      }, 15000);

      video.playbackRate = 2.0; // Speed up to finish faster
      video.play().catch(() => {
        URL.revokeObjectURL(video.src);
        reject(new Error("Video playback failed"));
      });
    };

    video.load();
  });
}

// ── SEEK-BASED EXTRACTION (desktop, works when seeking is reliable) ─
async function extractViaSeeking(
  videoFile: Blob,
  count: number,
): Promise<CandidateFrame[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = URL.createObjectURL(videoFile);

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video"));
    };

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!duration || !isFinite(duration) || duration < 0.5) {
        // Duration unavailable (common on mobile) — fall back to playback
        URL.revokeObjectURL(video.src);
        reject(new Error("Duration unavailable"));
        return;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const start = Math.min(0.3, duration * 0.05);
      const end = Math.max(duration - 0.3, start + 0.5);
      const interval = count > 1 ? (end - start) / (count - 1) : 0;
      const timestamps = Array.from(
        { length: count },
        (_, i) => Math.min(start + i * interval, duration - 0.1),
      );

      const candidates: CandidateFrame[] = [];
      for (const ts of timestamps) {
        const frame = await seekAndCapture(video, ts, canvas, ctx);
        if (frame) candidates.push(frame);
      }

      URL.revokeObjectURL(video.src);
      resolve(candidates);
    };

    video.load();
  });
}

// ── DIVERSITY SELECTION ─────────────────────────────────────
function pickDiverseFrames(
  candidates: CandidateFrame[],
  targetCount: number,
): CandidateFrame[] {
  if (candidates.length <= targetCount) return candidates;

  const sorted = [...candidates].sort((a, b) => b.sharpness - a.sharpness);
  const selected: CandidateFrame[] = [sorted[0]];
  const remaining = sorted.slice(1);

  while (selected.length < targetCount && remaining.length > 0) {
    let bestIdx = 0;
    let bestMinDiff = -1;

    for (let i = 0; i < remaining.length; i++) {
      let minDiff = Infinity;
      for (const sel of selected) {
        const diff = Math.abs(remaining[i].timestamp - sel.timestamp);
        minDiff = Math.min(minDiff, diff);
      }
      if (minDiff > bestMinDiff) {
        bestMinDiff = minDiff;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  selected.sort((a, b) => a.timestamp - b.timestamp);
  return selected;
}

// ── MAIN ENTRY ──────────────────────────────────────────────
// Tries seek-based extraction first. Falls back to playback-based
// extraction if seeking fails (common on mobile browsers).

export async function extractBestFrames(
  videoFile: Blob,
  targetFrames = 5,
  totalCandidates = 20,
): Promise<ExtractedFrame[]> {
  let candidates: CandidateFrame[];

  try {
    console.log("[FrameExtractor] Trying seek-based extraction (%d candidates)...", totalCandidates);
    candidates = await extractViaSeeking(videoFile, totalCandidates);

    if (candidates.length === 0) throw new Error("No frames captured via seeking");
    console.log("[FrameExtractor] Seek-based: got %d candidates", candidates.length);
  } catch (err) {
    console.warn("[FrameExtractor] Seek failed, falling back to playback:", err);
    candidates = await extractViaPlayback(videoFile, totalCandidates);
    console.log("[FrameExtractor] Playback-based: got %d candidates", candidates.length);
  }

  if (candidates.length === 0) {
    throw new Error("Could not extract any frames from video");
  }

  // Step 1: throw away blurry frames
  const maxSharpness = Math.max(...candidates.map((c) => c.sharpness));
  const sharpEnough = candidates.filter((c) => c.sharpness > maxSharpness * 0.3);

  // Step 2: pick diverse frames from the sharp pool
  const selected = pickDiverseFrames(
    sharpEnough.length > 0 ? sharpEnough : candidates,
    targetFrames,
  );

  return selected.map((c) => ({
    dataUrl: c.dataUrl,
    base64: c.base64,
    blob: c.blob,
    timestamp: c.timestamp,
    sharpness: c.sharpness,
  }));
}
