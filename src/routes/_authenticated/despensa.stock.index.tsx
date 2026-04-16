import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)}>⋮</Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-md border border-border bg-popover p-1 shadow-md">
          <button className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent" onClick={() => { setOpen(false); onAction("consumption"); }}>🍽️ Consumir</button>
          <button className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent" onClick={() => { setOpen(false); onAction("adjustment"); }}>🔧 Ajustar</button>
          <button className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent" onClick={() => { setOpen(false); onAction("waste"); }}>🗑️ Merma</button>
          <button className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent" onClick={() => { setOpen(false); onAction("expiry"); }}>⏰ Expirar</button>
          <Link to="/despensa/stock/$stockItemId/historial" params={{ stockItemId: item.id }} className="block w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent" onClick={() => setOpen(false)}>📋 Historial</Link>
          <button className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-accent text-destructive" onClick={() => { setOpen(false); onDelete(); }}>✕ Eliminar</button>
        </div>
      )}
    </div>
  );
}

function StockIndexPage() {
  const { user, signOut } = useAuth();
  const [items, setItems] = useState<StockItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LocationFilter>("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItem, setDialogItem] = useState<StockItemWithProduct | null>(null);
  const [dialogType, setDialogType] = useState<MovementType>("consumption");

  const load = async () => {
    setLoading(true);
    try {
      setItems(await fetchStockItems());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? items : items.filter((i) => i.location === filter);

  const grouped = filtered.reduce<Record<string, StockItemWithProduct[]>>((acc, item) => {
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
    } catch (e) {
      console.error(e);
    }
  };

  const openMovement = (item: StockItemWithProduct, type: MovementType) => {
    setDialogItem(item);
    setDialogType(type);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 bg-background z-10">
        <div className="flex items-center gap-3">
          <Link to="/despensa" className="text-sm text-muted-foreground hover:text-foreground">←</Link>
          <h1 className="text-lg font-bold">📦 Stock</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>Salir</Button>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Inventario</h2>
          <Button size="sm" asChild>
            <Link to="/despensa/stock/nuevo">+ Añadir stock</Link>
          </Button>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["all", "pantry", "fridge", "freezer", "other"] as const).map((loc) => (
            <Button
              key={loc}
              variant={filter === loc ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(loc)}
            >
              {loc === "all" ? "Todas" : LOCATION_LABELS[loc]}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {items.length === 0
                ? "No tienes stock. ¡Añade el primero!"
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
                    const nutrition = Array.isArray(item.products.product_nutrition)
                      ? item.products.product_nutrition[0] ?? null
                      : null;
                    const unit = item.unit === "ml" || item.unit === "l" ? "ml" : "g";

                    return (
                      <Card key={item.id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">{item.products.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {item.products.brand && (
                                  <span className="text-sm text-muted-foreground">{item.products.brand}</span>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {item.quantity} {item.unit}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {STATUS_LABELS[item.status ?? "available"]}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  {OPEN_STATUS_LABELS[item.open_status ?? "sealed"]}
                                </Badge>
                              </div>
                              {item.expiration_date && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Caduca: {item.expiration_date}
                                </p>
                              )}
                              {item.unit_cost != null && (
                                <p className="text-xs text-muted-foreground">
                                  Coste: {item.unit_cost} €
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
