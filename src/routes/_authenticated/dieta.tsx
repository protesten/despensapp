import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppNav } from "@/components/layout/AppNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_MEALS,
  approxEqual,
  calculateExchanges,
  createMealPlanEntry,
  deleteMealPlanEntry,
  extractIngredientName,
  extractRecipeName,
  fetchAvailableProducts,
  fetchMealPlanEntries,
  fetchMealTargets,
  formatDayLabel,
  generateMealWithAI,
  getWeekDates,
  markEntryConsumed,
  replaceMealEntries,
  upsertMealTarget,
  type AvailableProduct,
  type MealPlanEntry,
  type MealTarget,
} from "@/lib/diet";

export const Route = createFileRoute("/_authenticated/dieta")({
  component: DietPage,
});

function DietPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="Dieta" />
      <main className="mx-auto max-w-5xl space-y-4 overflow-x-hidden px-3 py-4 sm:px-4">
        <AppNav />
        <Tabs defaultValue="planner">
          <TabsList className="grid w-full min-w-0 grid-cols-2">
            <TabsTrigger value="planner" className="min-w-0 text-xs sm:text-sm">
              📅 Planificador
            </TabsTrigger>
            <TabsTrigger value="targets" className="min-w-0 text-xs sm:text-sm">
              🎯 Objetivos
            </TabsTrigger>
          </TabsList>
          <TabsContent value="planner" className="mt-4">
            <PlannerTab />
          </TabsContent>
          <TabsContent value="targets" className="mt-4">
            <TargetsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ---------- Planner ----------

interface ConfirmState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
}

function PlannerTab() {
  const [weekRef, setWeekRef] = useState(new Date());
  const weekDates = useMemo(() => getWeekDates(weekRef), [weekRef]);
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [products, setProducts] = useState<AvailableProduct[]>([]);
  const [targets, setTargets] = useState<MealTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null); // p.ej. "week", "day:2026-04-19", "meal:2026-04-19:Cena"
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [e, p, t] = await Promise.all([
        fetchMealPlanEntries(weekDates[0], weekDates[6]),
        fetchAvailableProducts(),
        fetchMealTargets(),
      ]);
      setEntries(e);
      setProducts(p);
      setTargets(t);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar el planificador");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDates[0]]);

  const handleAdd = async (
    date: string,
    mealName: string,
    productId: string,
    grams: number,
  ) => {
    const product = products.find((p) => p.product_id === productId);
    if (!product) return;
    if (!product.kcal_per_100g || product.kcal_per_100g <= 0) {
      toast.error("Este producto no tiene calorías registradas");
      return;
    }
    const ex = calculateExchanges(
      grams,
      product.kcal_per_100g,
      product.carbs_per_100g,
      product.protein_per_100g,
      product.fat_per_100g,
    );
    try {
      await createMealPlanEntry({
        plan_date: date,
        meal_name: mealName,
        product_id: productId,
        food_name: product.name,
        grams,
        hc_total: ex.hc,
        prot_total: ex.prot,
        fat_total: ex.fat,
      });
      toast.success("Añadido al plan");
      load();
    } catch (err) {
      console.error(err);
      toast.error("Error al añadir");
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await deleteMealPlanEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar");
    }
  };

  const handleToggleConsumed = async (id: string, current: boolean) => {
    try {
      await markEntryConsumed(id, !current);
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                consumed: !current,
                consumed_at: !current ? new Date().toISOString() : null,
              }
            : e,
        ),
      );
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar");
    }
  };

  // ---------- AI generation helpers ----------

  /** Devuelve nombres de productos usados en una comida del día anterior. */
  const previousDayProductNames = (
    date: string,
    mealName: string,
  ): string[] => {
    const idx = weekDates.indexOf(date);
    const prevIdx = idx > 0 ? idx - 1 : -1;
    if (prevIdx < 0) return [];
    const prevDate = weekDates[prevIdx];
    return entries
      .filter((e) => e.plan_date === prevDate && e.meal_name === mealName)
      .map((e) => extractIngredientName(e.food_name) || e.food_name || "")
      .filter(Boolean);
  };

  /**
   * Genera una comida concreta. Si la comida ya tiene entradas y `force` es false,
   * no hace nada (caller debe haber pedido confirmación). Si `regenerate` es true,
   * pasa los nombres actuales como exclude_product_names para forzar alternativa.
   */
  const generateOneMeal = async (
    date: string,
    mealName: string,
    opts: { regenerate?: boolean } = {},
  ): Promise<boolean> => {
    const target = targets.find((t) => t.meal_name === mealName);
    if (
      !target ||
      (Number(target.target_hc) === 0 &&
        Number(target.target_prot) === 0 &&
        Number(target.target_fat) === 0)
    ) {
      toast.error(
        `Configura los objetivos de "${mealName}" en la pestaña Objetivos`,
      );
      return false;
    }
    const currentEntries = entries.filter(
      (e) => e.plan_date === date && e.meal_name === mealName,
    );
    const excludeNames = opts.regenerate
      ? currentEntries
          .map((e) => extractIngredientName(e.food_name) || e.food_name || "")
          .filter(Boolean)
      : [];
    try {
      const result = await generateMealWithAI({
        meal_name: mealName,
        target: {
          hc: Number(target.target_hc),
          prot: Number(target.target_prot),
          fat: Number(target.target_fat),
        },
        products,
        avoid_product_names: previousDayProductNames(date, mealName),
        exclude_product_names: excludeNames,
      });
      await replaceMealEntries({
        plan_date: date,
        meal_name: mealName,
        items: result.items,
        recipe_name: result.recipe_name,
        products,
      });
      return true;
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : `Error generando "${mealName}"`,
      );
      return false;
    }
  };

  const runGenerateMeal = async (
    date: string,
    mealName: string,
    opts: { regenerate?: boolean } = {},
  ) => {
    const key = `meal:${date}:${mealName}`;
    setBusyKey(key);
    const ok = await generateOneMeal(date, mealName, opts);
    setBusyKey(null);
    if (ok) {
      toast.success(`${mealName} generada`);
      load();
    }
  };

  const handleGenerateMeal = (date: string, mealName: string) => {
    const has = entries.some(
      (e) => e.plan_date === date && e.meal_name === mealName,
    );
    if (has) {
      setConfirm({
        open: true,
        title: "¿Reemplazar el menú actual?",
        description: `Se reemplazarán las entradas actuales de "${mealName}" del ${formatDayLabel(date)} por una nueva propuesta de la IA.`,
        onConfirm: () => runGenerateMeal(date, mealName),
      });
    } else {
      runGenerateMeal(date, mealName);
    }
  };

  const handleRegenerateMeal = (date: string, mealName: string) => {
    runGenerateMeal(date, mealName, { regenerate: true });
  };

  const runGenerateDay = async (date: string) => {
    const key = `day:${date}`;
    setBusyKey(key);
    const mealsToGenerate = DEFAULT_MEALS.filter((meal) => {
      const t = targets.find((x) => x.meal_name === meal.meal_name);
      return (
        t &&
        !(
          Number(t.target_hc) === 0 &&
          Number(t.target_prot) === 0 &&
          Number(t.target_fat) === 0
        )
      );
    });
    // Generación en paralelo: cada comida se persiste en Supabase en cuanto la
    // IA responde (replaceMealEntries hace insert inmediato), sin esperar a las demás.
    const results = await Promise.all(
      mealsToGenerate.map((meal) => generateOneMeal(date, meal.meal_name)),
    );
    const okCount = results.filter(Boolean).length;
    setBusyKey(null);
    if (okCount > 0) toast.success(`Día generado (${okCount} comidas)`);
    load();
  };

  const handleGenerateDay = (date: string) => {
    const has = entries.some((e) => e.plan_date === date);
    if (has) {
      setConfirm({
        open: true,
        title: "¿Reemplazar el menú del día?",
        description: `Se reemplazarán las comidas ya planificadas del ${formatDayLabel(date)} por una nueva propuesta de la IA.`,
        onConfirm: () => runGenerateDay(date),
      });
    } else {
      runGenerateDay(date);
    }
  };

  const runGenerateWeek = async () => {
    setBusyKey("week");
    const tasks: Array<{ date: string; mealName: string }> = [];
    for (const date of weekDates) {
      for (const meal of DEFAULT_MEALS) {
        const t = targets.find((x) => x.meal_name === meal.meal_name);
        if (
          !t ||
          (Number(t.target_hc) === 0 &&
            Number(t.target_prot) === 0 &&
            Number(t.target_fat) === 0)
        )
          continue;
        tasks.push({ date, mealName: meal.meal_name });
      }
    }
    // Generación en paralelo de todas las comidas de la semana. Cada una se
    // persiste en Supabase en cuanto la IA responde (insert inmediato), por lo
    // que un refresh de página no pierde lo ya generado.
    const results = await Promise.all(
      tasks.map((t) => generateOneMeal(t.date, t.mealName)),
    );
    const okCount = results.filter(Boolean).length;
    setBusyKey(null);
    if (okCount > 0) toast.success(`Semana generada (${okCount} comidas)`);
    load();
  };

  const handleGenerateWeek = () => {
    const has = entries.length > 0;
    if (has) {
      setConfirm({
        open: true,
        title: "¿Reemplazar el menú de la semana?",
        description:
          "Se reemplazarán todas las comidas planificadas de esta semana por una nueva propuesta de la IA.",
        onConfirm: () => runGenerateWeek(),
      });
    } else {
      runGenerateWeek();
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-sm">Cargando…</p>;
  }

  const weekBusy = busyKey === "week";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:justify-between">
        <p className="col-span-2 text-center text-sm font-medium sm:order-none sm:col-span-1">
          {formatDayLabel(weekDates[0])} – {formatDayLabel(weekDates[6])}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="min-w-0 text-xs sm:text-sm"
          onClick={() => {
            const d = new Date(weekRef);
            d.setDate(d.getDate() - 7);
            setWeekRef(d);
          }}
        >
          ← Semana anterior
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="min-w-0 text-xs sm:text-sm"
          onClick={() => {
            const d = new Date(weekRef);
            d.setDate(d.getDate() + 7);
            setWeekRef(d);
          }}
        >
          Semana siguiente →
        </Button>
      </div>

      <Button
        className="w-full whitespace-normal text-center leading-tight"
        size="lg"
        onClick={handleGenerateWeek}
        disabled={busyKey !== null || products.length === 0}
      >
        {weekBusy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 h-4 w-4" />
        )}
        {weekBusy ? "Generando semana…" : "Generar semana con IA"}
      </Button>

      {products.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No hay productos disponibles en stock con información nutricional
            (g o kg). Añade stock en la despensa para poder planificar.
          </CardContent>
        </Card>
      )}

      {weekDates.map((date) => (
        <DayPlan
          key={date}
          date={date}
          entries={entries.filter((e) => e.plan_date === date)}
          targets={targets}
          products={products}
          busyKey={busyKey}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onToggleConsumed={handleToggleConsumed}
          onGenerateDay={handleGenerateDay}
          onGenerateMeal={handleGenerateMeal}
          onRegenerateMeal={handleRegenerateMeal}
        />
      ))}

      <Dialog
        open={confirm?.open ?? false}
        onOpenChange={(v) => {
          if (!v) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                const c = confirm;
                setConfirm(null);
                await c?.onConfirm();
              }}
            >
              Reemplazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DayPlan({
  date,
  entries,
  targets,
  products,
  busyKey,
  onAdd,
  onRemove,
  onToggleConsumed,
  onGenerateDay,
  onGenerateMeal,
  onRegenerateMeal,
}: {
  date: string;
  entries: MealPlanEntry[];
  targets: MealTarget[];
  products: AvailableProduct[];
  busyKey: string | null;
  onAdd: (
    date: string,
    mealName: string,
    productId: string,
    grams: number,
  ) => void;
  onRemove: (id: string) => void;
  onToggleConsumed: (id: string, current: boolean) => void;
  onGenerateDay: (date: string) => void;
  onGenerateMeal: (date: string, mealName: string) => void;
  onRegenerateMeal: (date: string, mealName: string) => void;
}) {
  const dayTotals = entries.reduce(
    (acc, e) => ({
      hc: acc.hc + Number(e.hc_total),
      prot: acc.prot + Number(e.prot_total),
      fat: acc.fat + Number(e.fat_total),
    }),
    { hc: 0, prot: 0, fat: 0 },
  );

  const dayBusy = busyKey === `day:${date}` || busyKey === "week";
  const anyBusy = busyKey !== null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            {formatDayLabel(date)}
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={anyBusy || products.length === 0}
              onClick={() => onGenerateDay(date)}
              title="Generar día con IA"
            >
              {dayBusy ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-1" /> Día
                </>
              )}
            </Button>
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            HC {dayTotals.hc.toFixed(1)} · Prot {dayTotals.prot.toFixed(1)} · Gr{" "}
            {dayTotals.fat.toFixed(1)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {DEFAULT_MEALS.map((meal) => {
          const mealEntries = entries.filter(
            (e) => e.meal_name === meal.meal_name,
          );
          const target = targets.find((t) => t.meal_name === meal.meal_name);
          const totals = mealEntries.reduce(
            (acc, e) => ({
              hc: acc.hc + Number(e.hc_total),
              prot: acc.prot + Number(e.prot_total),
              fat: acc.fat + Number(e.fat_total),
            }),
            { hc: 0, prot: 0, fat: 0 },
          );

          let status: "ok" | "warn" | "none" = "none";
          if (target && mealEntries.length > 0) {
            const ok =
              approxEqual(totals.hc, Number(target.target_hc)) &&
              approxEqual(totals.prot, Number(target.target_prot)) &&
              approxEqual(totals.fat, Number(target.target_fat));
            status = ok ? "ok" : "warn";
          }

          const recipeName = mealEntries
            .map((e) => extractRecipeName(e.food_name))
            .find((n): n is string => Boolean(n));

          const mealBusy =
            busyKey === `meal:${date}:${meal.meal_name}` || dayBusy;

          return (
            <div key={meal.meal_name} className="border-l-2 border-muted pl-3">
              <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                <p className="text-sm font-medium flex items-center gap-1">
                  {meal.meal_name}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={anyBusy || products.length === 0}
                    onClick={() => onGenerateMeal(date, meal.meal_name)}
                    title="Generar con IA"
                  >
                    {mealBusy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                  </Button>
                  {mealEntries.length > 0 && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      disabled={anyBusy}
                      onClick={() => onRegenerateMeal(date, meal.meal_name)}
                      title="Regenerar alternativa"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                  {status === "ok" && <span>✅</span>}
                  {status === "warn" && <span>⚠️</span>}
                </p>
                {target && (
                  <p className="text-xs text-muted-foreground">
                    {totals.hc.toFixed(1)}/{target.target_hc} HC ·{" "}
                    {totals.prot.toFixed(1)}/{target.target_prot} P ·{" "}
                    {totals.fat.toFixed(1)}/{target.target_fat} G
                  </p>
                )}
              </div>

              {recipeName && (
                <p className="text-sm font-semibold mb-1">{recipeName}</p>
              )}

              <div className="space-y-1 mb-2">
                {mealEntries.map((e) => {
                  const ingredient =
                    extractIngredientName(e.food_name) ||
                    e.food_name ||
                    "Ingrediente";
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-2 text-xs bg-muted/30 rounded px-2 py-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={e.consumed}
                          onChange={() => onToggleConsumed(e.id, e.consumed)}
                          className="shrink-0"
                          title="Marcar como consumida"
                        />
                        <span
                          className={`truncate ${e.consumed ? "line-through text-muted-foreground" : ""}`}
                        >
                          {ingredient} · {Number(e.grams).toFixed(0)}g
                        </span>
                        <Badge variant="outline" className="shrink-0">
                          {Number(e.hc_total).toFixed(1)}/
                          {Number(e.prot_total).toFixed(1)}/
                          {Number(e.fat_total).toFixed(1)}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => onRemove(e.id)}
                      >
                        ✕
                      </Button>
                    </div>
                  );
                })}
              </div>

              {products.length > 0 && (
                <AddEntryForm
                  products={products}
                  onAdd={(productId, grams) =>
                    onAdd(date, meal.meal_name, productId, grams)
                  }
                />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AddEntryForm({
  products,
  onAdd,
}: {
  products: AvailableProduct[];
  onAdd: (productId: string, grams: number) => void;
}) {
  const [productId, setProductId] = useState<string>("");
  const [grams, setGrams] = useState<string>("100");

  const selected = products.find((p) => p.product_id === productId);
  const preview = selected
    ? calculateExchanges(
        Number(grams) || 0,
        selected.kcal_per_100g,
        selected.carbs_per_100g,
        selected.protein_per_100g,
        selected.fat_per_100g,
      )
    : null;

  const submit = () => {
    const g = Number(grams);
    if (!productId || !g || g <= 0) {
      toast.error("Selecciona producto y gramos");
      return;
    }
    onAdd(productId, g);
    setProductId("");
    setGrams("100");
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger className="h-8 text-xs flex-1">
            <SelectValue placeholder="Producto del stock…" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.product_id} value={p.product_id}>
                {p.name}
                {p.brand ? ` · ${p.brand}` : ""} ·{" "}
                {p.available_grams.toFixed(0)}g disp.
                {!p.kcal_per_100g ? " (sin kcal)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          inputMode="numeric"
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          className="h-8 text-xs w-20"
          placeholder="g"
        />
        <Button size="sm" className="h-8" onClick={submit}>
          +
        </Button>
      </div>
      {preview && selected?.kcal_per_100g ? (
        <p className="text-[11px] text-muted-foreground pl-1">
          ≈ {preview.hc.toFixed(2)} HC · {preview.prot.toFixed(2)} P ·{" "}
          {preview.fat.toFixed(2)} G
        </p>
      ) : null}
    </div>
  );
}

// ---------- Targets ----------

function TargetsTab() {
  const [targets, setTargets] = useState<MealTarget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMealTargets()
      .then(setTargets)
      .catch(() => toast.error("Error al cargar objetivos"))
      .finally(() => setLoading(false));
  }, []);

  const merged = DEFAULT_MEALS.map((m) => {
    const existing = targets.find((t) => t.meal_name === m.meal_name);
    return (
      existing ?? {
        id: "",
        user_id: "",
        meal_name: m.meal_name,
        meal_order: m.meal_order,
        target_hc: 0,
        target_prot: 0,
        target_fat: 0,
      }
    );
  });

  const handleSave = async (t: MealTarget) => {
    try {
      await upsertMealTarget({
        meal_name: t.meal_name,
        meal_order: t.meal_order,
        target_hc: Number(t.target_hc) || 0,
        target_prot: Number(t.target_prot) || 0,
        target_fat: Number(t.target_fat) || 0,
      });
      toast.success(`Objetivos guardados: ${t.meal_name}`);
      const fresh = await fetchMealTargets();
      setTargets(fresh);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar");
    }
  };

  if (loading)
    return <p className="text-muted-foreground text-sm">Cargando…</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Define los intercambios objetivo para cada comida del día.
      </p>
      {merged.map((t) => (
        <TargetRow
          key={t.meal_name}
          target={t}
          onChange={(patch) => {
            setTargets((prev) => {
              const exists = prev.find((p) => p.meal_name === t.meal_name);
              if (exists) {
                return prev.map((p) =>
                  p.meal_name === t.meal_name ? { ...p, ...patch } : p,
                );
              }
              return [...prev, { ...t, ...patch }];
            });
          }}
          onSave={handleSave}
        />
      ))}
    </div>
  );
}

function TargetRow({
  target,
  onChange,
  onSave,
}: {
  target: MealTarget;
  onChange: (patch: Partial<MealTarget>) => void;
  onSave: (t: MealTarget) => void;
}) {
  return (
    <Card>
      <CardContent className="py-3">
        <p className="text-sm font-medium mb-2">{target.meal_name}</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">HC</Label>
            <Input
              type="number"
              step="0.5"
              value={target.target_hc}
              onChange={(e) => onChange({ target_hc: Number(e.target.value) })}
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">Proteína</Label>
            <Input
              type="number"
              step="0.5"
              value={target.target_prot}
              onChange={(e) =>
                onChange({ target_prot: Number(e.target.value) })
              }
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-xs">Grasa</Label>
            <Input
              type="number"
              step="0.5"
              value={target.target_fat}
              onChange={(e) => onChange({ target_fat: Number(e.target.value) })}
              className="h-8"
            />
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={() => onSave(target)}>
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
