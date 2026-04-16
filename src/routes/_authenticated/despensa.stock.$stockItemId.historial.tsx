import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fetchMovements,
  MOVEMENT_TYPE_LABELS,
  type MovementWithProduct,
} from "@/lib/stock";

export const Route = createFileRoute(
  "/_authenticated/despensa/stock/$stockItemId/historial",
)({
  component: MovementHistoryPage,
});

function MovementHistoryPage() {
  const { stockItemId } = Route.useParams();
  const [movements, setMovements] = useState<MovementWithProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchMovements(stockItemId)
      .then(setMovements)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [stockItemId]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 sticky top-0 bg-background z-10">
        <Link
          to="/despensa/stock"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver al stock
        </Link>
        <h1 className="text-lg font-bold mt-1">Historial de movimientos</h1>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-3">
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Cargando...</p>
        ) : movements.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Sin movimientos registrados.
          </p>
        ) : (
          movements.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {MOVEMENT_TYPE_LABELS[m.movement_type] ??
                          m.movement_type}
                      </Badge>
                      <span className="font-medium text-sm">
                        {m.products.name}
                      </span>
                    </div>
                    <p className="text-sm mt-1">
                      <span
                        className={
                          Number(m.quantity_delta) >= 0
                            ? "text-green-600"
                            : "text-destructive"
                        }
                      >
                        {Number(m.quantity_delta) > 0 ? "+" : ""}
                        {m.quantity_delta} {m.unit}
                      </span>
                    </p>
                    {m.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {m.notes}
                      </p>
                    )}
                  </div>
                  <time className="text-xs text-muted-foreground shrink-0">
                    {new Date(m.moved_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </main>
    </div>
  );
}
