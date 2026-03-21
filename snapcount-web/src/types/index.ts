export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
  class_id?: number;
  ocr_text?: string;
  source?: string;
  // Triple-model fields
  yolo_label?: string;
  yolo_confidence?: number;
  catalog_match?: string;
  catalog_similarity?: number;
  id_method?: "yoloworld" | "catalog";
}

export interface MergedItem {
  name: string;
  boxCount: number;
  visibleCount: number;
  hiddenCount: number;
  totalEstimate: number;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  ocrLabels?: string[];
}

export interface MergedResult {
  items: MergedItem[];
  boundingBoxes: BoundingBox[];
  totalBoxDetections: number;
  totalVisionEstimate: number;
  occlusionDelta: number;
  sceneDescription: string;
  occlusionSeverity: string;
  occlusionNotes: string;
  imageWidth: number;
  imageHeight: number;
  crossReferenceInsights?: string;
  ocrTexts?: string[];
  inferenceTimeMs?: number;
  scanMode: "single" | "multi-angle";
  photoCount: number;
}

export interface RestockItem {
  name: string;
  current_stock: number;
  reorder_quantity: number;
  estimated_unit_cost_vnd: number;
  estimated_line_total_vnd: number;
  urgency: "critical" | "low" | "restock" | "adequate";
  reason: string;
}

export interface RestockOrder {
  order_id: string;
  generated_at: string;
  store_context: string;
  items: RestockItem[];
  total_items_to_order: number;
  estimated_total_cost_vnd: number;
  estimated_total_cost_usd: number;
  summary: string;
  recommended_action: string;
}
