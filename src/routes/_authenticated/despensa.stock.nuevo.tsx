import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchProducts, type Product, UNIT_OPTIONS } from "@/lib/products";
import { createStockItem, LOCATION_LABELS } from "@/lib/stock";
import {
  getModeAvailability,
  toBulk,
  formatNumber,
  pluralizeUnit,
  type TrackingMode,
} from "@/lib/stock-conversion";
import { AppHeader } from "@/components/layout/AppHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/despensa/stock/nuevo")({
  component: AddStockPage,
});

function AddStockPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);

  const [trackingMode, setTrackingMode] = useState<TrackingMode>("bulk");
  const [count, setCount] = useState("");
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

  const availability = useMemo(
    () => getModeAvailability(selectedProduct),
    [selectedProduct],
  );

  const handleSelect = (product: Product) => {
    setSelectedProduct(product);
    setUnit(product.default_unit ?? "g");
    setTrackingMode("bulk");
    setCount("");
  };

  const handleModeChange = (mode: TrackingMode) => {
    setTrackingMode(mode);
    setCount("");
  };

  const numericCount = Number(count);
  const validCount = !!count && numericCount > 0 && !isNaN(numericCount);
  const bulkQuantity = validCount ? toBulk(numericCount, trackingMode, selectedProduct) : 0;
  const bulkUnit = selectedProduct?.default_unit ?? unit;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      toast.error("Selecciona un producto");
      return;
    }
    if (!validCount) {
      toast.error("La cantidad debe ser un número mayor que 0");
      return;
    }
    if (trackingMode === "package" && !availability.package) {
      toast.error(availability.packageReason ?? "Modo no disponible");
      return;
    }
    if (trackingMode === "serving" && !availability.serving) {
      toast.error(availability.servingReason ?? "Modo no disponible");
      return;
    }

    setLoading(true);
    try {
      await createStockItem({
        product_id: selectedProduct.id,
        quantity: bulkQuantity,
        unit: bulkUnit,
        location,
        purchase_date: purchaseDate || null,
        expiration_date: expirationDate || null,
        unit_cost: unitCost ? Number(unitCost) : null,
        open_status: openStatus,
        status,
        tracking_mode: trackingMode,
        package_count: trackingMode === "package" ? numericCount : null,
        serving_count: trackingMode === "serving" ? numericCount : null,
      });
      toast.success(`Stock de "${selectedProduct.name}" añadido`);
      navigate({ to: "/despensa/stock" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const inputLabel =
    trackingMode === "package" ? "Nº de envases *" :
    trackingMode === "serving" ? "Nº de porciones *" :
    "Cantidad *";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Añadir stock" backTo="/despensa/stock" backLabel="← Stock" />

      <main className="p-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">1. Seleccionar producto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedProduct ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{selectedProduct.name}</p>
                    {selectedProduct.brand && (
                      <p className="text-sm text-muted-foreground">{selectedProduct.brand}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setSelectedProduct(null)}>
                    Cambiar
                  </Button>
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Buscar producto por nombre, marca o código..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
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
                          className="w-full text-left p-2.5 rounded-lg hover:bg-accent transition-colors"
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

          {selectedProduct && (availability.package || availability.serving) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">2. ¿Cómo cuentas este stock?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ModeOption
                  selected={trackingMode === "package"}
                  disabled={!availability.package}
                  reason={availability.packageReason}
                  onClick={() => handleModeChange("package")}
                  title="Por envases"
                  detail={
                    selectedProduct.package_size_value
                      ? `${formatNumber(selectedProduct.package_size_value)} ${selectedProduct.package_size_unit ?? selectedProduct.default_unit ?? ""} c/u`
                      : "—"
                  }
                />
                <ModeOption
                  selected={trackingMode === "serving"}
                  disabled={!availability.serving}
                  reason={availability.servingReason}
                  onClick={() => handleModeChange("serving")}
                  title="Por porciones"
                  detail={
                    selectedProduct.serving_size_value
                      ? `${formatNumber(selectedProduct.serving_size_value)} ${selectedProduct.serving_size_unit ?? selectedProduct.default_unit ?? ""} c/u`
                      : "—"
                  }
                />
                <ModeOption
                  selected={trackingMode === "bulk"}
                  onClick={() => handleModeChange("bulk")}
                  title="Cantidad bruta"
                  detail={`En ${selectedProduct.default_unit ?? "g"}`}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {selectedProduct && (availability.package || availability.serving) ? "3" : "2"}. Detalles del stock
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{inputLabel}</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0.01"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    required
                    placeholder={trackingMode === "bulk" ? "ej. 500" : "ej. 12"}
                  />
                  {validCount && trackingMode !== "bulk" && (
                    <p className="text-xs text-muted-foreground">
                      = {formatNumber(bulkQuantity)} {bulkUnit} totales
                    </p>
                  )}
                  {validCount && trackingMode === "bulk" && selectedProduct?.package_size_value ? (
                    <p className="text-xs text-muted-foreground">
                      ≈ {formatNumber(numericCount / selectedProduct.package_size_value)} {pluralizeUnit("package", numericCount / selectedProduct.package_size_value)}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label>Unidad *</Label>
                  <Select value={unit} onValueChange={setUnit} disabled={trackingMode !== "bulk"}>
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
                  <Input type="number" step="0.01" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="ej. 2.50" />
                </div>
                <div className="space-y-1">
                  <Label>Estado apertura</Label>
                  <Select value={openStatus} onValueChange={setOpenStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sealed">🔒 Cerrado</SelectItem>
                      <SelectItem value="opened">📂 Abierto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={loading || !selectedProduct}>
              {loading ? "Guardando..." : "✅ Añadir stock"}
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

function ModeOption({
  selected, disabled, reason, onClick, title, detail,
}: {
  selected: boolean;
  disabled?: boolean;
  reason?: string;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={reason}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-accent"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className={`h-4 w-4 rounded-full border-2 shrink-0 ${selected ? "border-primary bg-primary" : "border-muted-foreground/40"}`} />
      </div>
      {disabled && reason && (
        <p className="text-xs text-muted-foreground mt-1">{reason}</p>
      )}
    </button>
  );
}
