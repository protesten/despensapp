import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { previewImport, applyImport } from "@/lib/import.functions";
import type { ImportPreviewResult, PreviewMovement } from "@/lib/export-import.schemas";
import { MOVEMENT_TYPE_LABELS } from "@/lib/stock";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppNav } from "@/components/layout/AppNav";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/despensa/importar")({
  component: ImportPage,
});

const EXAMPLE_JSON = JSON.stringify(
  {
    movements: [
      {
        stock_item_id: "<uuid>",
        product_id: "<uuid>",
        movement_type: "consumption",
        quantity_delta: 100,
        unit: "g",
        notes: "Consumido en cena",
      },
    ],
  },
  null,
  2,
);

function ImportPage() {
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyResult, setApplyResult] = useState<{ applied_count: number; error_count: number; errors: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    if (!json.trim()) {
      toast.error("Pega un JSON primero");
      return;
    }
    setLoading(true);
    setPreview(null);
    setApplied(false);
    setApplyResult(null);
    try {
      const result = await previewImport({ data: { json } });
      setPreview(result);
      if (result.valid) {
        toast.success(`Validación correcta. ${result.preview.length} movimiento(s) listos.`);
      } else {
        toast.error(`${result.errors.length} error(es) encontrados`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!preview?.import_log_id) return;
    setApplying(true);
    try {
      const result = await applyImport({ data: { import_log_id: preview.import_log_id } });
      setApplyResult(result);
      setApplied(true);
      if (result.error_count === 0) {
        toast.success(`${result.applied_count} movimiento(s) aplicados correctamente`);
      } else {
        toast.warning(`${result.applied_count} aplicados, ${result.error_count} con errores`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setApplying(false);
    }
  };

  const handleReset = () => {
    setJson("");
    setPreview(null);
    setApplied(false);
    setApplyResult(null);
  };

  const validCount = preview?.preview.filter((m) => !m.error).length ?? 0;
  const errorCount = preview?.preview.filter((m) => m.error).length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showUser />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <AppNav />

        <h2 className="text-xl font-bold">Importar movimientos</h2>
        <p className="text-sm text-muted-foreground">
          Pega un JSON con movimientos generados por IA para actualizar tu stock.
        </p>

        {!applied ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">JSON de movimientos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  className="font-mono text-xs min-h-[180px]"
                  placeholder={EXAMPLE_JSON}
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  disabled={!!preview}
                />
                <div className="flex gap-2">
                  {!preview ? (
                    <Button onClick={handleValidate} disabled={loading || !json.trim()} className="flex-1 sm:flex-none">
                      {loading ? "Validando..." : "🔍 Validar y previsualizar"}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={handleReset}>
                      ↩️ Reiniciar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {preview && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                    <span>Previsualización</span>
                    {preview.valid ? (
                      <Badge className="bg-green-600 text-white">✓ Válido</Badge>
                    ) : (
                      <Badge variant="destructive">✗ Con errores</Badge>
                    )}
                    <span className="text-xs text-muted-foreground font-normal">
                      {validCount} válido(s){errorCount > 0 && `, ${errorCount} error(es)`}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {preview.errors.length > 0 && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm space-y-1">
                      <p className="font-medium text-xs uppercase tracking-wide mb-1">Errores globales</p>
                      {preview.errors.map((e, i) => (
                        <p key={i} className="text-xs">• {e}</p>
                      ))}
                    </div>
                  )}

                  {preview.preview.length > 0 && (
                    <div className="space-y-2">
                      {preview.preview.map((m, i) => (
                        <PreviewRow key={i} movement={m} index={i} />
                      ))}
                    </div>
                  )}

                  {preview.valid && (
                    <Button
                      className="w-full"
                      onClick={handleApply}
                      disabled={applying}
                    >
                      {applying ? "Aplicando..." : `✅ Aplicar ${validCount} movimiento(s)`}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <p className="text-3xl">✅</p>
              <p className="font-medium text-lg">Importación completada</p>
              {applyResult && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="text-green-600 font-medium">{applyResult.applied_count} movimiento(s) aplicados</p>
                  {applyResult.error_count > 0 && (
                    <p className="text-destructive">{applyResult.error_count} error(es)</p>
                  )}
                </div>
              )}
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="outline" onClick={handleReset}>
                  Nueva importación
                </Button>
                <Button asChild>
                  <Link to="/despensa/stock">Ver stock</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function PreviewRow({ movement, index }: { movement: PreviewMovement; index: number }) {
  const hasError = !!movement.error;
  return (
    <div
      className={`p-3 rounded-lg border text-sm ${hasError ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/30"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate">{movement.product_name}</span>
        <Badge variant={hasError ? "destructive" : "secondary"} className="shrink-0 text-xs">
          {MOVEMENT_TYPE_LABELS[movement.movement_type] ?? movement.movement_type}
        </Badge>
      </div>
      <div className="mt-1.5 text-muted-foreground text-xs space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span>{movement.current_quantity} {movement.current_unit}</span>
          <span>→</span>
          <span className="font-medium text-foreground">{movement.resulting_quantity} {movement.unit}</span>
          <Badge variant="outline" className="text-xs">{movement.resulting_status}</Badge>
        </div>
        <p>
          Delta: <span className={movement.movement_type === "adjustment" ? "text-blue-500" : "text-destructive"}>
            {movement.movement_type === "adjustment" ? (movement.quantity_delta >= 0 ? "+" : "") : "-"}
            {Math.abs(movement.quantity_delta)} {movement.unit}
          </span>
        </p>
        {movement.notes && <p className="italic">📝 {movement.notes}</p>}
        {movement.error && (
          <p className="text-destructive font-medium bg-destructive/10 px-2 py-1 rounded">⚠️ {movement.error}</p>
        )}
      </div>
    </div>
  );
}
