import { z } from "zod";

export const movementImportItemSchema = z.object({
  stock_item_id: z.string().uuid(),
  product_id: z.string().uuid(),
  movement_type: z.enum(["consumption", "adjustment", "waste", "expiry"]),
  quantity_delta: z.number().positive("quantity_delta debe ser > 0"),
  unit: z.enum(["g", "ml", "unit", "kg", "l"]),
  notes: z.string().max(500).nullable().optional().default(null),
});

export const movementImportPayloadSchema = z.object({
  movements: z.array(movementImportItemSchema).min(1).max(100),
});

export type MovementImportItem = z.infer<typeof movementImportItemSchema>;
export type MovementImportPayload = z.infer<typeof movementImportPayloadSchema>;

export interface PreviewMovement extends MovementImportItem {
  product_name: string;
  current_quantity: number;
  current_unit: string;
  resulting_quantity: number;
  resulting_status: string;
  error: string | null;
}

export interface ImportPreviewResult {
  valid: boolean;
  preview: PreviewMovement[];
  errors: string[];
  import_log_id: string;
}

export interface ConsolidatedStockItem {
  product_id: string;
  stock_item_id: string;
  name: string;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  current_quantity: number;
  unit: string;
  location: string | null;
  expiration_date: string | null;
  kcal_per_100g: number | null;
  kcal_per_100ml: number | null;
  protein_per_100g: number | null;
  protein_per_100ml: number | null;
  carbs_per_100g: number | null;
  carbs_per_100ml: number | null;
  fat_per_100g: number | null;
  fat_per_100ml: number | null;
  suitability_tags: string[] | null;
  allergens: string[] | null;
  source: string | null;
  nutrition_source_type: string | null;
}
