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
// Applies a 3x3 Laplacian kernel on a downsampled grayscale image.
// High variance = sharp edges = in focus.
// Low variance = blurry / motion blur.

function computeSharpness(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): number {
  // Downsample for speed: work on a 256px wide version
  const sampleWidth = 256;
  const sampleHeight = Math.round((height / width) * sampleWidth);

  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = sampleWidth;
  sampleCanvas.height = sampleHeight;
  const sCtx = sampleCanvas.getContext("2d")!;
  sCtx.drawImage(ctx.canvas, 0, 0, sampleWidth, sampleHeight);

  const imageData = sCtx.getImageData(0, 0, sampleWidth, sampleHeight);
  const pixels = imageData.data;

  // Convert to grayscale array
  const gray: number[] = new Array(sampleWidth * sampleHeight);
  for (let i = 0; i < gray.length; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Apply Laplacian kernel: [0,1,0; 1,-4,1; 0,1,0]
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

// ── SEEK AND CAPTURE ────────────────────────────────────────

function seekAndCapture(
  video: HTMLVideoElement,
  time: number,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): Promise<CandidateFrame> {
  return new Promise((resolve) => {
    video.currentTime = time;
    video.onseeked = () => {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Compute sharpness BEFORE converting to JPEG
      const sharpness = computeSharpness(ctx, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      const base64 = dataUrl.split(",")[1];

      canvas.toBlob(
        (blob) => {
          resolve({
            dataUrl,
            base64,
            blob: blob!,
            timestamp: time,
            sharpness,
          });
        },
        "image/jpeg",
        JPEG_QUALITY,
      );
    };
  });
}

// ── EXTRACT CANDIDATES ──────────────────────────────────────

async function extractCandidates(
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
      if (!duration || duration < 0.5) {
        URL.revokeObjectURL(video.src);
        reject(new Error("Video too short"));
        return;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      // Scale to max 1024px
      const scale = Math.min(1, MAX_IMAGE_SIZE / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      // Evenly spaced timestamps, skip first and last 0.3s
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
        candidates.push(frame);
      }

      URL.revokeObjectURL(video.src);
      resolve(candidates);
    };

    video.load();
  });
}

// ── DIVERSITY SELECTION ─────────────────────────────────────
// From the pool of sharp frames, greedily pick frames that are
// most spread apart in time (= most different camera angles).

function pickDiverseFrames(
  candidates: CandidateFrame[],
  targetCount: number,
): CandidateFrame[] {
  if (candidates.length <= targetCount) return candidates;

  // Sort by sharpness descending, take the sharpest as first pick
  const sorted = [...candidates].sort((a, b) => b.sharpness - a.sharpness);
  const selected: CandidateFrame[] = [sorted[0]];
  const remaining = sorted.slice(1);

  // Greedily pick the next frame that is MOST different from all already selected
  while (selected.length < targetCount && remaining.length > 0) {
    let bestIdx = 0;
    let bestMinDiff = -1;

    for (let i = 0; i < remaining.length; i++) {
      // Minimum timestamp distance to any already-selected frame
      let minDiff = Infinity;
      for (const sel of selected) {
        const diff = Math.abs(remaining[i].timestamp - sel.timestamp);
        minDiff = Math.min(minDiff, diff);
      }
      // We want the candidate whose MINIMUM distance to selected set is LARGEST
      if (minDiff > bestMinDiff) {
        bestMinDiff = minDiff;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  // Sort selected by timestamp so frames are in video order
  selected.sort((a, b) => a.timestamp - b.timestamp);
  return selected;
}

// ── MAIN ENTRY ──────────────────────────────────────────────
// Extracts many candidates, scores sharpness, picks the best N
// that are both sharp AND visually diverse (different angles).

export async function extractBestFrames(
  videoFile: Blob,
  targetFrames = 5,
  totalCandidates = 20,
): Promise<ExtractedFrame[]> {
  const candidates = await extractCandidates(videoFile, totalCandidates);

  // Step 1: throw away anything blurry (below 30% of the sharpest frame)
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
