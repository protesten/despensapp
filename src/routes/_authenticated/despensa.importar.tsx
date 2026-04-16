import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { previewImport, applyImport } from "@/lib/import.functions";
import type { ImportPreviewResult, PreviewMovement } from "@/lib/export-import.schemas";
import { MOVEMENT_TYPE_LABELS } from "@/lib/stock";
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
        toast.success("Validación correcta. Revisa la previsualización.");
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
        toast.success(`${result.applied_count} movimiento(s) aplicados`);
      } else {
        toast.warning(`${result.applied_count} aplicados, ${result.error_count} errores`);
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 bg-background z-10">
        <h1 className="text-lg font-bold">🥫 DespensApp</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/despensa">← Volver</Link>
        </Button>
      </header>

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <div className="flex gap-2 border-b border-border pb-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/despensa/exportar">📤 Exportar</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/despensa/importar">📥 Importar</Link>
          </Button>
        </div>

        <h2 className="text-xl font-bold">Importar movimientos</h2>

        {!applied ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Pega tu JSON de movimientos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  className="font-mono text-xs min-h-[200px]"
                  placeholder={EXAMPLE_JSON}
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  disabled={!!preview}
                />
                <div className="flex gap-2">
                  {!preview ? (
                    <Button onClick={handleValidate} disabled={loading}>
                      {loading ? "Validando..." : "🔍 Validar y previsualizar"}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={handleReset}>
                      Reiniciar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {preview && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Previsualización
                    {preview.valid ? (
                      <Badge className="bg-green-600">✓ Válido</Badge>
                    ) : (
                      <Badge variant="destructive">✗ Errores</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {preview.errors.length > 0 && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm space-y-1">
                      {preview.errors.map((e, i) => (
                        <p key={i}>• {e}</p>
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
                      {applying ? "Aplicando..." : "✅ Aplicar movimientos"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-center space-y-3">
              <p className="text-2xl">✅</p>
              <p className="font-medium">Importación completada</p>
              {applyResult && (
                <div className="text-sm text-muted-foreground">
                  <p>{applyResult.applied_count} movimiento(s) aplicados</p>
                  {applyResult.error_count > 0 && (
                    <p className="text-destructive">{applyResult.error_count} error(es)</p>
                  )}
                </div>
              )}
              <div className="flex gap-2 justify-center">
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
      className={`p-3 rounded-md border text-sm ${hasError ? "border-destructive/50 bg-destructive/5" : "border-border"}`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{movement.product_name}</span>
        <Badge variant={hasError ? "destructive" : "secondary"}>
          {MOVEMENT_TYPE_LABELS[movement.movement_type] ?? movement.movement_type}
        </Badge>
      </div>
      <div className="mt-1 text-muted-foreground text-xs space-y-0.5">
        <p>
          Stock actual: {movement.current_quantity} {movement.current_unit} → {movement.resulting_quantity} {movement.unit}
          {" "}
          <Badge variant="outline" className="text-xs ml-1">{movement.resulting_status}</Badge>
        </p>
        <p>Delta: {movement.movement_type === "adjustment" ? "+" : "-"}{movement.quantity_delta} {movement.unit}</p>
        {movement.notes && <p>Nota: {movement.notes}</p>}
        {movement.error && <p className="text-destructive font-medium">⚠️ {movement.error}</p>}
      </div>
    </div>
  );
}
