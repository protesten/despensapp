// Pure utility functions for data normalization.

/**
 * Mapeo de categorías comunes EN → ES.
 * Se aplica después de quitar prefijos de idioma.
 */
const CATEGORY_EN_TO_ES: Record<string, string> = {
  "dairy": "lácteos",
  "dairies": "lácteos",
  "milk": "leche",
  "cheeses": "quesos",
  "cheese": "quesos",
  "yogurts": "yogures",
  "yogurt": "yogures",
  "meat": "carne",
  "meats": "carne",
  "fish": "pescado",
  "seafood": "pescado",
  "vegetables": "verduras",
  "fruits": "frutas",
  "fruit": "frutas",
  "snacks": "snacks",
  "beverages": "bebidas",
  "drinks": "bebidas",
  "breads": "panadería",
  "bread": "panadería",
  "cereals": "cereales",
  "pasta": "pasta",
  "rice": "arroz",
  "legumes": "legumbres",
  "spices": "especias",
  "condiments": "condimentos",
  "sauces": "salsas",
  "oils": "aceites",
  "oil": "aceites",
  "sweets": "dulces",
  "chocolates": "chocolates",
  "frozen-foods": "congelados",
  "canned-foods": "conservas",
  "plant-based-foods-and-beverages": "vegetales",
};

/**
 * Limpia y normaliza una categoría:
 * 1. Quita prefijos de idioma (en:, es:, fr:, etc.)
 * 2. Trim + colapsa espacios
 * 3. Lowercase
 * 4. Mapea EN → ES si aplica
 * 5. Capitaliza la primera letra para presentación
 */
export function normalizeCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let s = raw.trim();
  if (!s) return null;

  // Quitar prefijo de idioma tipo "en:" o "es:" (incluso múltiples: "en:es:foo")
  s = s.replace(/^([a-z]{2}:)+/i, "");

  // Colapsar espacios y guiones repetidos, trim
  s = s.replace(/\s+/g, " ").trim().toLowerCase();

  if (!s) return null;

  // Mapeo EN → ES
  const mapped = CATEGORY_EN_TO_ES[s] ?? s;

  // Capitalizar primera letra
  return mapped.charAt(0).toUpperCase() + mapped.slice(1);
}

/**
 * Conversión de unidades a una unidad canónica.
 * Solo conversiones seguras (mismo dominio: peso o volumen).
 * Devuelve null si la conversión no es posible.
 */
export type Unit = "g" | "kg" | "ml" | "l" | "unit";

export function convertUnit(
  value: number,
  from: Unit,
  to: Unit,
): number | null {
  if (from === to) return value;

  // Peso
  if (from === "kg" && to === "g") return value * 1000;
  if (from === "g" && to === "kg") return value / 1000;

  // Volumen
  if (from === "l" && to === "ml") return value * 1000;
  if (from === "ml" && to === "l") return value / 1000;

  // Sin conversión cruzada peso ↔ volumen ↔ unidad
  return null;
}

/**
 * Devuelve la unidad "canónica" para agrupar:
 * - kg, g → g
 * - l, ml → ml
 * - unit → unit
 */
export function canonicalUnit(unit: Unit): "g" | "ml" | "unit" {
  if (unit === "kg" || unit === "g") return "g";
  if (unit === "l" || unit === "ml") return "ml";
  return "unit";
}

/**
 * Distancia de Levenshtein entre dos strings.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}

/**
 * Similitud normalizada (0–1) basada en Levenshtein.
 * 1 = idénticos. 0 = totalmente distintos.
 */
export function similarity(a: string, b: string): number {
  const sa = a.trim().toLowerCase();
  const sb = b.trim().toLowerCase();
  const max = Math.max(sa.length, sb.length);
  if (max === 0) return 1;
  return 1 - levenshtein(sa, sb) / max;
}
