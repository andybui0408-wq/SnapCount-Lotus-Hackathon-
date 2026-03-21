import type { FlatPrediction } from "./groundingDinoAPI";

export interface FrameDetections {
  frameIndex: number;
  predictions: FlatPrediction[];
  productCounts: Record<string, number>;
  imageWidth: number;
  imageHeight: number;
}

export interface ProductConsensus {
  product: string;
  countsPerFrame: number[];
  mode: number;
  median: number;
  mean: number;
  spread: number;
  confidence: "high" | "medium" | "low";
  framesDetected: number;
  totalFrames: number;
  consensusCount: number;
}

function computeMode(arr: number[]): number {
  const freq: Record<number, number> = {};
  for (const n of arr) {
    freq[n] = (freq[n] || 0) + 1;
  }
  let maxFreq = 0;
  let mode = arr[0];
  for (const [val, count] of Object.entries(freq)) {
    if (count > maxFreq) {
      maxFreq = count;
      mode = Number(val);
    }
  }
  return mode;
}

export function computeConsensus(
  allFrameDetections: FrameDetections[],
  totalFrames: number,
): ProductConsensus[] {
  const allProducts = new Set<string>();
  for (const fd of allFrameDetections) {
    for (const product of Object.keys(fd.productCounts)) {
      allProducts.add(product);
    }
  }

  const results: ProductConsensus[] = [];

  for (const product of allProducts) {
    const countsPerFrame = allFrameDetections.map(
      fd => fd.productCounts[product] || 0,
    );

    const nonZeroCounts = countsPerFrame.filter(c => c > 0);
    const framesDetected = nonZeroCounts.length;
    if (framesDetected === 0) continue;

    const mode = computeMode(nonZeroCounts);
    const sorted = [...nonZeroCounts].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = nonZeroCounts.reduce((a, b) => a + b, 0) / nonZeroCounts.length;
    const spread = sorted[sorted.length - 1] - sorted[0];

    const detectionRate = framesDetected / totalFrames;
    let confidence: "high" | "medium" | "low";
    if (spread <= 1 && detectionRate >= 0.6) {
      confidence = "high";
    } else if (spread <= 3 && detectionRate >= 0.4) {
      confidence = "medium";
    } else {
      confidence = "low";
    }

    const consensusCount = confidence === "high" ? mode : median;

    results.push({
      product,
      countsPerFrame,
      mode,
      median,
      mean: Math.round(mean * 10) / 10,
      spread,
      confidence,
      framesDetected,
      totalFrames,
      consensusCount,
    });
  }

  results.sort((a, b) => {
    const confOrder = { high: 0, medium: 1, low: 2 };
    if (confOrder[a.confidence] !== confOrder[b.confidence]) {
      return confOrder[a.confidence] - confOrder[b.confidence];
    }
    return b.consensusCount - a.consensusCount;
  });

  return results;
}

export function buildFrameDetections(
  perFrameFlat: FlatPrediction[][],
  allDims: { width: number; height: number }[],
): FrameDetections[] {
  return perFrameFlat.map((flat, i) => {
    const productCounts: Record<string, number> = {};
    for (const pred of flat) {
      const cls = pred.catalogMatch || pred.class;
      productCounts[cls] = (productCounts[cls] || 0) + 1;
    }
    return {
      frameIndex: i,
      predictions: flat,
      productCounts,
      imageWidth: allDims[i]?.width || 1024,
      imageHeight: allDims[i]?.height || 768,
    };
  });
}
