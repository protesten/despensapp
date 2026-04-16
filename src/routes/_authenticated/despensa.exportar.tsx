import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  exportProducts,
  exportStock,
  exportMovements,
  exportConsolidated,
} from "@/lib/export.functions";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppNav } from "@/components/layout/AppNav";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/despensa/exportar")({
  component: ExportPage,
});

function ExportPage() {
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [itemCount, setItemCount] = useState<number | null>(null);

  const doExport = async (fn: () => Promise<any>, name: string) => {
    setLoading(true);
    setLabel(name);
    setItemCount(null);
    try {
      const data = await fn();
      // Extract count from known shapes
      const count =
        data.item_count ??
        data.products?.length ??
        data.stock?.length ??
        data.movements?.length ??
        null;
      setItemCount(count);
      setResult(JSON.stringify(data, null, 2));
      toast.success(`${name} exportado correctamente`);
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
      toast.error(`Error al exportar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result);
      toast.success("JSON copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `despensapp-${label.toLowerCase().replace(/\s/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo descargado");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showUser />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <AppNav />

        <h2 className="text-xl font-bold">Exportar datos</h2>
        <p className="text-sm text-muted-foreground">
          Exporta tus datos en JSON para usar con herramientas de IA o como respaldo.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col gap-1"
            onClick={() => doExport(exportProducts, "Productos")}
            disabled={loading}
          >
            <span className="text-lg">📦</span>
            <span className="text-xs">Productos</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col gap-1"
            onClick={() => doExport(exportStock, "Stock")}
            disabled={loading}
          >
            <span className="text-lg">🗄️</span>
            <span className="text-xs">Stock</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col gap-1"
            onClick={() => doExport(exportMovements, "Movimientos")}
            disabled={loading}
          >
            <span className="text-lg">📊</span>
            <span className="text-xs">Movimientos</span>
          </Button>
          <Button
            className="h-auto py-3 flex flex-col gap-1"
            onClick={() => doExport(exportConsolidated, "Consolidado IA")}
            disabled={loading}
          >
            <span className="text-lg">🤖</span>
            <span className="text-xs">Consolidado IA</span>
          </Button>
        </div>

        {loading && (
          <p className="text-center text-muted-foreground">Exportando {label}...</p>
        )}

        {result && !loading && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span>{label}</span>
                  {itemCount !== null && (
                    <Badge variant="secondary" className="text-xs">{itemCount} items</Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    📋 Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownload}>
                    ⬇️ Descargar
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-96 whitespace-pre-wrap break-all">
                {result}
              </pre>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
