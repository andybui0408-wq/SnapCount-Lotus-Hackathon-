import type { ExtractedFrame } from "../types";
import { MAX_IMAGE_SIZE, JPEG_QUALITY } from "../constants/config";

// ── Shared types ─────────────────────────────────────────────

interface CandidateFrame {
  dataUrl: string;
  base64: string;
  blob: Blob;
  timestamp: number;
  sharpness: number;
}

export interface LiveCapture {
  dataUrl: string;
  base64: string;
  timestamp: number;
  sharpness: number;
}

// ── SHARPNESS SCORING (Laplacian variance) ──────────────────
// Exported so VideoCapture can compute sharpness during recording.

export function computeSharpness(
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

// ── DIVERSITY SELECTION (generic) ───────────────────────────
// Picks frames that are both sharp AND spread apart in time.

function pickDiverse<T extends { timestamp: number; sharpness: number }>(
  candidates: T[],
  targetCount: number,
): T[] {
  if (candidates.length <= targetCount) return candidates;

  const sorted = [...candidates].sort((a, b) => b.sharpness - a.sharpness);
  const selected: T[] = [sorted[0]];
  const remaining = sorted.slice(1);

  while (selected.length < targetCount && remaining.length > 0) {
    let bestIdx = 0;
    let bestMinDiff = -1;

    for (let i = 0; i < remaining.length; i++) {
      let minDiff = Infinity;
      for (const sel of selected) {
        minDiff = Math.min(minDiff, Math.abs(remaining[i].timestamp - sel.timestamp));
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

// ── SELECT BEST FROM LIVE CAPTURES ──────────────────────────
// Used by VideoCapture when frames were captured during recording.
// No blob extraction needed — frames are already in memory.

export function selectBestFromCaptures(
  captures: LiveCapture[],
  targetFrames: number,
): ExtractedFrame[] {
  if (captures.length === 0) return [];

  const maxSharpness = Math.max(...captures.map((c) => c.sharpness));
  const sharpEnough = captures.filter((c) => c.sharpness > maxSharpness * 0.3);
  const pool = sharpEnough.length > 0 ? sharpEnough : captures;

  const selected = pickDiverse(pool, targetFrames);

  return selected.map((c) => ({
    dataUrl: c.dataUrl,
    base64: c.base64,
    blob: new Blob(),
    timestamp: c.timestamp,
    sharpness: c.sharpness,
  }));
}

// ── SEEK AND CAPTURE (with timeout) ─────────────────────────

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

    const timer = setTimeout(() => {
      console.warn("[FrameExtractor] Seek timeout at t=%.1f", time);
      finish();
    }, TIMEOUT_MS);

    video.onseeked = () => {
      clearTimeout(timer);
      finish();
    };

    video.currentTime = time;
  });
}

// ── SEEK-BASED EXTRACTION (used for file uploads) ───────────

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

    // Overall timeout — never hang
    const overallTimer = setTimeout(() => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Seek extraction timed out"));
    }, 30000);

    video.onerror = () => {
      clearTimeout(overallTimer);
      URL.revokeObjectURL(video.src);
      reject(new Error("Failed to load video"));
    };

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!duration || !isFinite(duration) || duration < 0.5) {
        clearTimeout(overallTimer);
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

      clearTimeout(overallTimer);
      URL.revokeObjectURL(video.src);
      resolve(candidates);
    };

    video.load();
  });
}

// ── MAIN ENTRY (for file uploads only) ──────────────────────
// Camera recordings use selectBestFromCaptures() instead.

export async function extractBestFrames(
  videoFile: Blob,
  targetFrames = 5,
  totalCandidates = 20,
): Promise<ExtractedFrame[]> {
  console.log("[FrameExtractor] Extracting from uploaded file (%d candidates)...", totalCandidates);

  let candidates: CandidateFrame[];
  try {
    candidates = await extractViaSeeking(videoFile, totalCandidates);
    if (candidates.length === 0) throw new Error("No frames captured");
    console.log("[FrameExtractor] Got %d candidates via seeking", candidates.length);
  } catch (err) {
    console.warn("[FrameExtractor] Seek failed:", err);
    throw new Error("Could not extract frames from video. Try a shorter clip.");
  }

  const maxSharpness = Math.max(...candidates.map((c) => c.sharpness));
  const sharpEnough = candidates.filter((c) => c.sharpness > maxSharpness * 0.3);

  const selected = pickDiverse(
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
