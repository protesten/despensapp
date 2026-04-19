import { supabase } from "@/integrations/supabase/client";

export interface ExchangeFood {
  id: string;
  user_id: string;
  name: string;
  serving_g: number;
  hc: number;
  prot: number;
  fat: number;
  created_at: string;
}

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
  food_name: string;
  servings: number;
  hc_total: number;
  prot_total: number;
  fat_total: number;
}

export const DEFAULT_MEALS = [
  { meal_name: "Desayuno", meal_order: 1 },
  { meal_name: "Media mañana", meal_order: 2 },
  { meal_name: "Almuerzo", meal_order: 3 },
  { meal_name: "Post-entreno/Merienda", meal_order: 4 },
  { meal_name: "Snack saludable", meal_order: 5 },
  { meal_name: "Cena", meal_order: 6 },
] as const;

// Exchange foods
export async function fetchExchangeFoods(): Promise<ExchangeFood[]> {
  const { data, error } = await supabase
    .from("exchange_foods")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as ExchangeFood[];
}

export async function createExchangeFood(
  food: Omit<ExchangeFood, "id" | "user_id" | "created_at">,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("No autenticado");
  const { error } = await supabase.from("exchange_foods").insert({
    ...food,
    user_id: u.user.id,
  });
  if (error) throw error;
}

export async function updateExchangeFood(
  id: string,
  food: Partial<Omit<ExchangeFood, "id" | "user_id" | "created_at">>,
): Promise<void> {
  const { error } = await supabase.from("exchange_foods").update(food).eq("id", id);
  if (error) throw error;
}

export async function deleteExchangeFood(id: string): Promise<void> {
  const { error } = await supabase.from("exchange_foods").delete().eq("id", id);
  if (error) throw error;
}

// Meal targets
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

// Meal plan entries
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

export async function createMealPlanEntry(
  entry: Omit<MealPlanEntry, "id" | "user_id">,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("No autenticado");
  const { error } = await supabase
    .from("meal_plan_entries")
    .insert({ ...entry, user_id: u.user.id });
  if (error) throw error;
}

export async function deleteMealPlanEntry(id: string): Promise<void> {
  const { error } = await supabase.from("meal_plan_entries").delete().eq("id", id);
  if (error) throw error;
}

// Helpers
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
