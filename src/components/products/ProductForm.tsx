import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  type ProductFormData,
  type NutritionFormData,
  type Product,
  UNIT_OPTIONS,
  SOURCE_OPTIONS,
  EMPTY_PRODUCT,
  EMPTY_NUTRITION,
  searchDuplicates,
} from "@/lib/products";
import { NutritionLookup } from "@/components/products/NutritionLookup";

interface ProductFormProps {
  initialProduct?: ProductFormData;
  initialNutrition?: NutritionFormData;
  onSubmit: (product: ProductFormData, nutrition: NutritionFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

export function ProductForm({
  initialProduct,
  initialNutrition,
  onSubmit,
  onCancel,
  isEditing = false,
}: ProductFormProps) {
  const [product, setProduct] = useState<ProductFormData>(initialProduct ?? EMPTY_PRODUCT);
  const [nutrition, setNutrition] = useState<NutritionFormData>(initialNutrition ?? EMPTY_NUTRITION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [duplicates, setDuplicates] = useState<Product[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [allergenInput, setAllergenInput] = useState("");

  const hasLabel = product.source === "label";

  // Deduplication search (debounced)
  const checkDuplicates = useCallback(async () => {
    if (isEditing) return;
    if (!product.name.trim() && !product.brand?.trim() && !product.barcode?.trim()) {
      setDuplicates([]);
      return;
    }
    try {
      const results = await searchDuplicates(product.name, product.brand, product.barcode);
      setDuplicates(results);
    } catch {
      // silently fail dedup check
    }
  }, [product.name, product.brand, product.barcode, isEditing]);

  useEffect(() => {
    const timer = setTimeout(checkDuplicates, 500);
    return () => clearTimeout(timer);
  }, [checkDuplicates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onSubmit(product, nutrition);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      if (msg.includes("duplicate key") || msg.includes("unique constraint")) {
        setError("Ya existe un producto con ese nombre y marca. Usa la búsqueda para editarlo.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = (key: keyof ProductFormData, value: unknown) => {
    setProduct((prev) => ({ ...prev, [key]: value }));
  };

  const updateNutrition = (key: keyof NutritionFormData, value: string) => {
    const num = value === "" ? null : Number(value);
    setNutrition((prev) => ({ ...prev, [key]: num }));
  };

  const addTag = () => {
    const v = tagInput.trim();
    if (v && !product.suitability_tags.includes(v)) {
      updateProduct("suitability_tags", [...product.suitability_tags, v]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    updateProduct("suitability_tags", product.suitability_tags.filter((t) => t !== tag));
  };

  const addAllergen = () => {
    const v = allergenInput.trim();
    if (v && !product.allergens.includes(v)) {
      updateProduct("allergens", [...product.allergens, v]);
    }
    setAllergenInput("");
  };

  const removeAllergen = (a: string) => {
    updateProduct("allergens", product.allergens.filter((x) => x !== a));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-8">
      {/* Duplicate warning */}
      {duplicates.length > 0 && !isEditing && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm font-medium text-destructive mb-2">
              ⚠️ Se encontraron productos similares:
            </p>
            {duplicates.map((d) => (
              <div key={d.id} className="text-sm text-muted-foreground">
                <strong>{d.name}</strong>{d.brand ? ` — ${d.brand}` : ""}{d.barcode ? ` (${d.barcode})` : ""}
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-2">
              Considera editar el producto existente en lugar de crear uno nuevo.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Source selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipo de producto</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => { updateProduct("source", "label"); updateProduct("nutrition_source_type", "label"); }}
              className={`text-left p-3 rounded-lg border transition-colors ${hasLabel ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <span className="font-medium">🏷️ Producto con etiqueta</span>
              <p className="text-xs text-muted-foreground mt-0.5">Tiene información nutricional impresa</p>
            </button>
            <button
              type="button"
              onClick={() => { updateProduct("source", "manual"); updateProduct("nutrition_source_type", "manual"); }}
              className={`text-left p-3 rounded-lg border transition-colors ${!hasLabel ? "border-primary bg-primary/5" : "border-border"}`}
            >
              <span className="font-medium">🥑 Producto fresco / sin etiqueta</span>
              <p className="text-xs text-muted-foreground mt-0.5">Fruta, verdura, carne, huevos, etc.</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Basic info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Información básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FieldRow label="Nombre *">
            <Input value={product.name} onChange={(e) => updateProduct("name", e.target.value)} placeholder="Ej: Leche entera" required />
          </FieldRow>
          <FieldRow label="Marca">
            <Input value={product.brand ?? ""} onChange={(e) => updateProduct("brand", e.target.value || null)} placeholder="Ej: Hacendado" />
          </FieldRow>
          <FieldRow label="Código de barras">
            <Input value={product.barcode ?? ""} onChange={(e) => updateProduct("barcode", e.target.value || null)} placeholder="EAN-13" />
          </FieldRow>
          <FieldRow label="Unidad por defecto">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={product.default_unit}
              onChange={(e) => updateProduct("default_unit", e.target.value)}
            >
              {UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Categoría">
            <Input value={product.category ?? ""} onChange={(e) => updateProduct("category", e.target.value || null)} placeholder="Ej: Lácteos" />
          </FieldRow>
          <FieldRow label="Subcategoría">
            <Input value={product.subcategory ?? ""} onChange={(e) => updateProduct("subcategory", e.target.value || null)} placeholder="Ej: Leche" />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Package info (mainly for labeled products) */}
      {hasLabel && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Envase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Tamaño envase">
                <Input type="number" step="any" value={product.package_size_value ?? ""} onChange={(e) => updateProduct("package_size_value", e.target.value ? Number(e.target.value) : null)} />
              </FieldRow>
              <FieldRow label="Unidad envase">
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={product.package_size_unit ?? ""} onChange={(e) => updateProduct("package_size_unit", e.target.value || null)}>
                  <option value="">—</option>
                  {UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FieldRow>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Tamaño porción">
                <Input type="number" step="any" value={product.serving_size_value ?? ""} onChange={(e) => updateProduct("serving_size_value", e.target.value ? Number(e.target.value) : null)} />
              </FieldRow>
              <FieldRow label="Unidad porción">
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={product.serving_size_unit ?? ""} onChange={(e) => updateProduct("serving_size_unit", e.target.value || null)}>
                  <option value="">—</option>
                  {UNIT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FieldRow>
            </div>
            <FieldRow label="Porciones por envase">
              <Input type="number" step="any" value={product.servings_per_package ?? ""} onChange={(e) => updateProduct("servings_per_package", e.target.value ? Number(e.target.value) : null)} />
            </FieldRow>
          </CardContent>
        </Card>
      )}

      {/* Nutrition */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Información nutricional</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="100g">
            <TabsList className="w-full">
              <TabsTrigger value="100g" className="flex-1">Por 100 g</TabsTrigger>
              <TabsTrigger value="100ml" className="flex-1">Por 100 ml</TabsTrigger>
            </TabsList>
            <TabsContent value="100g" className="space-y-3 mt-3">
              {nutritionFields("g").map(({ key, label }) => (
                <FieldRow key={key} label={label}>
                  <Input type="number" step="any" value={nutrition[key as keyof NutritionFormData] ?? ""} onChange={(e) => updateNutrition(key as keyof NutritionFormData, e.target.value)} placeholder="0" />
                </FieldRow>
              ))}
            </TabsContent>
            <TabsContent value="100ml" className="space-y-3 mt-3">
              {nutritionFields("ml").map(({ key, label }) => (
                <FieldRow key={key} label={label}>
                  <Input type="number" step="any" value={nutrition[key as keyof NutritionFormData] ?? ""} onChange={(e) => updateNutrition(key as keyof NutritionFormData, e.target.value)} placeholder="0" />
                </FieldRow>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Tags & allergens */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Etiquetas y alérgenos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">Etiquetas de aptitud</Label>
            <div className="flex gap-2 mt-1">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Ej: vegano" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>+</Button>
            </div>
            <div className="flex gap-1 flex-wrap mt-2">
              {product.suitability_tags.map((t) => (
                <Badge key={t} variant="secondary" className="cursor-pointer" onClick={() => removeTag(t)}>
                  {t} ×
                </Badge>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <Label className="text-sm">Alérgenos</Label>
            <div className="flex gap-2 mt-1">
              <Input value={allergenInput} onChange={(e) => setAllergenInput(e.target.value)} placeholder="Ej: gluten" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAllergen(); } }} />
              <Button type="button" variant="outline" size="sm" onClick={addAllergen}>+</Button>
            </div>
            <div className="flex gap-1 flex-wrap mt-2">
              {product.allergens.map((a) => (
                <Badge key={a} variant="destructive" className="cursor-pointer" onClick={() => removeAllergen(a)}>
                  {a} ×
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients (labeled only) */}
      {hasLabel && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Ingredientes</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              value={product.ingredients_text ?? ""}
              onChange={(e) => updateProduct("ingredients_text", e.target.value || null)}
              placeholder="Lista de ingredientes del envase"
            />
          </CardContent>
        </Card>
      )}

      {/* Source traceability */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trazabilidad nutricional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FieldRow label="Fuente">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={product.nutrition_source_type}
              onChange={(e) => updateProduct("nutrition_source_type", e.target.value)}
            >
              {SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FieldRow>
          <FieldRow label="Nombre de la fuente">
            <Input value={product.nutrition_source_name ?? ""} onChange={(e) => updateProduct("nutrition_source_name", e.target.value || null)} placeholder="Ej: USDA, BEDCA" />
          </FieldRow>
          <FieldRow label="ID referencia">
            <Input value={product.nutrition_source_reference_id ?? ""} onChange={(e) => updateProduct("nutrition_source_reference_id", e.target.value || null)} />
          </FieldRow>
          <FieldRow label="Confianza (0-1)">
            <Input type="number" step="0.01" min="0" max="1" value={product.nutrition_confidence ?? ""} onChange={(e) => updateProduct("nutrition_confidence", e.target.value ? Number(e.target.value) : null)} />
          </FieldRow>
        </CardContent>
      </Card>

      {/* Image fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Imagen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FieldRow label="URL de imagen">
            <Input value={product.image_url ?? ""} onChange={(e) => updateProduct("image_url", e.target.value || null)} placeholder="https://..." />
          </FieldRow>
          <FieldRow label="Proveedor">
            <Input value={product.image_storage_provider ?? ""} onChange={(e) => updateProduct("image_storage_provider", e.target.value || null)} placeholder="google_drive / url" />
          </FieldRow>
          <FieldRow label="Drive File ID">
            <Input value={product.image_drive_file_id ?? ""} onChange={(e) => updateProduct("image_drive_file_id", e.target.value || null)} />
          </FieldRow>
          <FieldRow label="Drive Folder ID">
            <Input value={product.image_drive_folder_id ?? ""} onChange={(e) => updateProduct("image_drive_folder_id", e.target.value || null)} />
          </FieldRow>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive px-1">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear producto"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function nutritionFields(unit: "g" | "ml") {
  const s = unit === "ml" ? "per_100ml" : "per_100g";
  return [
    { key: `kcal_${s}`, label: "Energía (kcal)" },
    { key: `protein_${s}`, label: "Proteínas" },
    { key: `carbs_${s}`, label: "Hidratos de carbono" },
    { key: `fat_${s}`, label: "Grasas" },
    { key: `saturated_fat_${s}`, label: "Grasas saturadas" },
    { key: `fiber_${s}`, label: "Fibra" },
    { key: `sugars_${s}`, label: "Azúcares" },
    { key: `salt_${s}`, label: "Sal" },
  ];
}
