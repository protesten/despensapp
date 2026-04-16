import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const searchInputSchema = z.object({
  query: z.string().min(1).max(200),
});

export interface USDAFoodResult {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  foodNutrients: {
    nutrientName: string;
    nutrientNumber: string;
    value: number;
    unitName: string;
  }[];
}

export interface NutritionSuggestion {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  saturated_fat: number | null;
  fiber: number | null;
  sugars: number | null;
  salt: number | null;
}

function extractNutrient(nutrients: USDAFoodResult["foodNutrients"], nutrientNumber: string): number | null {
  const n = nutrients.find((x) => x.nutrientNumber === nutrientNumber);
  return n ? n.value : null;
}

function mapToSuggestion(food: USDAFoodResult): NutritionSuggestion {
  const n = food.foodNutrients;
  // Sodium (mg) → salt (g): salt = sodium * 2.5 / 1000
  const sodiumMg = extractNutrient(n, "307");
  const salt = sodiumMg != null ? Math.round(sodiumMg * 2.5 / 1000 * 100) / 100 : null;

  return {
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType,
    brandOwner: food.brandOwner,
    kcal: extractNutrient(n, "208"),
    protein: extractNutrient(n, "203"),
    carbs: extractNutrient(n, "205"),
    fat: extractNutrient(n, "204"),
    saturated_fat: extractNutrient(n, "606"),
    fiber: extractNutrient(n, "291"),
    sugars: extractNutrient(n, "269"),
    salt,
  };
}

export const searchUSDAFoods = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => searchInputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: data.query,
        dataType: ["Foundation", "SR Legacy"],
        pageSize: 8,
        sortBy: "dataType.keyword",
        sortOrder: "asc",
      }),
    });

    if (!res.ok) {
      console.error("USDA API error:", res.status, await res.text());
      return { results: [] as NutritionSuggestion[], error: `Error de la API USDA (${res.status})` };
    }

    const json = await res.json() as { foods: USDAFoodResult[] };
    const results = (json.foods ?? []).map(mapToSuggestion);

    return { results, error: null };
  });
