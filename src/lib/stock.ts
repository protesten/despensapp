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
    product_nutrition: ProductNutrition[];
  };
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

  // Auto-create purchase movement
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

export async function deleteStockItem(id: string): Promise<void> {
  const { error } = await supabase.from("stock_items").delete().eq("id", id);
  if (error) throw error;
}
