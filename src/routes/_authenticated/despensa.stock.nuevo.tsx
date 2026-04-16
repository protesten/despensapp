import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchProducts, type Product, UNIT_OPTIONS } from "@/lib/products";
import { createStockItem, LOCATION_LABELS } from "@/lib/stock";

export const Route = createFileRoute("/_authenticated/despensa/stock/nuevo")({
  component: AddStockPage,
});

function AddStockPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("g");
  const [location, setLocation] = useState("pantry");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expirationDate, setExpirationDate] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [openStatus, setOpenStatus] = useState("sealed");
  const [status, setStatus] = useState("available");

  useEffect(() => {
    fetchProducts().then(setProducts).catch(console.error);
  }, []);

  const filteredProducts = search.trim()
    ? products.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.brand?.toLowerCase().includes(q) ?? false) ||
          (p.barcode?.includes(q) ?? false)
        );
      })
    : products;

  const handleSelect = (product: Product) => {
    setSelectedProduct(product);
    setUnit(product.default_unit ?? "g");
    setSearch("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) { setError("Selecciona un producto"); return; }
    if (!quantity || Number(quantity) <= 0) { setError("Cantidad inválida"); return; }

    setError("");
    setLoading(true);
    try {
      await createStockItem({
        product_id: selectedProduct.id,
        quantity: Number(quantity),
        unit,
        location,
        purchase_date: purchaseDate || null,
        expiration_date: expirationDate || null,
        unit_cost: unitCost ? Number(unitCost) : null,
        open_status: openStatus,
        status,
      });
      navigate({ to: "/despensa/stock" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 sticky top-0 bg-background z-10">
        <Link to="/despensa/stock" className="text-sm text-muted-foreground hover:text-foreground">
          ← Volver al stock
        </Link>
        <h1 className="text-lg font-bold mt-1">Añadir stock</h1>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Product selector */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">1. Seleccionar producto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedProduct ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="font-medium">{selectedProduct.name}</p>
                    {selectedProduct.brand && (
                      <p className="text-sm text-muted-foreground">{selectedProduct.brand}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedProduct(null)}>
                    Cambiar
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Buscar producto por nombre, marca o código..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {filteredProducts.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">
                        {products.length === 0
                          ? "No tienes productos. Créalos primero en el catálogo."
                          : "Sin resultados."}
                      </p>
                    ) : (
                      filteredProducts.slice(0, 20).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full text-left p-2 rounded hover:bg-accent transition-colors"
                          onClick={() => handleSelect(p)}
                        >
                          <p className="font-medium text-sm">{p.name}</p>
                          {p.brand && <p className="text-xs text-muted-foreground">{p.brand}</p>}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Stock details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">2. Detalles del stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Cantidad *</Label>
                  <Input type="number" step="any" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>Unidad</Label>
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Ubicación</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LOCATION_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Fecha compra</Label>
                  <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Fecha caducidad</Label>
                  <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Coste unitario (€)</Label>
                  <Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Estado apertura</Label>
                  <Select value={openStatus} onValueChange={setOpenStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sealed">Cerrado</SelectItem>
                      <SelectItem value="opened">Abierto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label>Estado inicial</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponible</SelectItem>
                    <SelectItem value="low">Poco</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={loading || !selectedProduct}>
              {loading ? "Guardando..." : "Añadir stock"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link to="/despensa/stock">Cancelar</Link>
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
