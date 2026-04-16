import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const searchInputSchema = z.object({
  query: z.string().min(1).max(200),
  searchType: z.enum(["text", "barcode"]),
});

export interface OFFProductResult {
  code: string;
  product_name: string;
  brands: string | null;
  categories: string | null;
  ingredients_text: string | null;
  allergens_tags: string[];
  image_url: string | null;
  nutriments: {
    "energy-kcal_100g"?: number;
    "energy-kcal_100ml"?: number;
    proteins_100g?: number;
    proteins_100ml?: number;
    carbohydrates_100g?: number;
    carbohydrates_100ml?: number;
    fat_100g?: number;
    fat_100ml?: number;
    "saturated-fat_100g"?: number;
    "saturated-fat_100ml"?: number;
    fiber_100g?: number;
    fiber_100ml?: number;
    sugars_100g?: number;
    sugars_100ml?: number;
    salt_100g?: number;
    salt_100ml?: number;
  };
  nutriscore_grade?: string;
  nova_group?: number;
}

export interface OFFSuggestion {
  code: string;
  name: string;
  brand: string | null;
  category: string | null;
  ingredients_text: string | null;
  allergens: string[];
  image_url: string | null;
  nutriscore: string | null;
  kcal_per_100g: number | null;
  kcal_per_100ml: number | null;
  protein_per_100g: number | null;
  protein_per_100ml: number | null;
  carbs_per_100g: number | null;
  carbs_per_100ml: number | null;
  fat_per_100g: number | null;
  fat_per_100ml: number | null;
  saturated_fat_per_100g: number | null;
  saturated_fat_per_100ml: number | null;
  fiber_per_100g: number | null;
  fiber_per_100ml: number | null;
  sugars_per_100g: number | null;
  sugars_per_100ml: number | null;
  salt_per_100g: number | null;
  salt_per_100ml: number | null;
}

function n(v: number | undefined): number | null {
  return v != null && !isNaN(v) ? v : null;
}

/** Clean OFF allergen tags: "en:gluten" → "gluten" */
function cleanAllergens(tags: string[] | undefined): string[] {
  if (!tags) return [];
  return tags
    .map((t) => t.replace(/^[a-z]{2}:/, "").trim())
    .filter(Boolean);
}

function mapProduct(p: OFFProductResult): OFFSuggestion {
  const nm = p.nutriments ?? {};
  return {
    code: p.code,
    name: p.product_name || "Sin nombre",
    brand: p.brands || null,
    category: p.categories?.split(",")[0]?.trim() || null,
    ingredients_text: p.ingredients_text || null,
    allergens: cleanAllergens(p.allergens_tags),
    image_url: p.image_url || null,
    nutriscore: p.nutriscore_grade || null,
    kcal_per_100g: n(nm["energy-kcal_100g"]),
    kcal_per_100ml: n(nm["energy-kcal_100ml"]),
    protein_per_100g: n(nm.proteins_100g),
    protein_per_100ml: n(nm.proteins_100ml),
    carbs_per_100g: n(nm.carbohydrates_100g),
    carbs_per_100ml: n(nm.carbohydrates_100ml),
    fat_per_100g: n(nm.fat_100g),
    fat_per_100ml: n(nm.fat_100ml),
    saturated_fat_per_100g: n(nm["saturated-fat_100g"]),
    saturated_fat_per_100ml: n(nm["saturated-fat_100ml"]),
    fiber_per_100g: n(nm.fiber_100g),
    fiber_per_100ml: n(nm.fiber_100ml),
    sugars_per_100g: n(nm.sugars_100g),
    sugars_per_100ml: n(nm.sugars_100ml),
    salt_per_100g: n(nm.salt_100g),
    salt_per_100ml: n(nm.salt_100ml),
  };
}

const OFF_USER_AGENT = "DespensApp/1.0 (contact@despensapp.com)";

export const searchOFFProducts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => searchInputSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      if (data.searchType === "barcode") {
        // Barcode lookup: exact match
        const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(data.query)}.json`;
        const res = await fetch(url, {
          headers: { "User-Agent": OFF_USER_AGENT },
        });

        if (!res.ok) {
          return { results: [] as OFFSuggestion[], error: `Error de Open Food Facts (${res.status})` };
        }

        const json = await res.json() as { status: number; product?: OFFProductResult };
        if (json.status !== 1 || !json.product) {
          return { results: [] as OFFSuggestion[], error: null };
        }

        return { results: [mapProduct(json.product)], error: null };
      }

      // Text search
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(data.query)}&search_simple=1&action=process&json=1&page_size=8&fields=code,product_name,brands,categories,ingredients_text,allergens_tags,image_url,nutriments,nutriscore_grade,nova_group`;
      const res = await fetch(url, {
        headers: { "User-Agent": OFF_USER_AGENT },
      });

      if (!res.ok) {
        return { results: [] as OFFSuggestion[], error: `Error de Open Food Facts (${res.status})` };
      }

      const json = await res.json() as { products?: OFFProductResult[] };
      const results = (json.products ?? [])
        .filter((p) => p.product_name)
        .map(mapProduct);

      return { results, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al buscar en Open Food Facts";
      return { results: [] as OFFSuggestion[], error: msg };
    }
  });
