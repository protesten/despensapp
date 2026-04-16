import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { searchOFFProducts, type OFFSuggestion } from "@/lib/openfoodfacts.functions";
import type { NutritionFormData, ProductFormData } from "@/lib/products";
import { BarcodeScanner } from "./BarcodeScanner";

interface ProductLookupOFFProps {
  initialQuery: string;
  onApply: (
    product: Partial<ProductFormData>,
    nutrition: Partial<NutritionFormData>,
  ) => void;
}

const NUTRISCORE_COLORS: Record<string, string> = {
  a: "bg-green-600 text-white",
  b: "bg-lime-500 text-white",
  c: "bg-yellow-400 text-black",
  d: "bg-orange-500 text-white",
  e: "bg-red-600 text-white",
};

export function ProductLookupOFF({ initialQuery, onApply }: ProductLookupOFFProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<OFFSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTab, setSearchTab] = useState<"text" | "barcode" | "scan">("text");
  const [scanning, setScanning] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      // If it looks like a barcode (digits only, 8-14 chars), search as barcode
      const isBarcode = searchTab === "barcode" || /^\d{8,14}$/.test(q);
      const res = await searchOFFProducts({
        data: { query: q, searchType: isBarcode ? "barcode" : "text" },
      });
      setResults(res.results);
      if (res.error) setError(res.error);
      setSearched(true);
    } catch {
      setError("Error al buscar en Open Food Facts");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: OFFSuggestion) => {
    onApply(
      {
        name: item.name,
        brand: item.brand,
        barcode: item.code || null,
        category: item.category,
        ingredients_text: item.ingredients_text,
        allergens: item.allergens,
        image_url: item.image_url,
        source: "openfoodfacts",
        nutrition_source_type: "openfoodfacts",
        nutrition_source_name: "Open Food Facts",
        nutrition_source_reference_id: item.code,
        nutrition_confidence: 0.85,
      },
      {
        kcal_per_100g: item.kcal_per_100g,
        kcal_per_100ml: item.kcal_per_100ml,
        protein_per_100g: item.protein_per_100g,
        protein_per_100ml: item.protein_per_100ml,
        carbs_per_100g: item.carbs_per_100g,
        carbs_per_100ml: item.carbs_per_100ml,
        fat_per_100g: item.fat_per_100g,
        fat_per_100ml: item.fat_per_100ml,
        saturated_fat_per_100g: item.saturated_fat_per_100g,
        saturated_fat_per_100ml: item.saturated_fat_per_100ml,
        fiber_per_100g: item.fiber_per_100g,
        fiber_per_100ml: item.fiber_per_100ml,
        sugars_per_100g: item.sugars_per_100g,
        sugars_per_100ml: item.sugars_per_100ml,
        salt_per_100g: item.salt_per_100g,
        salt_per_100ml: item.salt_per_100ml,
      },
    );
  };

  return (
    <div className="space-y-3">
      <Tabs value={searchTab} onValueChange={(v) => setSearchTab(v as "text" | "barcode")}>
        <TabsList className="w-full">
          <TabsTrigger value="text" className="flex-1">🔍 Por nombre</TabsTrigger>
          <TabsTrigger value="barcode" className="flex-1">📦 Por código de barras</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchTab === "barcode" ? "Código de barras (EAN-13)" : "Buscar producto (ej: ColaCao, Hacendado leche)"}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
        />
        <Button type="button" variant="secondary" onClick={handleSearch} disabled={loading || !query.trim()} className="shrink-0">
          {loading ? "…" : "Buscar"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Busca productos envasados en Open Food Facts. Puedes usar nombre, marca o código de barras.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {searched && results.length > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-accent/50 px-3 py-2 text-xs text-accent-foreground">
          <span>🌐</span>
          <span>
            {results.length} resultado{results.length !== 1 ? "s" : ""} de <strong>Open Food Facts</strong>. Selecciona uno para autocompletar.
          </span>
        </div>
      )}

      {searched && results.length === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            No se encontró en Open Food Facts. Puedes introducir los datos manualmente.
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div className="space-y-2 max-h-[380px] overflow-y-auto">
          {results.map((item) => (
            <Card
              key={item.code}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleSelect(item)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-3">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-12 h-12 object-contain rounded border bg-white shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {item.brand && <>{item.brand} · </>}
                          {item.code}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">Seleccionar</Badge>
                    </div>
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {item.nutriscore && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold uppercase ${NUTRISCORE_COLORS[item.nutriscore] ?? "bg-muted"}`}>
                          {item.nutriscore}
                        </span>
                      )}
                      <MiniPill label="Kcal" value={item.kcal_per_100g ?? item.kcal_per_100ml} />
                      <MiniPill label="Prot" value={item.protein_per_100g ?? item.protein_per_100ml} unit="g" />
                      <MiniPill label="HC" value={item.carbs_per_100g ?? item.carbs_per_100ml} unit="g" />
                      <MiniPill label="Grasa" value={item.fat_per_100g ?? item.fat_per_100ml} unit="g" />
                    </div>
                    {item.allergens.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-1.5">
                        {item.allergens.slice(0, 4).map((a) => (
                          <span key={a} className="text-[10px] rounded bg-destructive/10 text-destructive px-1.5 py-0.5">{a}</span>
                        ))}
                        {item.allergens.length > 4 && (
                          <span className="text-[10px] text-muted-foreground">+{item.allergens.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniPill({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value != null ? Math.round(value * 10) / 10 : "—"}{unit ?? ""}</span>
    </span>
  );
}
