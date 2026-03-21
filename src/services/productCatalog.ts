import { CATALOG_SIMILARITY_THRESHOLD } from "../constants/config";
import { getEmbedding } from "./dinov2API";

const CATALOG_KEY = "countr_catalog";

export interface CatalogProduct {
  name: string;
  embedding: number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export function getCatalog(): CatalogProduct[] {
  const raw = localStorage.getItem(CATALOG_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveCatalog(catalog: CatalogProduct[]): void {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
}

export async function addToCatalog(name: string, imageBlob: Blob): Promise<void> {
  const embedding = await getEmbedding(imageBlob);
  const catalog = getCatalog();
  catalog.push({ name, embedding });
  saveCatalog(catalog);
}

export function removeFromCatalog(name: string): void {
  const catalog = getCatalog().filter((p) => p.name !== name);
  saveCatalog(catalog);
}

export function clearCatalog(): void {
  localStorage.removeItem(CATALOG_KEY);
}

export function listCatalogNames(): string[] {
  return getCatalog().map((p) => p.name);
}

export async function matchCatalog(
  imageBlob: Blob
): Promise<{ name: string | null; similarity: number }> {
  const catalog = getCatalog();
  if (catalog.length === 0) return { name: null, similarity: 0 };

  const query = await getEmbedding(imageBlob);
  let bestName: string | null = null;
  let bestSim = 0;

  for (const product of catalog) {
    const sim = cosineSimilarity(query, product.embedding);
    if (sim > bestSim) {
      bestSim = sim;
      bestName = product.name;
    }
  }

  if (bestSim >= CATALOG_SIMILARITY_THRESHOLD) {
    return { name: bestName, similarity: bestSim };
  }
  return { name: null, similarity: bestSim };
}

export function matchCatalogLocal(
  queryEmbedding: number[]
): { name: string | null; similarity: number } {
  const catalog = getCatalog();
  if (catalog.length === 0) return { name: null, similarity: 0 };

  let bestName: string | null = null;
  let bestSim = 0;

  for (const product of catalog) {
    const sim = cosineSimilarity(queryEmbedding, product.embedding);
    if (sim > bestSim) {
      bestSim = sim;
      bestName = product.name;
    }
  }

  if (bestSim >= CATALOG_SIMILARITY_THRESHOLD) {
    return { name: bestName, similarity: bestSim };
  }
  return { name: null, similarity: bestSim };
}
