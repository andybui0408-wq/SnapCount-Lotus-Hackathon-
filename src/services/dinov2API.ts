import { HUGGINGFACE_TOKEN, HUGGINGFACE_DINOV2_URL } from "../constants/config";

export async function getEmbedding(imageBlob: Blob): Promise<number[]> {
  const headers: Record<string, string> = {};
  if (HUGGINGFACE_TOKEN) {
    headers["Authorization"] = `Bearer ${HUGGINGFACE_TOKEN}`;
  }

  const res = await fetch(HUGGINGFACE_DINOV2_URL, {
    method: "POST",
    headers,
    body: imageBlob, // raw Blob, NOT base64
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    // Handle HuggingFace cold start
    if (errBody.error && errBody.error.includes("loading")) {
      await new Promise((r) => setTimeout(r, 10000));
      const retry = await fetch(HUGGINGFACE_DINOV2_URL, {
        method: "POST",
        headers,
        body: imageBlob,
      });
      if (!retry.ok) throw new Error("DINOv2 model still loading");
      const retryData = await retry.json();
      return unwrapEmbedding(retryData);
    }
    throw new Error(`DINOv2 error: ${errBody.error || res.status}`);
  }

  const data = await res.json();
  return unwrapEmbedding(data);
}

function unwrapEmbedding(data: unknown): number[] {
  let embedding = data;
  while (Array.isArray(embedding) && Array.isArray(embedding[0])) {
    embedding = embedding[0];
  }
  return embedding as number[];
}
