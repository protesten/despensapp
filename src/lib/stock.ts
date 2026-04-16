import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { ProductNutrition } from "@/lib/products";

export type StockItem = Tables<"stock_items">;
export type InventoryMovement = Tables<"inventory_movements">;

export type StockItemWithProduct = StockItem & {
  products: {
    name: string;
    brand: string | null;
    default_unit: string | null;
    category: string | null;
    product_nutrition: ProductNutrition[] | ProductNutrition | null;
  };
};

export type MovementWithProduct = InventoryMovement & {
  products: { name: string; brand: string | null };
};

export const LOCATION_LABELS: Record<string, string> = {
  pantry: "🗄️ Despensa",
  fridge: "🧊 Nevera",
  freezer: "❄️ Congelador",
  other: "📦 Otro",
};

export const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  low: "Poco",
  expired: "Caducado",
  consumed: "Consumido",
};

export const OPEN_STATUS_LABELS: Record<string, string> = {
  sealed: "Cerrado",
  opened: "Abierto",
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  purchase: "🛒 Compra",
  consumption: "🍽️ Consumo",
  adjustment: "🔧 Ajuste",
  waste: "🗑️ Merma",
  expiry: "⏰ Expiración",
};

export interface StockFormData {
  product_id: string;
  quantity: number;
  unit: string;
  location: string;
  purchase_date: string | null;
  expiration_date: string | null;
  unit_cost: number | null;
  open_status: string;
  status: string;
}

export interface MovementFormData {
  stock_item_id: string;
  product_id: string;
  movement_type: "consumption" | "adjustment" | "waste" | "expiry";
  quantity_delta: number; // positive number — sign applied by type
  unit: string;
  notes: string | null;
}

export async function fetchStockItems(): Promise<StockItemWithProduct[]> {
  const { data, error } = await supabase
    .from("stock_items")
    .select("*, products(name, brand, default_unit, category, product_nutrition(*))")
    .neq("status", "consumed")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as StockItemWithProduct[];
}

export async function createStockItem(form: StockFormData): Promise<string> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("No autenticado");

  const insert: TablesInsert<"stock_items"> = {
    product_id: form.product_id,
    quantity: form.quantity,
    unit: form.unit as TablesInsert<"stock_items">["unit"],
    location: form.location as TablesInsert<"stock_items">["location"],
    purchase_date: form.purchase_date,
    expiration_date: form.expiration_date,
    unit_cost: form.unit_cost,
    open_status: form.open_status as TablesInsert<"stock_items">["open_status"],
    status: form.status as TablesInsert<"stock_items">["status"],
    user_id: userId,
  };

  const { data, error } = await supabase
    .from("stock_items")
    .insert(insert)
    .select("id")
    .single();

  if (error) throw error;

  const movementInsert: TablesInsert<"inventory_movements"> = {
    product_id: form.product_id,
    stock_item_id: data.id,
    movement_type: "purchase",
    quantity_delta: form.quantity,
    unit: form.unit as TablesInsert<"inventory_movements">["unit"],
    moved_at: form.purchase_date ?? new Date().toISOString(),
    user_id: userId,
    notes: null,
  };

  const { error: movError } = await supabase
    .from("inventory_movements")
    .insert(movementInsert);

  if (movError) throw movError;

  return data.id;
}

export async function createMovement(form: MovementFormData): Promise<void> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("No autenticado");

  if (form.quantity_delta <= 0) throw new Error("La cantidad debe ser mayor que 0");

  // Fetch current stock to validate
  const { data: stockItem, error: fetchErr } = await supabase
    .from("stock_items")
    .select("quantity, status")
    .eq("id", form.stock_item_id)
    .single();

  if (fetchErr || !stockItem) throw new Error("Stock no encontrado");

  // Calculate actual delta (negative for consumption/waste/expiry, signed for adjustment)
  let effectiveDelta: number;
  if (form.movement_type === "adjustment") {
    // adjustment: quantity_delta is already the signed value passed in
    effectiveDelta = form.quantity_delta;
  } else {
    // consumption, waste, expiry → subtract
    effectiveDelta = -Math.abs(form.quantity_delta);
  }

  const newQuantity = Number(stockItem.quantity) + effectiveDelta;
  if (newQuantity < 0) {
    throw new Error(`Stock insuficiente. Disponible: ${stockItem.quantity}`);
  }

  // Insert movement
  const movementInsert: TablesInsert<"inventory_movements"> = {
    product_id: form.product_id,
    stock_item_id: form.stock_item_id,
    movement_type: form.movement_type as TablesInsert<"inventory_movements">["movement_type"],
    quantity_delta: effectiveDelta,
    unit: form.unit as TablesInsert<"inventory_movements">["unit"],
    moved_at: new Date().toISOString(),
    user_id: userId,
    notes: form.notes,
  };

  const { error: movErr } = await supabase
    .from("inventory_movements")
    .insert(movementInsert);

  if (movErr) throw movErr;

  // Update stock item
  let newStatus: string;
  if (form.movement_type === "expiry") {
    newStatus = "expired";
  } else if (newQuantity === 0) {
    newStatus = "consumed";
  } else if (newQuantity <= Number(stockItem.quantity) * 0.2) {
    newStatus = "low";
  } else {
    newStatus = "available";
  }

  const { error: updateErr } = await supabase
    .from("stock_items")
    .update({
      quantity: newQuantity,
      status: newStatus as TablesInsert<"stock_items">["status"],
    })
    .eq("id", form.stock_item_id);

  if (updateErr) throw updateErr;
}

export async function fetchMovements(stockItemId: string): Promise<MovementWithProduct[]> {
  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*, products(name, brand)")
    .eq("stock_item_id", stockItemId)
    .order("moved_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as MovementWithProduct[];
}

export async function deleteStockItem(id: string): Promise<void> {
  const { error } = await supabase.from("stock_items").delete().eq("id", id);
  if (error) throw error;
}
