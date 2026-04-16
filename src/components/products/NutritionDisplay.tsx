import type { ProductNutrition } from "@/lib/products";

interface MacroBadgesProps {
  nutrition: ProductNutrition | null;
  unit: "g" | "ml";
}

export function MacroBadges({ nutrition, unit }: MacroBadgesProps) {
  if (!nutrition) return <p className="text-sm text-muted-foreground">Sin datos nutricionales</p>;

  const suffix = unit === "ml" ? "per_100ml" : "per_100g";
  const kcal = nutrition[`kcal_${suffix}`];
  const protein = nutrition[`protein_${suffix}`];
  const carbs = nutrition[`carbs_${suffix}`];
  const fat = nutrition[`fat_${suffix}`];

  return (
    <div className="flex gap-2 flex-wrap">
      <MacroPill label="Kcal" value={kcal} color="bg-accent" />
      <MacroPill label="HC" value={carbs} unit="g" color="bg-chart-4/20 text-foreground" />
      <MacroPill label="P" value={protein} unit="g" color="bg-chart-2/20 text-foreground" />
      <MacroPill label="G" value={fat} unit="g" color="bg-chart-1/20 text-foreground" />
    </div>
  );
}

function MacroPill({ label, value, unit, color }: { label: string; value: number | null; unit?: string; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold ${color}`}>
      <span className="text-muted-foreground text-xs">{label}</span>
      <span>{value != null ? value : "—"}{unit ?? ""}</span>
    </span>
  );
}

interface NutritionTableProps {
  nutrition: ProductNutrition | null;
}

export function NutritionTable({ nutrition }: NutritionTableProps) {
  if (!nutrition) return null;

  const rows = [
    { label: "Energía (kcal)", g: nutrition.kcal_per_100g, ml: nutrition.kcal_per_100ml },
    { label: "Proteínas", g: nutrition.protein_per_100g, ml: nutrition.protein_per_100ml },
    { label: "Hidratos de carbono", g: nutrition.carbs_per_100g, ml: nutrition.carbs_per_100ml },
    { label: "Grasas", g: nutrition.fat_per_100g, ml: nutrition.fat_per_100ml },
    { label: "  - Saturadas", g: nutrition.saturated_fat_per_100g, ml: nutrition.saturated_fat_per_100ml },
    { label: "Fibra", g: nutrition.fiber_per_100g, ml: nutrition.fiber_per_100ml },
    { label: "Azúcares", g: nutrition.sugars_per_100g, ml: nutrition.sugars_per_100ml },
    { label: "Sal", g: nutrition.salt_per_100g, ml: nutrition.salt_per_100ml },
  ];

  const hasG = rows.some((r) => r.g != null);
  const hasMl = rows.some((r) => r.ml != null);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="text-left px-3 py-2 font-medium">Nutriente</th>
            {hasG && <th className="text-right px-3 py-2 font-medium">por 100 g</th>}
            {hasMl && <th className="text-right px-3 py-2 font-medium">por 100 ml</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <td className="px-3 py-1.5">{row.label}</td>
              {hasG && <td className="text-right px-3 py-1.5">{row.g != null ? row.g : "—"}</td>}
              {hasMl && <td className="text-right px-3 py-1.5">{row.ml != null ? row.ml : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
