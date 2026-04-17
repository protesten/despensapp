import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fetchStockItems,
  deleteStockItem,
  LOCATION_LABELS,
  STATUS_LABELS,
  OPEN_STATUS_LABELS,
  type StockItemWithProduct,
} from "@/lib/stock";
import { MacroBadges } from "@/components/products/NutritionDisplay";
import { MovementDialog } from "@/components/stock/MovementDialog";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppNav } from "@/components/layout/AppNav";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/despensa/stock/")({
  component: StockIndexPage,
});

type LocationFilter = "all" | "pantry" | "fridge" | "freezer" | "other";
type MovementType = "consumption" | "adjustment" | "waste" | "expiry";

function ActionMenu({ item, onAction, onDelete }: {
  item: StockItemWithProduct;
  onAction: (type: MovementType) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setOpen(true)}>⋮</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-sm rounded-t-2xl sm:rounded-xl border border-border bg-popover p-3 shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-3 sm:hidden" />
            <p className="text-sm font-medium px-2 pb-2 truncate">{item.products.name}</p>
            <p className="text-xs text-muted-foreground px-2 pb-3">
              {item.quantity} {item.unit} · {STATUS_LABELS[item.status ?? "available"]}
            </p>
            <div className="space-y-0.5">
              <MenuButton icon="🍽️" label="Consumir" onClick={() => { setOpen(false); onAction("consumption"); }} />
              <MenuButton icon="🔧" label="Ajustar" onClick={() => { setOpen(false); onAction("adjustment"); }} />
              <MenuButton icon="🗑️" label="Merma" onClick={() => { setOpen(false); onAction("waste"); }} />
              <MenuButton icon="⏰" label="Expirar" onClick={() => { setOpen(false); onAction("expiry"); }} />
              <Link
                to="/despensa/stock/$stockItemId/historial"
                params={{ stockItemId: item.id }}
                className="flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-accent"
                onClick={() => setOpen(false)}
              >
                📋 Historial
              </Link>
            </div>
            <div className="border-t border-border mt-2 pt-2">
              <MenuButton icon="✕" label="Eliminar" onClick={() => { setOpen(false); onDelete(); }} destructive />
            </div>
            <Button variant="ghost" className="w-full mt-2 sm:hidden" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function MenuButton({ icon, label, onClick, destructive }: { icon: string; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button
      className={`flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-accent ${destructive ? "text-destructive" : ""}`}
      onClick={onClick}
    >
      {icon} {label}
    </button>
  );
}

function StockIndexPage() {
  const [items, setItems] = useState<StockItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LocationFilter>("all");
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItem, setDialogItem] = useState<StockItemWithProduct | null>(null);
  const [dialogType, setDialogType] = useState<MovementType>("consumption");

  const load = async () => {
    setLoading(true);
    try {
      setItems(await fetchStockItems());
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar el stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" 
    ? items 
    : items.filter((i) => i.location === filter);

  const searched = search.trim()
    ? filtered.filter((i) => i.products.name.toLowerCase().includes(search.toLowerCase()))
    : filtered;

  const grouped = searched.reduce<Record<string, StockItemWithProduct[]>>((acc, item) => {
    const loc = item.location ?? "other";
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(item);
    return acc;
  }, {});

  const locationOrder = ["pantry", "fridge", "freezer", "other"];
  const sortedKeys = Object.keys(grouped).sort(
    (a, b) => locationOrder.indexOf(a) - locationOrder.indexOf(b),
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar stock de "${name}"?`)) return;
    try {
      await deleteStockItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success(`Stock de "${name}" eliminado`);
    } catch (e) {
      console.error(e);
      toast.error("Error al eliminar stock");
    }
  };

  const openMovement = (item: StockItemWithProduct, type: MovementType) => {
    setDialogItem(item);
    setDialogType(type);
    setDialogOpen(true);
  };

  const expiringCount = items.filter((i) => {
    if (!i.expiration_date) return false;
    const diff = new Date(i.expiration_date).getTime() - Date.now();
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
  }).length;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showUser />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <AppNav />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Inventario ({filtered.length})</h2>
            {expiringCount > 0 && (
              <p className="text-xs text-orange-500 font-medium">⚠️ {expiringCount} por caducar en 7 días</p>
            )}
          </div>
          <Button size="sm" asChild>
            <Link to="/despensa/stock/nuevo">+ Añadir</Link>
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <Input
            placeholder="Buscar por nombre de producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "pantry", "fridge", "freezer", "other"] as const).map((loc) => (
              <Button
                key={loc}
                variant={filter === loc ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setFilter(loc)}
              >
                {loc === "all" ? "Todas" : LOCATION_LABELS[loc]}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : searched.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {items.length === 0
                ? "No tienes stock. ¡Añade el primero!"
                : search.trim()
                  ? "No se encontraron productos con ese nombre."
                  : "Sin resultados en esta ubicación."}
            </p>
            {items.length === 0 && (
              <Button asChild>
                <Link to="/despensa/stock/nuevo">Añadir primer stock</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {sortedKeys.map((loc) => (
              <section key={loc}>
                <h3 className="text-base font-semibold mb-2">{LOCATION_LABELS[loc] ?? loc}</h3>
                <div className="space-y-3">
                  {grouped[loc].map((item) => {
                    const raw = item.products.product_nutrition;
                    const nutrition = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
                    const unit = item.unit === "ml" || item.unit === "l" ? "ml" : "g";

                    const isExpiringSoon = item.expiration_date && (() => {
                      const diff = new Date(item.expiration_date!).getTime() - Date.now();
                      return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000;
                    })();
                    const isExpired = item.expiration_date && new Date(item.expiration_date).getTime() < Date.now();

                    return (
                      <Card key={item.id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.products.name}</p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {item.products.brand && (
                                  <span className="text-xs text-muted-foreground">{item.products.brand}</span>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {item.quantity} {item.unit}
                                </Badge>
                                <Badge
                                  variant={item.status === "low" ? "destructive" : "secondary"}
                                  className="text-xs"
                                >
                                  {STATUS_LABELS[item.status ?? "available"]}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {OPEN_STATUS_LABELS[item.open_status ?? "sealed"]}
                                </Badge>
                              </div>
                              {item.expiration_date && (
                                <p className={`text-xs mt-1 ${isExpired ? "text-destructive font-medium" : isExpiringSoon ? "text-orange-500 font-medium" : "text-muted-foreground"}`}>
                                  {isExpired ? "⚠️ Caducado" : isExpiringSoon ? "⚠️ Caduca pronto:" : "Caduca:"}{" "}
                                  {new Date(item.expiration_date).toLocaleDateString("es-ES")}
                                </p>
                              )}
                              {item.unit_cost != null && (
                                <p className="text-xs text-muted-foreground">
                                  Coste: {item.unit_cost.toFixed(2)} €
                                </p>
                              )}
                            </div>
                            <ActionMenu
                              item={item}
                              onAction={(type) => openMovement(item, type)}
                              onDelete={() => handleDelete(item.id, item.products.name)}
                            />
                          </div>
                          <div className="mt-2">
                            <MacroBadges nutrition={nutrition} unit={unit} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {dialogItem && (
        <MovementDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          item={dialogItem}
          type={dialogType}
          onSuccess={load}
        />
      )}
    </div>
  );
}
