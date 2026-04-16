import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { searchUSDAFoods, type NutritionSuggestion } from "@/lib/usda.functions";
import type { NutritionFormData, ProductFormData } from "@/lib/products";

interface NutritionLookupProps {
  productName: string;
  onApply: (
    nutrition: Partial<NutritionFormData>,
    meta: Pick<ProductFormData, "nutrition_source_type" | "nutrition_source_name" | "nutrition_source_reference_id" | "nutrition_confidence">
  ) => void;
}

export function NutritionLookup({ productName, onApply }: NutritionLookupProps) {
  const [query, setQuery] = useState(productName);
  const [results, setResults] = useState<NutritionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await searchUSDAFoods({ data: { query: query.trim() } });
      setResults(res.results);
      if (res.error) setError(res.error);
      setSearched(true);
    } catch {
      setError("Error al buscar datos nutricionales");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: NutritionSuggestion) => {
    onApply(
      {
        kcal_per_100g: item.kcal,
        protein_per_100g: item.protein,
        carbs_per_100g: item.carbs,
        fat_per_100g: item.fat,
        saturated_fat_per_100g: item.saturated_fat,
        fiber_per_100g: item.fiber,
        sugars_per_100g: item.sugars,
        salt_per_100g: item.salt,
      },
      {
        nutrition_source_type: "food_database",
        nutrition_source_name: "USDA FoodData Central",
        nutrition_source_reference_id: String(item.fdcId),
        nutrition_confidence: 0.9,
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar alimento (ej: orange, rice, egg)"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
        />
        <Button type="button" variant="secondary" onClick={handleSearch} disabled={loading || !query.trim()} className="shrink-0">
          {loading ? "…" : "🔍 Buscar"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Busca en inglés para mejores resultados (ej: "apple", "chicken breast", "white rice")
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {searched && results.length === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            No se encontraron datos automáticos. Introduce los valores manualmente.
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {results.map((item) => (
            <Card
              key={item.fdcId}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => handleSelect(item)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{item.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      USDA #{item.fdcId} · {item.dataType}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs">Seleccionar</Badge>
                </div>
                <div className="flex gap-2 flex-wrap mt-2">
                  <MiniPill label="Kcal" value={item.kcal} />
                  <MiniPill label="P" value={item.protein} unit="g" />
                  <MiniPill label="HC" value={item.carbs} unit="g" />
                  <MiniPill label="G" value={item.fat} unit="g" />
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
      <span className="font-medium">{value != null ? value : "—"}{unit ?? ""}</span>
    </span>
  );
}
