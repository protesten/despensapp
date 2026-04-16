import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { previewImport, applyImport } from "@/lib/import.functions";
import type { ImportPreviewResult, PreviewMovement } from "@/lib/export-import.schemas";
import { AI_RESPONSE_FORMAT_EXAMPLE } from "@/lib/export-import.schemas";
import { MOVEMENT_TYPE_LABELS } from "@/lib/stock";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppNav } from "@/components/layout/AppNav";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/despensa/importar")({
  component: ImportPage,
});

const EXAMPLE_JSON = JSON.stringify(AI_RESPONSE_FORMAT_EXAMPLE, null, 2);

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

    // Try to extract movements from AI response format (which may include menu + movements)
    let jsonToImport = json.trim();
    try {
      const parsed = JSON.parse(jsonToImport);
      if (parsed.movements && parsed.menu) {
        // AI responded with full format — extract just the movements part
        jsonToImport = JSON.stringify({ movements: parsed.movements });
        toast.info("Se detectó formato de respuesta IA — extrayendo movimientos automáticamente");
      }
    } catch {
      // Will be caught by previewImport
    }

    setLoading(true);
    setPreview(null);
    setApplied(false);
    setApplyResult(null);
    try {
      const result = await previewImport(jsonToImport);
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
      const result = await applyImport(preview.import_log_id);
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
          Pega el JSON generado por la IA para actualizar tu stock automáticamente.
        </p>

        {!applied ? (
          <>
            {/* Instructions card */}
            <Card className="border-dashed">
              <CardContent className="py-3 space-y-2">
                <p className="text-xs font-medium">📋 Cómo usar:</p>
                <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-0.5">
                  <li>Exporta tu inventario desde <strong>Exportar → Para IA</strong></li>
                  <li>Pega el texto en tu IA favorita (ChatGPT, Gemini, Claude…)</li>
                  <li>Copia la respuesta completa o solo el bloque <code className="bg-muted px-1 rounded">movements</code></li>
                  <li>Pega aquí abajo y pulsa <strong>Validar</strong></li>
                </ol>
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Puedes pegar la respuesta completa de la IA (con menú + movimientos) — 
                  se extraerán los movimientos automáticamente.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>JSON de movimientos</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-auto py-1"
                    onClick={() => setJson(EXAMPLE_JSON)}
                  >
                    Ver ejemplo
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  className="font-mono text-xs min-h-[180px]"
                  placeholder='{"movements": [{"stock_item_id": "...", "product_id": "...", "movement_type": "consumption", "quantity_delta": 100, "unit": "g", "notes": "Cena"}]}'
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  disabled={!!preview}
                />

                <div className="flex gap-2">
                  {!preview ? (
                    <Button onClick={handleValidate} disabled={loading || !json.trim()} className="flex-1 sm:flex-none">
                      {loading ? "Validando…" : "🔍 Validar y previsualizar"}
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={handleReset}>
                      ↩️ Reiniciar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Format reference */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground">Formato esperado por campo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <FormatField name="stock_item_id" type="uuid" required desc="ID del item de stock" />
                  <FormatField name="product_id" type="uuid" required desc="ID del producto" />
                  <FormatField name="movement_type" type="enum" required desc="consumption | waste | expiry | adjustment" />
                  <FormatField name="quantity_delta" type="number" required desc="Cantidad positiva a descontar" />
                  <FormatField name="unit" type="enum" required desc="g | ml | unit | kg | l" />
                  <FormatField name="notes" type="string" desc="Opcional. Ej: 'Cena: arroz con pollo'" />
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
                      <p className="font-medium text-xs uppercase tracking-wide mb-1">Errores</p>
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
                      {applying ? "Aplicando…" : `✅ Aplicar ${validCount} movimiento(s)`}
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
                    <>
                      <p className="text-destructive">{applyResult.error_count} error(es)</p>
                      <div className="text-xs text-left bg-destructive/10 p-2 rounded mt-2 space-y-0.5">
                        {applyResult.errors.map((e, i) => (
                          <p key={i}>• {e}</p>
                        ))}
                      </div>
                    </>
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

function FormatField({ name, type, required, desc }: { name: string; type: string; required?: boolean; desc: string }) {
  return (
    <div className="flex items-start gap-2 py-1 border-b border-border/50 last:border-0">
      <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono shrink-0">{name}</code>
      <Badge variant="outline" className="text-[10px] shrink-0">{type}</Badge>
      {required && <Badge className="text-[10px] shrink-0 bg-primary/20 text-primary border-0">req</Badge>}
      <span className="text-muted-foreground text-[11px]">{desc}</span>
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
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground shrink-0">#{index + 1}</span>
          <span className="font-medium truncate">{movement.product_name}</span>
        </div>
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
