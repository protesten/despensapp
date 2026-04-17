import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { UNIT_OPTIONS } from "@/lib/products";
import { updateStockItem, LOCATION_LABELS } from "@/lib/stock";
import {
  getModeAvailability,
  toBulk,
  fromBulk,
  formatNumber,
  pluralizeUnit,
  type TrackingMode,
  type ProductSizeFields,
} from "@/lib/stock-conversion";
import { AppHeader } from "@/components/layout/AppHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/despensa/stock/$stockItemId/editar")({
  component: EditStockPage,
});

interface LoadedStock {
  id: string;
  quantity: number;
  unit: string;
  location: string;
  purchase_date: string | null;
  expiration_date: string | null;
  unit_cost: number | null;
  open_status: string;
  tracking_mode: TrackingMode;
  product: {
    id: string;
    name: string;
    brand: string | null;
    default_unit: string | null;
    package_size_value: number | null;
    package_size_unit: string | null;
    serving_size_value: number | null;
    serving_size_unit: string | null;
  };
}

function EditStockPage() {
  const { stockItemId } = Route.useParams();
  const navigate = useNavigate();

  const [loaded, setLoaded] = useState<LoadedStock | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // form state
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("bulk");
  const [count, setCount] = useState("");
  const [unit, setUnit] = useState("g");
  const [location, setLocation] = useState("pantry");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [openStatus, setOpenStatus] = useState("sealed");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, quantity, unit, location, purchase_date, expiration_date, unit_cost, open_status, tracking_mode, products(id, name, brand, default_unit, package_size_value, package_size_unit, serving_size_value, serving_size_unit)")
        .eq("id", stockItemId)
        .single();

      if (error || !data || !data.products) {
        toast.error("No se pudo cargar el stock");
        navigate({ to: "/despensa/stock" });
        return;
      }

      const product = Array.isArray(data.products) ? data.products[0] : data.products;
      const item: LoadedStock = {
        id: data.id,
        quantity: Number(data.quantity),
        unit: data.unit,
        location: data.location ?? "pantry",
        purchase_date: data.purchase_date,
        expiration_date: data.expiration_date,
        unit_cost: data.unit_cost,
        open_status: data.open_status ?? "sealed",
        tracking_mode: (data.tracking_mode ?? "bulk") as TrackingMode,
        product,
      };
      setLoaded(item);

      // Initialize form
      setTrackingMode(item.tracking_mode);
      setUnit(item.unit);
      setLocation(item.location);
      setPurchaseDate(item.purchase_date ?? "");
      setExpirationDate(item.expiration_date ?? "");
      setUnitCost(item.unit_cost != null ? String(item.unit_cost) : "");
      setOpenStatus(item.open_status);

      const initialCount = fromBulk(item.quantity, item.tracking_mode, item.product);
      setCount(initialCount != null ? String(initialCount) : String(item.quantity));

      setLoading(false);
    };
    load();
  }, [stockItemId, navigate]);

  const product: ProductSizeFields | null = loaded?.product ?? null;
  const availability = useMemo(() => getModeAvailability(product), [product]);

  const handleModeChange = (mode: TrackingMode) => {
    if (!loaded) return;
    setTrackingMode(mode);
    // Recompute count from current bulk quantity to preserve total
    const current = Number(count);
    const oldBulk = Number.isFinite(current) && current > 0
      ? toBulk(current, trackingMode, loaded.product)
      : loaded.quantity;
    const newCount = fromBulk(oldBulk, mode, loaded.product);
    setCount(newCount != null ? String(Math.round(newCount * 100) / 100) : "");
  };

  const numericCount = Number(count);
  const validCount = !!count && numericCount > 0 && !isNaN(numericCount);
  const bulkQuantity = validCount && loaded ? toBulk(numericCount, trackingMode, loaded.product) : 0;
  const bulkUnit = loaded?.product.default_unit ?? unit;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loaded) return;
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

    setSaving(true);
    try {
      await updateStockItem(loaded.id, {
        quantity: bulkQuantity,
        unit: bulkUnit,
        location,
        purchase_date: purchaseDate || null,
        expiration_date: expirationDate || null,
        unit_cost: unitCost ? Number(unitCost) : null,
        open_status: openStatus,
        tracking_mode: trackingMode,
      });
      toast.success("Stock actualizado");
      navigate({ to: "/despensa/stock" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const inputLabel =
    trackingMode === "package" ? "Nº de envases *" :
    trackingMode === "serving" ? "Nº de porciones *" :
    "Cantidad *";

  if (loading || !loaded) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader title="Editar stock" backTo="/despensa/stock" backLabel="← Stock" />
        <main className="p-4 max-w-2xl mx-auto">
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Editar stock" backTo="/despensa/stock" backLabel="← Stock" />

      <main className="p-4 max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Producto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 rounded-lg border border-border bg-muted/30">
                <p className="font-medium truncate">{loaded.product.name}</p>
                {loaded.product.brand && (
                  <p className="text-sm text-muted-foreground">{loaded.product.brand}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Para cambiar de producto, elimina este stock y crea uno nuevo.
                </p>
              </div>
            </CardContent>
          </Card>

          {(availability.package || availability.serving) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">¿Cómo cuentas este stock?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ModeOption
                  selected={trackingMode === "package"}
                  disabled={!availability.package}
                  reason={availability.packageReason}
                  onClick={() => handleModeChange("package")}
                  title="Por envases"
                  detail={
                    loaded.product.package_size_value
                      ? `${formatNumber(loaded.product.package_size_value)} ${loaded.product.package_size_unit ?? loaded.product.default_unit ?? ""} c/u`
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
                    loaded.product.serving_size_value
                      ? `${formatNumber(loaded.product.serving_size_value)} ${loaded.product.serving_size_unit ?? loaded.product.default_unit ?? ""} c/u`
                      : "—"
                  }
                />
                <ModeOption
                  selected={trackingMode === "bulk"}
                  onClick={() => handleModeChange("bulk")}
                  title="Cantidad bruta"
                  detail={`En ${loaded.product.default_unit ?? "g"}`}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalles del stock</CardTitle>
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
                  />
                  {validCount && trackingMode !== "bulk" && (
                    <p className="text-xs text-muted-foreground">
                      = {formatNumber(bulkQuantity)} {bulkUnit} totales
                    </p>
                  )}
                  {validCount && trackingMode === "bulk" && loaded.product.package_size_value ? (
                    <p className="text-xs text-muted-foreground">
                      ≈ {formatNumber(numericCount / loaded.product.package_size_value)} {pluralizeUnit("package", numericCount / loaded.product.package_size_value)}
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

              <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                ℹ️ Esta pantalla solo corrige errores de introducción. Para registrar consumo o merma usa el menú de acciones (⋮).
              </p>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Guardando..." : "💾 Guardar cambios"}
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
