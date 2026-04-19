import { supabase } from "@/integrations/supabase/client";

// ---------- Types ----------

export interface MealTarget {
  id: string;
  user_id: string;
  meal_name: string;
  meal_order: number;
  target_hc: number;
  target_prot: number;
  target_fat: number;
}

export interface MealPlanEntry {
  id: string;
  user_id: string;
  plan_date: string;
  meal_name: string;
  product_id: string | null;
  food_name: string | null;
  grams: number;
  servings: number;
  hc_total: number;
  prot_total: number;
  fat_total: number;
  consumed: boolean;
  consumed_at: string | null;
}

/** Producto disponible en stock para usar en el planificador. */
export interface AvailableProduct {
  product_id: string;
  name: string;
  brand: string | null;
  default_unit: string | null;
  available_grams: number;
  kcal_per_100g: number | null;
  carbs_per_100g: number | null;
  protein_per_100g: number | null;
  fat_per_100g: number | null;
}

export const DEFAULT_MEALS = [
  { meal_name: "Desayuno", meal_order: 1 },
  { meal_name: "Media mañana", meal_order: 2 },
  { meal_name: "Almuerzo", meal_order: 3 },
  { meal_name: "Post-entreno/Merienda", meal_order: 4 },
  { meal_name: "Snack saludable", meal_order: 5 },
  { meal_name: "Cena", meal_order: 6 },
] as const;

// ---------- Exchange calculation ----------

export interface ExchangeValues {
  hc: number;
  prot: number;
  fat: number;
}

/**
 * Calcula los intercambios para una cantidad en gramos de un producto
 * a partir de su información nutricional por 100 g.
 *
 * Fórmula:
 *   hc   = (carbs   * 4) / kcal
 *   prot = (protein * 4) / kcal
 *   fat  = (fat     * 9) / kcal
 *
 * Estos son intercambios "por porción equivalente a 100 kcal".
 * Después se multiplica por (grams * kcal_per_100g) / (100 * 100) = grams * kcal / 10000
 * para convertirlo a la cantidad real consumida.
 *
 * Equivalente más directo:
 *   hc_total   = (carbs_per_100g   * 4 * grams) / 10000
 *   prot_total = (protein_per_100g * 4 * grams) / 10000
 *   fat_total  = (fat_per_100g     * 9 * grams) / 10000
 */
export function calculateExchanges(
  grams: number,
  kcal_per_100g: number | null,
  carbs_per_100g: number | null,
  protein_per_100g: number | null,
  fat_per_100g: number | null,
): ExchangeValues {
  if (!kcal_per_100g || kcal_per_100g <= 0 || grams <= 0) {
    return { hc: 0, prot: 0, fat: 0 };
  }
  const carbs = Number(carbs_per_100g ?? 0);
  const prot = Number(protein_per_100g ?? 0);
  const fat = Number(fat_per_100g ?? 0);
  const factor = grams / 10000; // (grams / 100) / 100
  return {
    hc: round2(carbs * 4 * factor),
    prot: round2(prot * 4 * factor),
    fat: round2(fat * 9 * factor),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------- Available products from stock ----------

/**
 * Devuelve los productos que tienen stock disponible (status = 'available')
 * con su información nutricional, para alimentar el desplegable del planificador.
 *
 * Agrega múltiples stock_items del mismo producto sumando los gramos disponibles.
 * Solo se consideran ítems cuya unidad sea g o kg (los líquidos y unidades se
 * descartan por ahora, ya que la fórmula de intercambios usa gramos).
 */
export async function fetchAvailableProducts(): Promise<AvailableProduct[]> {
  const { data, error } = await supabase
    .from("stock_items")
    .select(
      `
      product_id,
      quantity,
      unit,
      status,
      products!inner (
        id,
        name,
        brand,
        default_unit,
        nutrition_relevance,
        product_nutrition (
          kcal_per_100g,
          carbs_per_100g,
          protein_per_100g,
          fat_per_100g
        )
      )
      `,
    )
    .eq("status", "available")
    .neq("products.nutrition_relevance", "ignore");

  if (error) throw error;

  type Row = {
    product_id: string;
    quantity: number;
    unit: string;
    products: {
      id: string;
      name: string;
      brand: string | null;
      default_unit: string | null;
      product_nutrition:
        | {
            kcal_per_100g: number | null;
            carbs_per_100g: number | null;
            protein_per_100g: number | null;
            fat_per_100g: number | null;
          }
        | Array<{
            kcal_per_100g: number | null;
            carbs_per_100g: number | null;
            protein_per_100g: number | null;
            fat_per_100g: number | null;
          }>
        | null;
    };
  };

  const rows = (data ?? []) as unknown as Row[];

  const map = new Map<string, AvailableProduct>();
  for (const r of rows) {
    // Convertir cantidad a gramos
    let grams = 0;
    if (r.unit === "g") grams = Number(r.quantity);
    else if (r.unit === "kg") grams = Number(r.quantity) * 1000;
    else continue; // ml, l, unit → no aplicable a la fórmula de intercambios

    const p = r.products;
    const nut = Array.isArray(p.product_nutrition)
      ? p.product_nutrition[0] ?? null
      : p.product_nutrition;

    const existing = map.get(p.id);
    if (existing) {
      existing.available_grams += grams;
    } else {
      map.set(p.id, {
        product_id: p.id,
        name: p.name,
        brand: p.brand,
        default_unit: p.default_unit,
        available_grams: grams,
        kcal_per_100g: nut?.kcal_per_100g ?? null,
        carbs_per_100g: nut?.carbs_per_100g ?? null,
        protein_per_100g: nut?.protein_per_100g ?? null,
        fat_per_100g: nut?.fat_per_100g ?? null,
      });
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- Meal targets ----------

export async function fetchMealTargets(): Promise<MealTarget[]> {
  const { data, error } = await supabase
    .from("meal_targets")
    .select("*")
    .order("meal_order");
  if (error) throw error;
  return (data ?? []) as MealTarget[];
}

export async function upsertMealTarget(
  target: Omit<MealTarget, "id" | "user_id">,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("No autenticado");
  const { error } = await supabase
    .from("meal_targets")
    .upsert(
      { ...target, user_id: u.user.id },
      { onConflict: "user_id,meal_name" },
    );
  if (error) throw error;
}

// ---------- Meal plan entries ----------

export async function fetchMealPlanEntries(
  startDate: string,
  endDate: string,
): Promise<MealPlanEntry[]> {
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("*")
    .gte("plan_date", startDate)
    .lte("plan_date", endDate)
    .order("plan_date");
  if (error) throw error;
  return (data ?? []) as MealPlanEntry[];
}

export interface NewMealPlanEntry {
  plan_date: string;
  meal_name: string;
  product_id: string;
  food_name: string;
  grams: number;
  hc_total: number;
  prot_total: number;
  fat_total: number;
}

export async function createMealPlanEntry(entry: NewMealPlanEntry): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("No autenticado");
  const { error } = await supabase.from("meal_plan_entries").insert({
    ...entry,
    user_id: u.user.id,
    servings: 1, // legacy column, mantenemos = 1
  });
  if (error) throw error;
}

export async function deleteMealPlanEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("meal_plan_entries")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Marca una entrada como consumida. (Stub: en una iteración futura aquí
 * se descontará automáticamente del stock la cantidad en gramos utilizada.)
 */
export async function markEntryConsumed(id: string, consumed: boolean): Promise<void> {
  const { error } = await supabase
    .from("meal_plan_entries")
    .update({
      consumed,
      consumed_at: consumed ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
  // TODO: si consumed === true, crear inventory_movement de tipo 'consumption'
  // por `grams` sobre el stock_item correspondiente al product_id, descontando
  // del stock disponible (FIFO por fecha de caducidad).
}

// ---------- Helpers ----------

export function getWeekDates(reference: Date = new Date()): string[] {
  const ref = new Date(reference);
  const day = ref.getDay(); // 0=dom..6=sab
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function formatDayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const days = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1,
  ).padStart(2, "0")}`;
}

export function approxEqual(a: number, b: number, tol = 0.25): boolean {
  return Math.abs(a - b) <= tol;
}
