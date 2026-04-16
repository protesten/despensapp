import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ProductForm } from "@/components/products/ProductForm";
import {
  fetchProduct,
  updateProduct,
  type ProductWithNutrition,
  type ProductFormData,
  type NutritionFormData,
  EMPTY_NUTRITION,
} from "@/lib/products";

export const Route = createFileRoute("/_authenticated/despensa/productos/$productId/editar")({
  component: EditProductPage,
});

function EditProductPage() {
  const { productId } = Route.useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<ProductWithNutrition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProduct(productId)
      .then(setProduct)
      .catch(() => navigate({ to: "/despensa" }))
      .finally(() => setLoading(false));
  }, [productId, navigate]);

  if (loading || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  const initialProduct: ProductFormData = {
    name: product.name,
    brand: product.brand,
    barcode: product.barcode,
    default_unit: product.default_unit ?? "g",
    serving_size_value: product.serving_size_value,
    serving_size_unit: product.serving_size_unit,
    package_size_value: product.package_size_value,
    package_size_unit: product.package_size_unit,
    servings_per_package: product.servings_per_package,
    category: product.category,
    subcategory: product.subcategory,
    suitability_tags: product.suitability_tags ?? [],
    ingredients_text: product.ingredients_text,
    allergens: product.allergens ?? [],
    source: product.source ?? "manual",
    nutrition_source_type: product.nutrition_source_type ?? "manual",
    nutrition_source_name: product.nutrition_source_name,
    nutrition_source_reference_id: product.nutrition_source_reference_id,
    nutrition_confidence: product.nutrition_confidence,
    image_url: product.image_url,
    image_storage_provider: product.image_storage_provider,
    image_drive_file_id: product.image_drive_file_id,
    image_drive_folder_id: product.image_drive_folder_id,
  };

  const n = product.product_nutrition;
  const initialNutrition: NutritionFormData = n
    ? {
        kcal_per_100g: n.kcal_per_100g, kcal_per_100ml: n.kcal_per_100ml,
        protein_per_100g: n.protein_per_100g, protein_per_100ml: n.protein_per_100ml,
        carbs_per_100g: n.carbs_per_100g, carbs_per_100ml: n.carbs_per_100ml,
        fat_per_100g: n.fat_per_100g, fat_per_100ml: n.fat_per_100ml,
        fiber_per_100g: n.fiber_per_100g, fiber_per_100ml: n.fiber_per_100ml,
        sugars_per_100g: n.sugars_per_100g, sugars_per_100ml: n.sugars_per_100ml,
        saturated_fat_per_100g: n.saturated_fat_per_100g, saturated_fat_per_100ml: n.saturated_fat_per_100ml,
        salt_per_100g: n.salt_per_100g, salt_per_100ml: n.salt_per_100ml,
      }
    : EMPTY_NUTRITION;

  const handleSubmit = async (productData: ProductFormData, nutritionData: NutritionFormData) => {
    await updateProduct(productId, productData, nutritionData);
    navigate({ to: "/despensa/productos/$productId", params: { productId } });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 sticky top-0 bg-background z-10">
        <button
          onClick={() => navigate({ to: "/despensa/productos/$productId", params: { productId } })}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver
        </button>
        <h1 className="text-lg font-bold mt-1">Editar producto</h1>
      </header>
      <main className="p-4 max-w-2xl mx-auto">
        <ProductForm
          initialProduct={initialProduct}
          initialNutrition={initialNutrition}
          onSubmit={handleSubmit}
          onCancel={() => navigate({ to: "/despensa/productos/$productId", params: { productId } })}
          isEditing
        />
      </main>
    </div>
  );
}
