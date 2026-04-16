import { supabase } from "@/integrations/supabase/client";
import type { ConsolidatedStockItem } from "./export-import.schemas";

export async function exportProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_nutrition(*)")
    .order("name");
  if (error) throw new Error(error.message);
  return { products: data ?? [] };
}

export async function exportStock() {
  const { data, error } = await supabase
    .from("stock_items")
    .select("*, products(name, brand)")
    .neq("status", "consumed")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { stock: data ?? [] };
}

export async function exportMovements() {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*, products(name, brand)")
    .order("moved_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { movements: data ?? [] };
}

export async function exportConsolidated() {
  const { data, error } = await supabase
    .from("stock_items")
    .select("*, products(id, name, brand, category, subcategory, suitability_tags, allergens, source, nutrition_source_type, product_nutrition(kcal_per_100g, kcal_per_100ml, protein_per_100g, protein_per_100ml, carbs_per_100g, carbs_per_100ml, fat_per_100g, fat_per_100ml))")
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
      kcal_per_100g: n?.kcal_per_100g ?? null,
      kcal_per_100ml: n?.kcal_per_100ml ?? null,
      protein_per_100g: n?.protein_per_100g ?? null,
      protein_per_100ml: n?.protein_per_100ml ?? null,
      carbs_per_100g: n?.carbs_per_100g ?? null,
      carbs_per_100ml: n?.carbs_per_100ml ?? null,
      fat_per_100g: n?.fat_per_100g ?? null,
      fat_per_100ml: n?.fat_per_100ml ?? null,
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
