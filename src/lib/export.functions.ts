import { supabase } from "@/integrations/supabase/client";
import type { ConsolidatedStockItem } from "./export-import.schemas";
import { normalizeCategory, convertUnit, canonicalUnit, type Unit } from "./normalize";
import {
  classifyNutritionRelevance,
  type NutritionRelevance,
} from "./nutrition-relevance";

export async function exportProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_nutrition(*)")
    .order("name");
  if (error) throw new Error(error.message);
  return { products: data ?? [] };
}

/**
 * Export detallado: una fila por stock_item (versión legacy/auditable).
 */
export async function exportStockDetailed() {
  const { data, error } = await supabase
    .from("stock_items")
    .select("*, products(name, brand)")
    .neq("status", "consumed")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { stock: data ?? [] };
}

// Alias por compatibilidad
export const exportStock = exportStockDetailed;

export async function exportMovements() {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*, products(name, brand)")
    .order("moved_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { movements: data ?? [] };
}

/**
 * Export detallado del stock (legacy): una fila por stock_item.
 * Mantenido para auditoría y exports finos.
 */
export async function exportStockDetailedConsolidated() {
  const { data, error } = await supabase
    .from("stock_items")
    .select(
      "*, products(id, name, brand, category, subcategory, suitability_tags, allergens, source, nutrition_source_type, product_nutrition(kcal_per_100g, kcal_per_100ml, protein_per_100g, protein_per_100ml, carbs_per_100g, carbs_per_100ml, fat_per_100g, fat_per_100ml, fiber_per_100g, fiber_per_100ml, sugars_per_100g, sugars_per_100ml, saturated_fat_per_100g, saturated_fat_per_100ml, salt_per_100g, salt_per_100ml))",
    )
    .neq("status", "consumed");

  if (error) throw new Error(error.message);

  const consolidated: ConsolidatedStockItem[] = (data ?? []).map((s: any) => {
    const p = s.products;
    const n = Array.isArray(p?.product_nutrition) ? p.product_nutrition[0] : p?.product_nutrition;
    return {
      product_id: s.product_id,
      stock_item_id: s.id,
      name: p?.name ?? "",
      brand: p?.brand ?? null,
      category: p?.category ?? null,
      subcategory: p?.subcategory ?? null,
      current_quantity: s.quantity,
      unit: s.unit,
      location: s.location,
      expiration_date: s.expiration_date,
      open_status: s.open_status ?? null,
      kcal_per_100g: n?.kcal_per_100g ?? null,
      kcal_per_100ml: n?.kcal_per_100ml ?? null,
      protein_per_100g: n?.protein_per_100g ?? null,
      protein_per_100ml: n?.protein_per_100ml ?? null,
      carbs_per_100g: n?.carbs_per_100g ?? null,
      carbs_per_100ml: n?.carbs_per_100ml ?? null,
      fat_per_100g: n?.fat_per_100g ?? null,
      fat_per_100ml: n?.fat_per_100ml ?? null,
      fiber_per_100g: n?.fiber_per_100g ?? null,
      fiber_per_100ml: n?.fiber_per_100ml ?? null,
      sugars_per_100g: n?.sugars_per_100g ?? null,
      sugars_per_100ml: n?.sugars_per_100ml ?? null,
      saturated_fat_per_100g: n?.saturated_fat_per_100g ?? null,
      saturated_fat_per_100ml: n?.saturated_fat_per_100ml ?? null,
      salt_per_100g: n?.salt_per_100g ?? null,
      salt_per_100ml: n?.salt_per_100ml ?? null,
      suitability_tags: p?.suitability_tags ?? null,
      allergens: p?.allergens ?? null,
      source: p?.source ?? null,
      nutrition_source_type: p?.nutrition_source_type ?? null,
    };
  });

  return {
    exported_at: new Date().toISOString(),
    item_count: consolidated.length,
    items: consolidated,
  };
}

// ============================================================================
// CONSOLIDATED EXPORT (real, una fila por producto) — para IA
// ============================================================================

export interface ConsolidatedProduct {
  product_id: string;
  name: string;
  brand: string | null;
  category: string | null; // ya normalizada
  total_quantity: number | null; // null si hay unidades incompatibles
  unit: "g" | "ml" | "unit" | null; // canónica
  quantity_by_unit: Partial<Record<"g" | "ml" | "unit", number>>;
  locations: string[]; // únicas
  open_items: number;
  sealed_items: number;
  total_items: number;
  nearest_expiration_date: string | null;
  all_expired: boolean;
  // Nutrición — la "basis" (g o ml) viene determinada por la unidad canónica
  nutrition_basis: "100g" | "100ml" | null;
  kcal_per_100: number | null;
  protein_per_100: number | null;
  carbs_per_100: number | null;
  fat_per_100: number | null;
  nutrition_complete: boolean;
  // Relevancia para macros
  nutrition_relevance: NutritionRelevance;
  counts_for_macros: boolean;
  // Coherencia
  source: string | null;
  source_coherent: boolean;
}

export interface DetailedStockItemForAI {
  stock_item_id: string;
  product_id: string;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  location: string | null;
  expiration_date: string | null;
  open_status: string | null;
  /** Prioridad de uso (1 = preferido). Calculada: opened > nearest expiry > created_at. */
  use_priority: number;
}

export interface ConsolidatedExport {
  exported_at: string;
  product_count: number;
  products: ConsolidatedProduct[];
  /** Lista detallada por stock_item — fuente de verdad para los IDs que la IA debe usar. */
  stock_items: DetailedStockItemForAI[];
}

/**
 * Export CONSOLIDADO real: una fila por product_id.
 *
 * Reglas de agregación:
 *  - Cantidad: convertir todo a unidad canónica del producto (kg→g, l→ml).
 *    Si hay unidades incompatibles entre items, total_quantity = null y se
 *    devuelve un desglose en quantity_by_unit.
 *  - Caducidad: nearest = MIN de fechas futuras. Si todas están caducadas,
 *    nearest = MIN absoluto + all_expired = true.
 *  - Abiertos vs cerrados: contadores independientes (no afectan a la suma).
 *  - Nutrición: usa kcal_per_100g/ml según unidad canónica del producto.
 *    Si todos son null → nutrition_complete = false y campos null.
 *  - Source: nutrition_source_type es la autoridad. source_coherent = true si
 *    coincide con products.source.
 */
export async function exportConsolidated(): Promise<ConsolidatedExport> {
  const { data, error } = await supabase
    .from("stock_items")
    .select(
      "*, products(id, name, brand, category, default_unit, source, nutrition_source_type, nutrition_relevance, product_nutrition(kcal_per_100g, kcal_per_100ml, protein_per_100g, protein_per_100ml, carbs_per_100g, carbs_per_100ml, fat_per_100g, fat_per_100ml))",
    )
    .neq("status", "consumed");

  if (error) throw new Error(error.message);

  const groups = new Map<string, any[]>();
  for (const s of data ?? []) {
    const pid = (s as any).product_id;
    if (!groups.has(pid)) groups.set(pid, []);
    groups.get(pid)!.push(s);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const products: ConsolidatedProduct[] = [];

  for (const [product_id, items] of groups) {
    const first = items[0];
    const p = first.products;
    if (!p) continue;

    const productCanonical = canonicalUnit(
      (p.default_unit as Unit) ?? "g",
    );

    // Agrupar cantidad por unidad canónica
    const byUnit: Record<"g" | "ml" | "unit", number> = { g: 0, ml: 0, unit: 0 };
    let openCount = 0;
    let sealedCount = 0;
    const locations = new Set<string>();
    const expirations: number[] = [];

    for (const it of items) {
      const itemUnit = (it.unit as Unit) ?? "g";
      const itemCanonical = canonicalUnit(itemUnit);
      const converted = convertUnit(Number(it.quantity), itemUnit, itemCanonical);
      if (converted != null) {
        byUnit[itemCanonical] += converted;
      }

      if (it.open_status === "opened") openCount++;
      else sealedCount++;

      if (it.location) locations.add(it.location);
      if (it.expiration_date) {
        const t = new Date(it.expiration_date).getTime();
        if (!Number.isNaN(t)) expirations.push(t);
      }
    }

    // Detectar mezcla de unidades reales (cualquier byUnit > 0 distinto de la canónica del producto)
    const usedUnits = (["g", "ml", "unit"] as const).filter((u) => byUnit[u] > 0);
    const hasMixedUnits = usedUnits.length > 1;
    const total_quantity = hasMixedUnits ? null : byUnit[productCanonical] || (usedUnits[0] ? byUnit[usedUnits[0]] : 0);
    const unit: "g" | "ml" | "unit" | null = hasMixedUnits
      ? null
      : usedUnits[0] ?? productCanonical;

    // Caducidad
    const futures = expirations.filter((t) => t >= today.getTime());
    let nearest_expiration_date: string | null = null;
    let all_expired = false;
    if (futures.length > 0) {
      nearest_expiration_date = new Date(Math.min(...futures))
        .toISOString()
        .slice(0, 10);
    } else if (expirations.length > 0) {
      nearest_expiration_date = new Date(Math.min(...expirations))
        .toISOString()
        .slice(0, 10);
      all_expired = true;
    }

    // Nutrición
    const n: any = Array.isArray(p.product_nutrition)
      ? p.product_nutrition[0]
      : p.product_nutrition;

    const basis: "100g" | "100ml" | null =
      productCanonical === "g" ? "100g" : productCanonical === "ml" ? "100ml" : null;

    const pickNum = (key: string): number | null => {
      const v = n?.[key];
      return v != null ? Number(v) : null;
    };

    const kcal = basis === "100g" ? pickNum("kcal_per_100g") : basis === "100ml" ? pickNum("kcal_per_100ml") : null;
    const protein = basis === "100g" ? pickNum("protein_per_100g") : basis === "100ml" ? pickNum("protein_per_100ml") : null;
    const carbs = basis === "100g" ? pickNum("carbs_per_100g") : basis === "100ml" ? pickNum("carbs_per_100ml") : null;
    const fat = basis === "100g" ? pickNum("fat_per_100g") : basis === "100ml" ? pickNum("fat_per_100ml") : null;

    const nutrition_complete =
      kcal != null && protein != null && carbs != null && fat != null;

    // Coherencia source
    const authority = p.nutrition_source_type ?? p.source ?? null;
    const source_coherent =
      p.source == null ||
      p.nutrition_source_type == null ||
      p.source === p.nutrition_source_type;

    // Compactar quantity_by_unit (solo unidades con valor)
    const quantity_by_unit: Partial<Record<"g" | "ml" | "unit", number>> = {};
    for (const u of usedUnits) {
      quantity_by_unit[u] = Math.round(byUnit[u] * 100) / 100;
    }

    const relevance = classifyNutritionRelevance({
      name: p.name,
      category: p.category,
      nutrition_relevance: (p as any).nutrition_relevance ?? null,
    });

    products.push({
      product_id,
      name: p.name,
      brand: p.brand ?? null,
      category: normalizeCategory(p.category),
      total_quantity: total_quantity != null ? Math.round(total_quantity * 100) / 100 : null,
      unit,
      quantity_by_unit,
      locations: Array.from(locations),
      open_items: openCount,
      sealed_items: sealedCount,
      total_items: items.length,
      nearest_expiration_date,
      all_expired,
      nutrition_basis: basis,
      kcal_per_100: kcal,
      protein_per_100: protein,
      carbs_per_100: carbs,
      fat_per_100: fat,
      nutrition_complete,
      nutrition_relevance: relevance,
      counts_for_macros: relevance !== "ignore",
      source: authority,
      source_coherent,
    });
  }

  // Ordenar productos por nombre
  products.sort((a, b) => a.name.localeCompare(b.name, "es"));

  // ───────────────────────────────────────────────────────────────────
  // Bloque DETALLADO por stock_item (para que la IA NO invente IDs)
  // ───────────────────────────────────────────────────────────────────
  const stockItemsDetailed: DetailedStockItemForAI[] = [];
  for (const [, items] of groups) {
    // Priorizar: opened > nearest expiry > created_at
    const sorted = [...items].sort((a: any, b: any) => {
      const aOpen = a.open_status === "opened" ? 0 : 1;
      const bOpen = b.open_status === "opened" ? 0 : 1;
      if (aOpen !== bOpen) return aOpen - bOpen;

      const aExp = a.expiration_date ? new Date(a.expiration_date).getTime() : Infinity;
      const bExp = b.expiration_date ? new Date(b.expiration_date).getTime() : Infinity;
      if (aExp !== bExp) return aExp - bExp;

      const aCre = new Date(a.created_at).getTime();
      const bCre = new Date(b.created_at).getTime();
      return aCre - bCre;
    });

    sorted.forEach((it: any, idx: number) => {
      stockItemsDetailed.push({
        stock_item_id: it.id,
        product_id: it.product_id,
        name: it.products?.name ?? "",
        brand: it.products?.brand ?? null,
        quantity: Number(it.quantity),
        unit: it.unit,
        location: it.location ?? null,
        expiration_date: it.expiration_date ?? null,
        open_status: it.open_status ?? null,
        use_priority: idx + 1,
      });
    });
  }

  // Orden global por nombre + prioridad para legibilidad
  stockItemsDetailed.sort((a, b) => {
    const n = a.name.localeCompare(b.name, "es");
    return n !== 0 ? n : a.use_priority - b.use_priority;
  });

  return {
    exported_at: new Date().toISOString(),
    product_count: products.length,
    products,
    stock_items: stockItemsDetailed,
  };
}
