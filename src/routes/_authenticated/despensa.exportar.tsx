import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  exportProducts,
  exportStock,
  exportMovements,
  exportConsolidated,
} from "@/lib/export.functions";
import {
  exportStockToCSV,
  exportStockToXLSX,
  exportConsolidatedToCSV,
  exportConsolidatedToXLSX,
} from "@/lib/export-tabular";
import { AI_PROMPT_TEMPLATE, AI_RESPONSE_FORMAT_EXAMPLE } from "@/lib/export-import.schemas";
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
  const [tab, setTab] = useState<"general" | "ia" | "tabla">("ia");

  const doExport = async (fn: () => Promise<any>, name: string) => {
    setLoading(true);
    setLabel(name);
    setItemCount(null);
    try {
      const data = await fn();
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

  const handleCopy = async (text?: string) => {
    try {
      await navigator.clipboard.writeText(text ?? result);
      toast.success("Copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const handleDownload = (content?: string, filename?: string) => {
    const blob = new Blob([content ?? result], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? `despensapp-${label.toLowerCase().replace(/\s/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo descargado");
  };

  const handleExportForAI = async () => {
    setLoading(true);
    setLabel("Inventario para IA");
    setItemCount(null);
    try {
      const data = await exportConsolidated();
      setItemCount(data.product_count);
      const fullPrompt = AI_PROMPT_TEMPLATE + JSON.stringify(data, null, 2);
      setResult(fullPrompt);
      toast.success(`Inventario exportado: ${data.product_count} productos`);
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
      toast.error(`Error al exportar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportTabular = async (fmt: "csv" | "xlsx") => {
    setLoading(true);
    setLabel(fmt === "csv" ? "Stock CSV" : "Stock Excel");
    setItemCount(null);
    setResult("");
    try {
      const count = fmt === "csv" ? await exportStockToCSV() : await exportStockToXLSX();
      setItemCount(count);
      toast.success(`${count} items exportados a ${fmt.toUpperCase()}`);
    } catch (e: any) {
      toast.error(`Error al exportar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showUser />

      <main className="p-4 max-w-2xl mx-auto space-y-4">
        <AppNav />

        <h2 className="text-xl font-bold">Exportar datos</h2>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "general" | "ia" | "tabla")}>
          <TabsList className="w-full">
            <TabsTrigger value="ia" className="flex-1">🤖 Para IA</TabsTrigger>
            <TabsTrigger value="tabla" className="flex-1">📊 Tabla</TabsTrigger>
            <TabsTrigger value="general" className="flex-1">📦 General</TabsTrigger>
          </TabsList>

          <TabsContent value="tabla" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Exportar stock a CSV o Excel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Descarga tu stock actual (sin items consumidos) en formato tabular para
                  abrirlo en Excel, Google Sheets, Numbers o cualquier hoja de cálculo.
                </p>

                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium">📋 Columnas incluidas:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Producto, marca, cantidad, unidad</li>
                    <li>Ubicación, estado, apertura</li>
                    <li>Fechas de compra y caducidad</li>
                    <li>Coste unitario, modo de seguimiento</li>
                    <li>Envases, raciones, fecha de apertura y creación</li>
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    className="w-full"
                    onClick={() => handleExportTabular("xlsx")}
                    disabled={loading}
                  >
                    📊 Excel (.xlsx)
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleExportTabular("csv")}
                    disabled={loading}
                  >
                    📄 CSV
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  💡 El CSV usa <code className="bg-muted px-1 rounded">;</code> como separador
                  y BOM UTF-8 para mostrar correctamente tildes y eñes en Excel.
                </p>
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="ia" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Exportar para generación de menús</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Exporta tu inventario completo con datos nutricionales, cantidades disponibles, caducidades y estado de apertura. 
                  Incluye un prompt listo para pegar en cualquier IA (ChatGPT, Gemini, Claude…).
                </p>

                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium">📋 Qué incluye:</p>
                  <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Todos los items en stock (no consumidos)</li>
                    <li>Nombre, marca, categoría y subcategoría</li>
                    <li>Cantidad actual, unidad y ubicación</li>
                    <li>Fecha de caducidad y estado (abierto/sellado)</li>
                    <li>Macros completos: kcal, proteína, HC, grasa, fibra, azúcares, grasa sat., sal</li>
                    <li>Alérgenos y etiquetas de aptitud</li>
                    <li>Prompt con instrucciones para la IA</li>
                  </ul>
                </div>

                <Button
                  className="w-full"
                  onClick={handleExportForAI}
                  disabled={loading}
                >
                  {loading ? "Exportando…" : "🤖 Exportar inventario + prompt para IA"}
                </Button>
              </CardContent>
            </Card>

            {/* AI response format reference */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Formato de respuesta esperado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  La IA debe responder con un JSON que contenga el menú propuesto y los movimientos de consumo. 
                  Puedes importar esos movimientos directamente en la sección <strong>Importar</strong>.
                </p>

                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs font-medium mb-2">Ejemplo de respuesta:</p>
                  <pre className="text-[11px] overflow-auto max-h-48 whitespace-pre-wrap break-all">
                    {JSON.stringify(AI_RESPONSE_FORMAT_EXAMPLE, null, 2)}
                  </pre>
                </div>

                <div className="bg-accent/50 rounded-lg p-3 text-xs text-accent-foreground space-y-1">
                  <p className="font-medium">💡 Flujo recomendado:</p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Exporta el inventario con el botón de arriba</li>
                    <li>Pega el texto en tu IA favorita</li>
                    <li>Copia el JSON de <code className="bg-muted px-1 rounded">movements</code> de la respuesta</li>
                    <li>Ve a <strong>Importar</strong> y pega el JSON</li>
                    <li>Previsualiza y aplica los consumos</li>
                  </ol>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(JSON.stringify(AI_RESPONSE_FORMAT_EXAMPLE, null, 2))}
                >
                  📋 Copiar formato de ejemplo
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Exporta datos en bruto para respaldo o análisis.
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
                variant="outline"
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => doExport(exportConsolidated, "Consolidado")}
                disabled={loading}
              >
                <span className="text-lg">🔄</span>
                <span className="text-xs">Consolidado</span>
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {loading && (
          <p className="text-center text-muted-foreground animate-pulse">Exportando {label}…</p>
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
                  <Button size="sm" variant="outline" onClick={() => handleCopy()}>
                    📋 Copiar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownload()}>
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
