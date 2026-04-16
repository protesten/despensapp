import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchProducts, deleteProduct, type ProductWithNutrition } from "@/lib/products";
import { MacroBadges } from "@/components/products/NutritionDisplay";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppNav } from "@/components/layout/AppNav";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/despensa/")({
  component: DespensaIndexPage,
});

function DespensaIndexPage() {
  const [products, setProducts] = useState<ProductWithNutrition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await fetchProducts();
      setProducts(data);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand?.toLowerCase().includes(q) ?? false) ||
      (p.barcode?.includes(q) ?? false) ||
      (p.category?.toLowerCase().includes(q) ?? false)
    );
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      toast.success(`"${name}" eliminado`);
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar producto");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showUser />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <AppNav />

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Productos ({filtered.length})</h2>
          <Button size="sm" asChild>
            <Link to="/despensa/productos/nuevo">+ Nuevo</Link>
          </Button>
        </div>

        <Input
          placeholder="Buscar por nombre, marca, código o categoría..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {products.length === 0
                ? "Aún no tienes productos. ¡Crea el primero!"
                : "No se encontraron resultados."}
            </p>
            {products.length === 0 && (
              <Button asChild>
                <Link to="/despensa/productos/nuevo">Crear primer producto</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        to="/despensa/productos/$productId"
                        params={{ productId: p.id }}
                        className="font-medium hover:underline"
                      >
                        {p.name}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {p.brand && <span className="text-sm text-muted-foreground">{p.brand}</span>}
                        {p.source === "label" ? (
                          <Badge variant="outline" className="text-xs">🏷️ Etiqueta</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">🥑 Sin etiqueta</Badge>
                        )}
                        {p.category && <Badge variant="secondary" className="text-xs">{p.category}</Badge>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive shrink-0"
                      onClick={() => handleDelete(p.id, p.name)}
                    >
                      ✕
                    </Button>
                  </div>
                  <div className="mt-2">
                    <MacroBadges
                      nutrition={p.product_nutrition}
                      unit={p.default_unit === "ml" || p.default_unit === "l" ? "ml" : "g"}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
