import type { DinoPrediction, DinoResponse } from "../services/groundingDinoAPI";
import type { MultiAngleResult, SinglePhotoResult } from "../services/geminiMultiAngle";

export type { DinoPrediction, DinoResponse };
export type { MultiAngleResult, SinglePhotoResult };

export interface MergedPrediction {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  dino_label: string;
  catalog_match: string | null;
  catalog_similarity: number;
  id_method: "catalog" | "grounding-dino" | "unmatched";
}

export interface MergedItem {
  name: string;
  front_visible: number;
  depth_visible: number;
  total: number;
  id_method: "catalog" | "grounding-dino" | "gemini" | "unmatched";
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

export type TabId = "scan" | "dashboard" | "restock" | "history";
