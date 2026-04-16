import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchProduct, deleteProduct, type ProductWithNutrition, SOURCE_OPTIONS } from "@/lib/products";
import { MacroBadges, NutritionTable } from "@/components/products/NutritionDisplay";

export const Route = createFileRoute("/_authenticated/despensa/productos/$productId")({
  component: ProductDetailPage,
});

function ProductDetailPage() {
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (!product) return null;

  const p = product;
  const isLiquid = p.default_unit === "ml" || p.default_unit === "l";
  const sourceName = SOURCE_OPTIONS.find((s) => s.value === p.source)?.label ?? p.source;

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return;
    await deleteProduct(p.id);
    navigate({ to: "/despensa" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 sticky top-0 bg-background z-10 flex items-center justify-between">
        <button onClick={() => navigate({ to: "/despensa" })} className="text-sm text-muted-foreground hover:text-foreground">
          ← Productos
        </button>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/despensa/productos/$productId/editar", params: { productId: p.id } })}
          >
            Editar
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete}>Eliminar</Button>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{p.name}</h1>
            {p.source === "label" ? (
              <Badge variant="outline">🏷️</Badge>
            ) : (
              <Badge variant="secondary">🥑</Badge>
            )}
          </div>
          {p.brand && <p className="text-muted-foreground">{p.brand}</p>}
          {p.barcode && <p className="text-xs text-muted-foreground mt-0.5">EAN: {p.barcode}</p>}
        </div>

        {/* Macro badges - prominent */}
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">
              Macros por 100 {isLiquid ? "ml" : "g"}
            </p>
            <MacroBadges nutrition={p.product_nutrition} unit={isLiquid ? "ml" : "g"} />
          </CardContent>
        </Card>

        {/* Full nutrition table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Tabla nutricional completa</CardTitle>
          </CardHeader>
          <CardContent>
            <NutritionTable nutrition={p.product_nutrition} />
          </CardContent>
        </Card>

        {/* Product details */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Unidad por defecto" value={p.default_unit ?? "—"} />
            {p.serving_size_value != null && (
              <DetailRow label="Porción" value={`${p.serving_size_value} ${p.serving_size_unit ?? ""}`} />
            )}
            {p.package_size_value != null && (
              <DetailRow label="Envase" value={`${p.package_size_value} ${p.package_size_unit ?? ""}`} />
            )}
            {p.servings_per_package != null && (
              <DetailRow label="Porciones/envase" value={String(p.servings_per_package)} />
            )}
            {p.category && <DetailRow label="Categoría" value={`${p.category}${p.subcategory ? ` / ${p.subcategory}` : ""}`} />}
          </CardContent>
        </Card>

        {/* Tags & allergens */}
        {((p.suitability_tags?.length ?? 0) > 0 || (p.allergens?.length ?? 0) > 0) && (
          <Card>
            <CardContent className="py-4 space-y-3">
              {(p.suitability_tags?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Etiquetas</p>
                  <div className="flex gap-1 flex-wrap">
                    {p.suitability_tags?.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
                  </div>
                </div>
              )}
              {(p.allergens?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Alérgenos</p>
                  <div className="flex gap-1 flex-wrap">
                    {p.allergens?.map((a) => <Badge key={a} variant="destructive">{a}</Badge>)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ingredients */}
        {p.ingredients_text && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ingredientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{p.ingredients_text}</p>
            </CardContent>
          </Card>
        )}

        {/* Traceability */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trazabilidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Fuente" value={sourceName ?? "—"} />
            {p.nutrition_source_name && <DetailRow label="Base de datos" value={p.nutrition_source_name} />}
            {p.nutrition_source_reference_id && <DetailRow label="ID referencia" value={p.nutrition_source_reference_id} />}
            {p.nutrition_confidence != null && <DetailRow label="Confianza" value={`${(p.nutrition_confidence * 100).toFixed(0)}%`} />}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
