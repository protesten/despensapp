import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const searchInputSchema = z.object({
  query: z.string().min(1).max(200),
});

/** Spanish → English dictionary for common foods */
const ES_EN_DICT: Record<string, string> = {
  naranja: "orange",
  arroz: "rice",
  huevo: "egg",
  huevos: "eggs",
  papa: "potato",
  papas: "potatoes",
  patata: "potato",
  patatas: "potatoes",
  "plátano": "banana",
  "plátanos": "bananas",
  banana: "banana",
  lentejas: "lentils",
  garbanzos: "chickpeas",
  pollo: "chicken",
  manzana: "apple",
  manzanas: "apples",
  leche: "milk",
  tomate: "tomato",
  tomates: "tomatoes",
  cebolla: "onion",
  ajo: "garlic",
  zanahoria: "carrot",
  "pimiento": "pepper",
  espinaca: "spinach",
  espinacas: "spinach",
  "brócoli": "broccoli",
  "brocoli": "broccoli",
  "atún": "tuna",
  "salmón": "salmon",
  pan: "bread",
  queso: "cheese",
  yogur: "yogurt",
  avena: "oats",
  pasta: "pasta",
  aceite: "oil",
  "aceite de oliva": "olive oil",
  mantequilla: "butter",
  cerdo: "pork",
  ternera: "beef",
  res: "beef",
  pavo: "turkey",
  "jamón": "ham",
  "maíz": "corn",
  frijoles: "beans",
  "judías": "beans",
  aguacate: "avocado",
  "limón": "lemon",
  lima: "lime",
  fresa: "strawberry",
  fresas: "strawberries",
  uva: "grape",
  uvas: "grapes",
  pera: "pear",
  "melocotón": "peach",
  piña: "pineapple",
  "sandía": "watermelon",
  "melón": "melon",
  almendra: "almond",
  almendras: "almonds",
  nuez: "walnut",
  nueces: "walnuts",
  "cacahuete": "peanut",
  "cacahuetes": "peanuts",
  "maní": "peanut",
  pepino: "cucumber",
  calabaza: "squash",
  "calabacín": "zucchini",
  berenjena: "eggplant",
  lechuga: "lettuce",
  apio: "celery",
  "champiñón": "mushroom",
  "champiñones": "mushrooms",
  sardina: "sardine",
  sardinas: "sardines",
  "camarón": "shrimp",
  camarones: "shrimp",
  "harina": "flour",
  "azúcar": "sugar",
  sal: "salt",
  "arroz integral": "brown rice",
  "pechuga de pollo": "chicken breast",
  "muslo de pollo": "chicken thigh",
  "leche entera": "whole milk",
  "leche desnatada": "skim milk",
};

function translateQuery(query: string): { translated: string; wasTranslated: boolean } {
  const lower = query.trim().toLowerCase();
  // Try full phrase first, then individual words
  if (ES_EN_DICT[lower]) {
    return { translated: ES_EN_DICT[lower], wasTranslated: true };
  }
  // Try translating word by word
  const words = lower.split(/\s+/);
  if (words.length > 1) {
    const mapped = words.map((w) => ES_EN_DICT[w] ?? w);
    const anyChanged = mapped.some((m, i) => m !== words[i]);
    if (anyChanged) {
      return { translated: mapped.join(" "), wasTranslated: true };
    }
  }
  return { translated: query.trim(), wasTranslated: false };
}

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

async function fetchUSDA(query: string, apiKey: string): Promise<USDAFoodResult[]> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      dataType: ["Foundation", "SR Legacy"],
      pageSize: 8,
      sortBy: "dataType.keyword",
      sortOrder: "asc",
    }),
  });

  if (!res.ok) {
    console.error("USDA API error:", res.status, await res.text());
    throw new Error(`Error de la API USDA (${res.status})`);
  }

  const json = await res.json() as { foods: USDAFoodResult[] };
  return json.foods ?? [];
}

export const searchUSDAFoods = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => searchInputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";

    try {
      // 1. Try original query first
      let foods = await fetchUSDA(data.query, apiKey);
      let usedTranslation = false;
      let translatedTerm: string | null = null;

      // 2. If no results, try Spanish→English fallback
      if (foods.length === 0) {
        const { translated, wasTranslated } = translateQuery(data.query);
        if (wasTranslated) {
          foods = await fetchUSDA(translated, apiKey);
          if (foods.length > 0) {
            usedTranslation = true;
            translatedTerm = translated;
          }
        }
      }

      const results = foods.map(mapToSuggestion);
      return { results, error: null, usedTranslation, translatedTerm };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al buscar datos nutricionales";
      return { results: [] as NutritionSuggestion[], error: msg, usedTranslation: false, translatedTerm: null };
    }
  });
