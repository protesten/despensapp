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
  /** Si el stock_item_id original no existía pero se resolvió desde product_id. */
  resolved_stock_item_id?: string | null;
  /** Hint de diagnóstico: el product_id existe aunque stock_item_id falle. */
  product_id_exists?: boolean;
  /** Hint de diagnóstico: parece haber confusión entre product_id y stock_item_id. */
  ids_swapped_hint?: boolean;
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
  open_status: string | null;
  kcal_per_100g: number | null;
  kcal_per_100ml: number | null;
  protein_per_100g: number | null;
  protein_per_100ml: number | null;
  carbs_per_100g: number | null;
  carbs_per_100ml: number | null;
  fat_per_100g: number | null;
  fat_per_100ml: number | null;
  fiber_per_100g: number | null;
  fiber_per_100ml: number | null;
  sugars_per_100g: number | null;
  sugars_per_100ml: number | null;
  saturated_fat_per_100g: number | null;
  saturated_fat_per_100ml: number | null;
  salt_per_100g: number | null;
  salt_per_100ml: number | null;
  suitability_tags: string[] | null;
  allergens: string[] | null;
  source: string | null;
  nutrition_source_type: string | null;
}

/** Recommended AI response format for documentation */
export const AI_RESPONSE_FORMAT_EXAMPLE = {
  movements: [
    {
      stock_item_id: "<uuid del item de stock>",
      product_id: "<uuid del producto>",
      movement_type: "consumption",
      quantity_delta: 200,
      unit: "g",
      notes: "Cena: arroz con pollo – porción de arroz",
    },
    {
      stock_item_id: "<uuid del item de stock>",
      product_id: "<uuid del producto>",
      movement_type: "consumption",
      quantity_delta: 150,
      unit: "g",
      notes: "Cena: arroz con pollo – porción de pollo",
    },
  ],
};

export const AI_PROMPT_TEMPLATE = `Eres un asistente de planificación de menús. A partir del inventario de despensa que te proporciono en JSON, genera un menú diario (desayuno, comida, cena y snack opcional).

ESTRUCTURA DEL INVENTARIO:
El JSON contiene dos bloques:
- "products": resumen consolidado por producto (totales, nutrición, caducidad agregada). Úsalo para PLANIFICAR el menú.
- "stock_items": lista detallada de cada item físico de stock con su \`stock_item_id\` y \`product_id\` reales. Úsalo OBLIGATORIAMENTE como única fuente para los IDs de los movimientos.

REGLAS DE PLANIFICACIÓN:
1. Usa SOLO productos disponibles en el inventario.
2. Respeta las cantidades disponibles (quantity y unit de cada stock_item).
3. Prioriza productos próximos a caducar (expiration_date más cercana).
4. Prioriza productos abiertos (open_status = "opened").
5. Equilibra macronutrientes usando los datos nutricionales proporcionados.
6. Respeta alérgenos y suitability_tags si los hay.
7. Cada producto incluye \`counts_for_macros\`. Si es \`false\`, el producto puede usarse como ingrediente en la receta pero NO debe sumarse al \`resumen_nutricional\` principal.

REGLAS CRÍTICAS DE IDS (NO INFRINGIR):
A. Copia \`stock_item_id\` y \`product_id\` LITERALMENTE desde el bloque "stock_items". No los inventes, no los completes, no los abrevies.
B. NUNCA intercambies \`product_id\` y \`stock_item_id\`. Son campos distintos con valores distintos.
C. Si para un ingrediente no encuentras un \`stock_item_id\` en "stock_items", NO generes movimiento para ese ingrediente. Mejor omitirlo que inventarlo.
D. Cuando un producto tiene varios stock_items, elige el de menor \`use_priority\` (1 = preferido: ya está abierto o caduca antes).
E. La unidad del movimiento debe coincidir con la unidad del stock_item correspondiente.

FORMATO DE RESPUESTA:
Responde SOLO con un JSON válido con esta estructura exacta:
{
  "menu": {
    "desayuno": { "descripcion": "...", "ingredientes": ["..."] },
    "comida": { "descripcion": "...", "ingredientes": ["..."] },
    "cena": { "descripcion": "...", "ingredientes": ["..."] },
    "snack": { "descripcion": "...", "ingredientes": ["..."] }
  },
  "movements": [
    {
      "stock_item_id": "<uuid copiado literal de stock_items[].stock_item_id>",
      "product_id": "<uuid copiado literal de stock_items[].product_id>",
      "movement_type": "consumption",
      "quantity_delta": <número positivo>,
      "unit": "<g|ml|unit|kg|l — debe coincidir con stock_items[].unit>",
      "notes": "<comida>: <plato> – <ingrediente>"
    }
  ],
  "resumen_nutricional": {
    "kcal_total": <número>,
    "protein_total_g": <número>,
    "carbs_total_g": <número>,
    "fat_total_g": <número>
  }
}

INVENTARIO:
`;
