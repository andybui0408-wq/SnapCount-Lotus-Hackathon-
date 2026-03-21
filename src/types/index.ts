import type { MultiAngleResult, SinglePhotoResult } from "../services/geminiMultiAngle";

export type { MultiAngleResult, SinglePhotoResult };

export interface MergedPrediction {
  polygon: number[][]; // [[x1,y1], [x2,y2], ...] from Grounding DINO boxes
  confidence: number;
  class: string;
  catalog_match: string | null;
  catalog_similarity: number;
  id_method: "catalog" | "dino" | "unmatched";
}

export interface MergedItem {
  name: string;
  front_visible: number;
  depth_visible: number;
  total: number;
  id_method: "catalog" | "dino" | "gemini" | "unmatched";
  notes?: string;
}

export interface AngleAnnotation {
  predictions: MergedPrediction[];
  imageWidth: number;
  imageHeight: number;
  label: string;
}

export interface ScanResult {
  id: string;
  timestamp: number;
  items: MergedItem[];
  total_front: number;
  total_depth: number;
  total_items: number;
  ocr_texts: string[];
  depth_notes?: string;
  thumbnail?: string;
  predictions?: MergedPrediction[];
  imageWidth?: number;
  imageHeight?: number;
  angleAnnotations?: AngleAnnotation[];
}

export interface InventorySnapshot {
  date: string;
  timestamp: number;
  products: Record<string, number>;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  category: string;
}

export interface RestockItem {
  name: string;
  currentStock: number;
  suggestedQty: number;
  unitPrice: number;
  qty: number;
}

export interface RestockOrder {
  items: RestockItem[];
  supplier: Supplier | null;
  totalCost: number;
  generatedAt: number;
}

export interface ExtractedFrame {
  dataUrl: string;
  base64: string;
  blob: Blob;
  timestamp: number;
  sharpness: number;
}

export type TabId = "home" | "scan" | "dashboard" | "restock" | "history" | "profile";
