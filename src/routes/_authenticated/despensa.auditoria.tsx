import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppNav } from "@/components/layout/AppNav";
import { toast } from "sonner";
import {
  auditPantry,
  applyCategoryNormalization,
  fixSourceCoherence,
  mergeProducts,
  type AuditReport,
} from "@/lib/audit.functions";

export const Route = createFileRoute("/_authenticated/despensa/auditoria")({
  component: AuditPage,
});

function AuditPage() {
  const auditFn = useServerFn(auditPantry);
  const normalizeFn = useServerFn(applyCategoryNormalization);
  const fixSourceFn = useServerFn(fixSourceCoherence);
  const mergeFn = useServerFn(mergeProducts);

  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r: any = await auditFn();
      // Normalize: ensure all arrays exist (handle partial/undefined responses)
      const safe: AuditReport = {
        missing_nutrition: Array.isArray(r?.missing_nutrition) ? r.missing_nutrition : [],
        dirty_categories: Array.isArray(r?.dirty_categories) ? r.dirty_categories : [],
        incoherent_source: Array.isArray(r?.incoherent_source) ? r.incoherent_source : [],
        duplicates: Array.isArray(r?.duplicates) ? r.duplicates : [],
        generated_at: r?.generated_at ?? new Date().toISOString(),
      };
      setReport(safe);
    } catch (e: any) {
      console.error(e);
      toast.error("Error al ejecutar auditoría");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleNormalizeCategories = async () => {
    setBusy(true);
    try {
      const { updated } = await normalizeFn();
      toast.success(`${updated} categorías normalizadas`);
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error("Error al normalizar categorías");
    } finally {
      setBusy(false);
    }
  };

  const handleFixSource = async () => {
    setBusy(true);
    try {
      const { updated } = await fixSourceFn();
      toast.success(`${updated} productos corregidos (source coherente)`);
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error("Error al corregir source");
    } finally {
      setBusy(false);
    }
  };

  const handleMerge = async (canonical: string, duplicate: string, name: string) => {
    if (!confirm(`¿Fusionar duplicado en "${name}"? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    try {
      await mergeFn({ data: { canonical_id: canonical, duplicate_id: duplicate } });
      toast.success("Productos fusionados");
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message ?? "Error al fusionar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showUser />

      <main className="p-4 max-w-3xl mx-auto space-y-4">
        <AppNav />

        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Auditoría de despensa</h2>
          <Button size="sm" variant="outline" onClick={load} disabled={loading || busy}>
            🔄 Re-analizar
          </Button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Analizando...</p>
        ) : !report ? (
          <p className="text-center text-muted-foreground py-8">Sin datos.</p>
        ) : (
          <div className="space-y-4">
            {/* Resumen */}
            <Card>
              <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <Stat label="Sin nutrición" value={report.missing_nutrition.length} />
                <Stat label="Cat. sucias" value={report.dirty_categories.length} />
                <Stat label="Source incoh." value={report.incoherent_source.length} />
                <Stat label="Duplicados" value={report.duplicates.length} />
              </CardContent>
            </Card>

            {/* Categorías sucias */}
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">
                  Categorías inconsistentes ({report.dirty_categories.length})
                </CardTitle>
                {report.dirty_categories.length > 0 && (
                  <Button size="sm" onClick={handleNormalizeCategories} disabled={busy}>
                    Normalizar todas
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {report.dirty_categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">✅ Todas limpias.</p>
                ) : (
                  report.dirty_categories.slice(0, 20).map((c) => (
                    <div key={c.product_id} className="text-sm flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{c.name}</span>
                      <Badge variant="destructive" className="text-xs">{c.raw_category}</Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="secondary" className="text-xs">{c.normalized}</Badge>
                    </div>
                  ))
                )}
                {report.dirty_categories.length > 20 && (
                  <p className="text-xs text-muted-foreground">+ {report.dirty_categories.length - 20} más</p>
                )}
              </CardContent>
            </Card>

            {/* Source incoherente */}
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-base">
                  Source incoherente ({report.incoherent_source.length})
                </CardTitle>
                {report.incoherent_source.length > 0 && (
                  <Button size="sm" onClick={handleFixSource} disabled={busy}>
                    Corregir todos
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {report.incoherent_source.length === 0 ? (
                  <p className="text-sm text-muted-foreground">✅ Todo coherente.</p>
                ) : (
                  report.incoherent_source.slice(0, 20).map((c) => (
                    <div key={c.product_id} className="text-sm flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{c.name}</span>
                      <Badge variant="outline" className="text-xs">source: {c.source}</Badge>
                      <Badge variant="secondary" className="text-xs">type: {c.nutrition_source_type}</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Sin nutrición */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Sin nutrición ({report.missing_nutrition.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-0">
                {report.missing_nutrition.length === 0 ? (
                  <p className="text-sm text-muted-foreground">✅ Todos con nutrición.</p>
                ) : (
                  report.missing_nutrition.slice(0, 20).map((m) => (
                    <p key={m.product_id} className="text-sm">
                      {m.name} {m.brand && <span className="text-muted-foreground">· {m.brand}</span>}
                    </p>
                  ))
                )}
                {report.missing_nutrition.length > 20 && (
                  <p className="text-xs text-muted-foreground">+ {report.missing_nutrition.length - 20} más</p>
                )}
              </CardContent>
            </Card>

            {/* Duplicados */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Posibles duplicados ({report.duplicates.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {report.duplicates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">✅ Sin duplicados detectados.</p>
                ) : (
                  report.duplicates.map((d, i) => (
                    <div key={i} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-xs">
                          Similitud: {(d.score * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <p>A: <span className="font-medium">{d.a.name}</span> {d.a.brand && <span className="text-muted-foreground">· {d.a.brand}</span>}</p>
                        <p>B: <span className="font-medium">{d.b.name}</span> {d.b.brand && <span className="text-muted-foreground">· {d.b.brand}</span>}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleMerge(d.a.product_id, d.b.product_id, d.a.name)}
                        >
                          Mantener A, fusionar B
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => handleMerge(d.b.product_id, d.a.product_id, d.b.name)}
                        >
                          Mantener B, fusionar A
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              Generado: {new Date(report.generated_at).toLocaleString("es-ES")}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
