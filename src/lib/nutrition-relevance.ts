/**
 * Clasificación de relevancia nutricional de un producto.
 *
 * - required: tiene impacto relevante en macros (aceites, salsas, frutos secos,
 *   azúcares calóricos, etc.). Si no tiene macros, es un problema crítico.
 * - optional: puede o no tener nutrición; si la tiene se usa, si no es solo aviso.
 * - ignore: uso testimonial (especias, hierbas, condimentos mínimos). No debe
 *   contarse en macros aunque tenga datos.
 */
export type NutritionRelevance = "required" | "optional" | "ignore";

export interface ClassifiableProduct {
  name: string;
  category: string | null;
  nutrition_relevance?: NutritionRelevance | null;
}

const norm = (s: string | null | undefined): string =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

// Categorías (normalizadas, sin acentos)
const IGNORE_CATEGORIES = new Set([
  "especias",
  "especia",
  "hierbas",
  "hierbas aromaticas",
  "condimentos",
  "condimento",
  "sal",
  "levadura",
  "levaduras",
  "colorantes",
  "colorante",
]);

const REQUIRED_CATEGORIES = new Set([
  "aceites",
  "aceite",
  "salsas",
  "salsa",
  "frutos secos",
  "semillas",
  "cremas untables",
  "crema untable",
  "mantequillas",
  "mantequilla",
  "chocolates",
  "chocolate",
]);

// Regex sobre el nombre (sin acentos, lowercase)
const IGNORE_NAME_RE =
  /\b(sal|pimienta|oregano|comino|curry|pimenton|canela|nuez moscada|laurel|tomillo|romero|albahaca|cilantro|perejil|curcuma|cardamomo|clavo|anis|azafran|levadura)\b/;

// Edulcorantes acalóricos → optional (forzado, antes de required)
const OPTIONAL_SWEETENER_RE =
  /\b(stevia|eritritol|sucralosa|aspartamo|sacarina|xilitol|monk fruit|edulcorante)\b/;

// Azúcares calóricos → required (después del check de edulcorantes)
const REQUIRED_NAME_RE =
  /\b(azucar|miel|sirope|melaza|panela|jarabe|agave|arce)\b/;

/**
 * Devuelve la relevancia nutricional efectiva del producto.
 * Orden: override manual > ignore > optional (edulcorantes) > required > optional (fallback).
 */
export function classifyNutritionRelevance(
  product: ClassifiableProduct,
): NutritionRelevance {
  // 1. Override manual
  if (product.nutrition_relevance) {
    return product.nutrition_relevance;
  }

  const name = norm(product.name);
  const category = norm(product.category);

  // 2. Ignore (categoría o nombre)
  if (category && IGNORE_CATEGORIES.has(category)) return "ignore";
  if (name && IGNORE_NAME_RE.test(name)) return "ignore";

  // 3. Optional explícito (edulcorantes acalóricos) — antes que required
  if (name && OPTIONAL_SWEETENER_RE.test(name)) return "optional";

  // 4. Required (categoría o nombre)
  if (category && REQUIRED_CATEGORIES.has(category)) return "required";
  if (name && REQUIRED_NAME_RE.test(name)) return "required";

  // 5. Fallback
  return "optional";
}
