import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import {
  exportProducts,
  exportStock,
  exportMovements,
  exportConsolidated,
} from "@/lib/export.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/despensa/exportar")({
  component: ExportPage,
});

function ExportPage() {
  const { user } = useAuth();
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");

  async function getHeaders() {
    const { data } = await supabase.auth.getSession();
    return {
      Authorization: `Bearer ${data.session?.access_token}`,
    };
  }

  const doExport = async (fn: () => Promise<any>, name: string) => {
    setLoading(true);
    setLabel(name);
    try {
      const data = await fn();
      setResult(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `despensapp-${label.toLowerCase().replace(/\s/g, "-")}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

        <h2 className="text-xl font-bold">Exportar datos</h2>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => doExport(exportProducts, "Productos")}
            disabled={loading}
          >
            📦 Productos
          </Button>
          <Button
            variant="outline"
            onClick={() => doExport(exportStock, "Stock")}
            disabled={loading}
          >
            🗄️ Stock
          </Button>
          <Button
            variant="outline"
            onClick={() => doExport(exportMovements, "Movimientos")}
            disabled={loading}
          >
            📊 Movimientos
          </Button>
          <Button
            onClick={() => doExport(exportConsolidated, "Consolidado IA")}
            disabled={loading}
          >
            🤖 Consolidado IA
          </Button>
        </div>

        {loading && (
          <p className="text-center text-muted-foreground">Exportando {label}...</p>
        )}

        {result && !loading && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{label}</span>
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
