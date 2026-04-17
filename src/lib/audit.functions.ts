import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeCategory, similarity } from "@/lib/normalize";

export interface MissingNutritionItem {
  product_id: string;
  name: string;
  brand: string | null;
}

export interface DirtyCategoryItem {
  product_id: string;
  name: string;
  raw_category: string;
  normalized: string;
}

export interface IncoherentSourceItem {
  product_id: string;
  name: string;
  source: string | null;
  nutrition_source_type: string | null;
}

export interface DuplicateCandidate {
  a: { product_id: string; name: string; brand: string | null };
  b: { product_id: string; name: string; brand: string | null };
  score: number;
}

export interface AuditReport {
  missing_nutrition: MissingNutritionItem[];
  dirty_categories: DirtyCategoryItem[];
  incoherent_source: IncoherentSourceItem[];
  duplicates: DuplicateCandidate[];
  generated_at: string;
}

/**
 * Audita la despensa del usuario. Devuelve inconsistencias.
 */
export const auditPantry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditReport> => {
    const { supabase } = context;

    const { data: products, error } = await supabase
      .from("products")
      .select(
        "id, name, brand, category, source, nutrition_source_type, product_nutrition(kcal_per_100g, kcal_per_100ml, protein_per_100g, protein_per_100ml, carbs_per_100g, carbs_per_100ml, fat_per_100g, fat_per_100ml)",
      );

    if (error) throw new Error(error.message);

    const missing_nutrition: MissingNutritionItem[] = [];
    const dirty_categories: DirtyCategoryItem[] = [];
    const incoherent_source: IncoherentSourceItem[] = [];

    for (const p of products ?? []) {
      // 1. Sin nutrición
      const n: any = Array.isArray(p.product_nutrition)
        ? p.product_nutrition[0]
        : p.product_nutrition;
      const hasAnyNutrition =
        n &&
        (n.kcal_per_100g != null ||
          n.kcal_per_100ml != null ||
          n.protein_per_100g != null ||
          n.protein_per_100ml != null ||
          n.carbs_per_100g != null ||
          n.carbs_per_100ml != null ||
          n.fat_per_100g != null ||
          n.fat_per_100ml != null);
      if (!hasAnyNutrition) {
        missing_nutrition.push({
          product_id: p.id,
          name: p.name,
          brand: p.brand,
        });
      }

      // 2. Categoría sucia
      if (p.category) {
        const normalized = normalizeCategory(p.category);
        if (normalized && normalized !== p.category) {
          dirty_categories.push({
            product_id: p.id,
            name: p.name,
            raw_category: p.category,
            normalized,
          });
        }
      }

      // 3. Source incoherente
      if (
        p.source != null &&
        p.nutrition_source_type != null &&
        p.source !== p.nutrition_source_type
      ) {
        incoherent_source.push({
          product_id: p.id,
          name: p.name,
          source: p.source,
          nutrition_source_type: p.nutrition_source_type,
        });
      }
    }

    // 4. Duplicados (similitud > 0.8 sobre name+brand)
    const duplicates: DuplicateCandidate[] = [];
    const list = products ?? [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const keyA = `${a.name} ${a.brand ?? ""}`.trim();
        const keyB = `${b.name} ${b.brand ?? ""}`.trim();
        const score = similarity(keyA, keyB);
        if (score >= 0.8 && score < 1) {
          duplicates.push({
            a: { product_id: a.id, name: a.name, brand: a.brand },
            b: { product_id: b.id, name: b.name, brand: b.brand },
            score: Math.round(score * 100) / 100,
          });
        }
      }
    }
    duplicates.sort((x, y) => y.score - x.score);

    return {
      missing_nutrition,
      dirty_categories,
      incoherent_source,
      duplicates: duplicates.slice(0, 50),
      generated_at: new Date().toISOString(),
    };
  });

/**
 * Aplica normalización masiva de categorías en BD.
 * Reescribe products.category con la versión normalizada.
 */
export const applyCategoryNormalization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data: products, error } = await supabase
      .from("products")
      .select("id, category")
      .not("category", "is", null);

    if (error) throw new Error(error.message);

    let updated = 0;
    for (const p of products ?? []) {
      if (!p.category) continue;
      const normalized = normalizeCategory(p.category);
      if (normalized && normalized !== p.category) {
        const { error: upErr } = await supabase
          .from("products")
          .update({ category: normalized })
          .eq("id", p.id);
        if (upErr) throw new Error(upErr.message);
        updated++;
      }
    }

    return { updated };
  });

/**
 * Corrige la coherencia source ↔ nutrition_source_type.
 * nutrition_source_type es la autoridad: copia su valor a source.
 */
export const fixSourceCoherence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data: products, error } = await supabase
      .from("products")
      .select("id, source, nutrition_source_type");

    if (error) throw new Error(error.message);

    let updated = 0;
    for (const p of products ?? []) {
      if (
        p.nutrition_source_type != null &&
        p.source !== p.nutrition_source_type
      ) {
        const { error: upErr } = await supabase
          .from("products")
          .update({ source: p.nutrition_source_type })
          .eq("id", p.id);
        if (upErr) throw new Error(upErr.message);
        updated++;
      }
    }

    return { updated };
  });

/**
 * Fusiona dos productos: mueve stock_items y inventory_movements del
 * producto duplicado al canónico, luego borra el duplicado.
 */
export const mergeProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { canonical_id: string; duplicate_id: string }) => {
      if (!input.canonical_id || !input.duplicate_id) {
        throw new Error("canonical_id y duplicate_id son obligatorios");
      }
      if (input.canonical_id === input.duplicate_id) {
        throw new Error("No se puede fusionar un producto consigo mismo");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Mover stock_items
    const { error: e1 } = await supabase
      .from("stock_items")
      .update({ product_id: data.canonical_id })
      .eq("product_id", data.duplicate_id);
    if (e1) throw new Error(e1.message);

    // Mover movements
    const { error: e2 } = await supabase
      .from("inventory_movements")
      .update({ product_id: data.canonical_id })
      .eq("product_id", data.duplicate_id);
    if (e2) throw new Error(e2.message);

    // Borrar nutrición del duplicado (FK con cascade no garantizada)
    await supabase
      .from("product_nutrition")
      .delete()
      .eq("product_id", data.duplicate_id);

    // Borrar producto duplicado
    const { error: e3 } = await supabase
      .from("products")
      .delete()
      .eq("id", data.duplicate_id);
    if (e3) throw new Error(e3.message);

    return { success: true };
  });
