import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type ProductNutrition = Tables<"product_nutrition">;
export type ProductWithNutrition = Product & { product_nutrition: ProductNutrition | null };

export async function fetchProducts(): Promise<ProductWithNutrition[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_nutrition(*)")
    .order("name");

  if (error) throw error;
  return (data ?? []).map((p) => ({
    ...p,
    product_nutrition: Array.isArray(p.product_nutrition)
      ? p.product_nutrition[0] ?? null
      : p.product_nutrition,
  }));
}

export async function fetchProduct(id: string): Promise<ProductWithNutrition> {
  const { data, error } = await supabase
    .from("products")
    .select("*, product_nutrition(*)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return {
    ...data,
    product_nutrition: Array.isArray(data.product_nutrition)
      ? data.product_nutrition[0] ?? null
      : data.product_nutrition,
  };
}

export async function searchDuplicates(
  name: string,
  brand: string | null,
  barcode: string | null,
): Promise<Product[]> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return [];

  let query = supabase
    .from("products")
    .select("*")
    .eq("user_id", userId);

  const conditions: string[] = [];
  if (name.trim()) conditions.push(`name.ilike.%${name.trim()}%`);
  if (brand?.trim()) conditions.push(`brand.ilike.%${brand.trim()}%`);
  if (barcode?.trim()) conditions.push(`barcode.eq.${barcode.trim()}`);

  if (conditions.length === 0) return [];

  query = query.or(conditions.join(","));

  const { data, error } = await query.limit(5);
  if (error) throw error;
  return data ?? [];
}

export interface ProductFormData {
  name: string;
  brand: string | null;
  barcode: string | null;
  default_unit: string;
  serving_size_value: number | null;
  serving_size_unit: string | null;
  package_size_value: number | null;
  package_size_unit: string | null;
  servings_per_package: number | null;
  category: string | null;
  subcategory: string | null;
  suitability_tags: string[];
  ingredients_text: string | null;
  allergens: string[];
  source: string;
  nutrition_source_type: string;
  nutrition_source_name: string | null;
  nutrition_source_reference_id: string | null;
  nutrition_confidence: number | null;
  image_url: string | null;
  image_storage_provider: string | null;
  image_drive_file_id: string | null;
  image_drive_folder_id: string | null;
}

export interface NutritionFormData {
  kcal_per_100g: number | null;
  kcal_per_100ml: number | null;
  protein_per_100g: number | null;
  protein_per_100ml: number | null;
  carbs_per_100g: number | null;
  carbs_per_100ml: number | null;
  fat_per_100g: number | null;
  fat_per_100ml: number | null;
  fiber_per_100g: number | null;
  fiber_per_100ml: number | null;
  sugars_per_100g: number | null;
  sugars_per_100ml: number | null;
  saturated_fat_per_100g: number | null;
  saturated_fat_per_100ml: number | null;
  salt_per_100g: number | null;
  salt_per_100ml: number | null;
}

export async function createProduct(
  product: ProductFormData,
  nutrition: NutritionFormData,
): Promise<string> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("No autenticado");

  const insertData: TablesInsert<"products"> = {
    ...product,
    user_id: userId,
    default_unit: product.default_unit as TablesInsert<"products">["default_unit"],
    serving_size_unit: product.serving_size_unit as TablesInsert<"products">["serving_size_unit"],
    package_size_unit: product.package_size_unit as TablesInsert<"products">["package_size_unit"],
    source: product.source as TablesInsert<"products">["source"],
    nutrition_source_type: product.nutrition_source_type as TablesInsert<"products">["nutrition_source_type"],
  };

  const { data, error } = await supabase
    .from("products")
    .insert(insertData)
    .select("id")
    .single();

  if (error) throw error;

  const { error: nutError } = await supabase
    .from("product_nutrition")
    .insert({ product_id: data.id, ...nutrition });

  if (nutError) throw nutError;

  return data.id;
}

export async function updateProduct(
  id: string,
  product: Partial<ProductFormData>,
  nutrition: Partial<NutritionFormData>,
): Promise<void> {
  const { error } = await supabase
    .from("products")
    .update({
      name: product.name,
      brand: product.brand,
      barcode: product.barcode,
      default_unit: product.default_unit as TablesInsert<"products">["default_unit"],
      serving_size_value: product.serving_size_value,
      serving_size_unit: product.serving_size_unit as TablesInsert<"products">["serving_size_unit"],
      package_size_value: product.package_size_value,
      package_size_unit: product.package_size_unit as TablesInsert<"products">["package_size_unit"],
      servings_per_package: product.servings_per_package,
      category: product.category,
      subcategory: product.subcategory,
      suitability_tags: product.suitability_tags,
      ingredients_text: product.ingredients_text,
      allergens: product.allergens,
      source: product.source as TablesInsert<"products">["source"],
      nutrition_source_type: product.nutrition_source_type as TablesInsert<"products">["nutrition_source_type"],
      nutrition_source_name: product.nutrition_source_name,
      nutrition_source_reference_id: product.nutrition_source_reference_id,
      nutrition_confidence: product.nutrition_confidence,
      image_url: product.image_url,
      image_storage_provider: product.image_storage_provider,
      image_drive_file_id: product.image_drive_file_id,
      image_drive_folder_id: product.image_drive_folder_id,
    })
    .eq("id", id);

  if (error) throw error;

  const { error: nutError } = await supabase
    .from("product_nutrition")
    .upsert({ product_id: id, ...nutrition });

  if (nutError) throw nutError;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

export const UNIT_OPTIONS = [
  { value: "g", label: "Gramos (g)" },
  { value: "ml", label: "Mililitros (ml)" },
  { value: "unit", label: "Unidades" },
  { value: "kg", label: "Kilogramos (kg)" },
  { value: "l", label: "Litros (l)" },
];

export const SOURCE_OPTIONS = [
  { value: "label", label: "🏷️ Etiqueta nutricional" },
  { value: "manual", label: "✏️ Entrada manual" },
  { value: "openfoodfacts", label: "🌐 Open Food Facts" },
  { value: "food_database", label: "📚 Base de datos alimentaria" },
  { value: "ai_estimate", label: "🤖 Estimación IA" },
];

export const EMPTY_NUTRITION: NutritionFormData = {
  kcal_per_100g: null, kcal_per_100ml: null,
  protein_per_100g: null, protein_per_100ml: null,
  carbs_per_100g: null, carbs_per_100ml: null,
  fat_per_100g: null, fat_per_100ml: null,
  fiber_per_100g: null, fiber_per_100ml: null,
  sugars_per_100g: null, sugars_per_100ml: null,
  saturated_fat_per_100g: null, saturated_fat_per_100ml: null,
  salt_per_100g: null, salt_per_100ml: null,
};

export const EMPTY_PRODUCT: ProductFormData = {
  name: "",
  brand: null,
  barcode: null,
  default_unit: "g",
  serving_size_value: null,
  serving_size_unit: null,
  package_size_value: null,
  package_size_unit: null,
  servings_per_package: null,
  category: null,
  subcategory: null,
  suitability_tags: [],
  ingredients_text: null,
  allergens: [],
  source: "label",
  nutrition_source_type: "label",
  nutrition_source_name: null,
  nutrition_source_reference_id: null,
  nutrition_confidence: null,
  image_url: null,
  image_storage_provider: null,
  image_drive_file_id: null,
  image_drive_folder_id: null,
};
