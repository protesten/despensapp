import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppNav } from "@/components/layout/AppNav";
import { toast } from "sonner";
import {
  fetchExchangeFoods,
  createExchangeFood,
  updateExchangeFood,
  deleteExchangeFood,
  fetchMealTargets,
  upsertMealTarget,
  fetchMealPlanEntries,
  createMealPlanEntry,
  deleteMealPlanEntry,
  getWeekDates,
  formatDayLabel,
  approxEqual,
  DEFAULT_MEALS,
  type ExchangeFood,
  type MealTarget,
  type MealPlanEntry,
} from "@/lib/diet";

export const Route = createFileRoute("/_authenticated/dieta")({
  component: DietPage,
});

function DietPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader title="🥗 Dieta" showUser />
      <div className="px-4 py-3 border-b border-border">
        <AppNav />
      </div>
      <div className="container mx-auto p-4 max-w-6xl">
        <Tabs defaultValue="planificador">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="planificador">📅 Planificador</TabsTrigger>
            <TabsTrigger value="catalogo">📚 Catálogo</TabsTrigger>
            <TabsTrigger value="objetivos">🎯 Objetivos</TabsTrigger>
          </TabsList>
          <TabsContent value="planificador" className="mt-4">
            <PlannerTab />
          </TabsContent>
          <TabsContent value="catalogo" className="mt-4">
            <CatalogTab />
          </TabsContent>
          <TabsContent value="objetivos" className="mt-4">
            <TargetsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* =========================== PLANIFICADOR =========================== */
function PlannerTab() {
  const [weekRef, setWeekRef] = useState(new Date());
  const weekDates = useMemo(() => getWeekDates(weekRef), [weekRef]);
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);
  const [foods, setFoods] = useState<ExchangeFood[]>([]);
  const [targets, setTargets] = useState<MealTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(weekDates[0]);

  const load = async () => {
    setLoading(true);
    try {
      const [e, f, t] = await Promise.all([
        fetchMealPlanEntries(weekDates[0], weekDates[6]),
        fetchExchangeFoods(),
        fetchMealTargets(),
      ]);
      setEntries(e);
      setFoods(f);
      setTargets(t);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar el plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setActiveDay(weekDates[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekRef]);

  const addEntry = async (
    date: string,
    mealName: string,
    foodId: string,
    servings: number,
  ) => {
    const food = foods.find((f) => f.id === foodId);
    if (!food) return;
    try {
      await createMealPlanEntry({
        plan_date: date,
        meal_name: mealName,
        food_name: food.name,
        servings,
        hc_total: food.hc * servings,
        prot_total: food.prot * servings,
        fat_total: food.fat * servings,
      });
      toast.success("Añadido");
      load();
    } catch (err) {
      console.error(err);
      toast.error("Error al añadir");
    }
  };

  const removeEntry = async (id: string) => {
    try {
      await deleteMealPlanEntry(id);
      load();
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar");
    }
  };

  const shiftWeek = (delta: number) => {
    const d = new Date(weekRef);
    d.setDate(d.getDate() + delta * 7);
    setWeekRef(d);
  };

  if (loading) return <p className="text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => shiftWeek(-1)}>
            ← Semana
          </Button>
          <Button size="sm" variant="outline" onClick={() => setWeekRef(new Date())}>
            Hoy
          </Button>
          <Button size="sm" variant="outline" onClick={() => shiftWeek(1)}>
            Semana →
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">
          {formatDayLabel(weekDates[0])} – {formatDayLabel(weekDates[6])}
        </span>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {weekDates.map((d) => (
          <Button
            key={d}
            size="sm"
            variant={activeDay === d ? "default" : "outline"}
            onClick={() => setActiveDay(d)}
            className="shrink-0"
          >
            {formatDayLabel(d)}
          </Button>
        ))}
      </div>

      <DayPlan
        date={activeDay}
        entries={entries.filter((e) => e.plan_date === activeDay)}
        targets={targets}
        foods={foods}
        onAdd={addEntry}
        onRemove={removeEntry}
      />
    </div>
  );
}

function DayPlan({
  date,
  entries,
  targets,
  foods,
  onAdd,
  onRemove,
}: {
  date: string;
  entries: MealPlanEntry[];
  targets: MealTarget[];
  foods: ExchangeFood[];
  onAdd: (date: string, mealName: string, foodId: string, servings: number) => void;
  onRemove: (id: string) => void;
}) {
  const meals = useMemo(() => {
    if (targets.length === 0) return DEFAULT_MEALS.map((m) => ({ ...m })) as MealTarget[];
    return [...targets].sort((a, b) => a.meal_order - b.meal_order);
  }, [targets]);

  const dayTotals = entries.reduce(
    (acc, e) => ({
      hc: acc.hc + Number(e.hc_total),
      prot: acc.prot + Number(e.prot_total),
      fat: acc.fat + Number(e.fat_total),
    }),
    { hc: 0, prot: 0, fat: 0 },
  );
  const dayTargets = targets.reduce(
    (acc, t) => ({
      hc: acc.hc + Number(t.target_hc),
      prot: acc.prot + Number(t.target_prot),
      fat: acc.fat + Number(t.target_fat),
    }),
    { hc: 0, prot: 0, fat: 0 },
  );

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center text-sm">
          <strong>Total día:</strong>
          <Badge variant="secondary">
            HC {dayTotals.hc.toFixed(1)} / {dayTargets.hc.toFixed(1)}
          </Badge>
          <Badge variant="secondary">
            Prot {dayTotals.prot.toFixed(1)} / {dayTargets.prot.toFixed(1)}
          </Badge>
          <Badge variant="secondary">
            Grasa {dayTotals.fat.toFixed(1)} / {dayTargets.fat.toFixed(1)}
          </Badge>
        </CardContent>
      </Card>

      {meals.map((meal) => {
        const mealEntries = entries.filter((e) => e.meal_name === meal.meal_name);
        const totals = mealEntries.reduce(
          (acc, e) => ({
            hc: acc.hc + Number(e.hc_total),
            prot: acc.prot + Number(e.prot_total),
            fat: acc.fat + Number(e.fat_total),
          }),
          { hc: 0, prot: 0, fat: 0 },
        );
        const target = targets.find((t) => t.meal_name === meal.meal_name);
        const ok =
          target &&
          approxEqual(totals.hc, target.target_hc) &&
          approxEqual(totals.prot, target.target_prot) &&
          approxEqual(totals.fat, target.target_fat);
        const hasAny = mealEntries.length > 0;

        return (
          <Card key={meal.meal_name}>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                {meal.meal_name}
                {hasAny && <span>{ok ? "✅" : "⚠️"}</span>}
              </CardTitle>
              {target && (
                <span className="text-xs text-muted-foreground">
                  HC {totals.hc.toFixed(1)}/{target.target_hc} · P{" "}
                  {totals.prot.toFixed(1)}/{target.target_prot} · G{" "}
                  {totals.fat.toFixed(1)}/{target.target_fat}
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {mealEntries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-2 text-sm border-b border-border pb-1"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{e.food_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {Number(e.servings)} porciones · HC {Number(e.hc_total).toFixed(1)}{" "}
                      · P {Number(e.prot_total).toFixed(1)} · G{" "}
                      {Number(e.fat_total).toFixed(1)}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemove(e.id)}
                    aria-label="Eliminar"
                  >
                    🗑️
                  </Button>
                </div>
              ))}
              <AddEntryForm
                foods={foods}
                onAdd={(foodId, servings) => onAdd(date, meal.meal_name, foodId, servings)}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function AddEntryForm({
  foods,
  onAdd,
}: {
  foods: ExchangeFood[];
  onAdd: (foodId: string, servings: number) => void;
}) {
  const [foodId, setFoodId] = useState<string>("");
  const [servings, setServings] = useState<string>("1");

  const submit = () => {
    const n = Number(servings);
    if (!foodId || !Number.isFinite(n) || n <= 0) return;
    onAdd(foodId, n);
    setFoodId("");
    setServings("1");
  };

  if (foods.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Añade alimentos en la pestaña Catálogo.
      </p>
    );
  }

  return (
    <div className="flex gap-2 items-end pt-1">
      <div className="flex-1 min-w-0">
        <Select value={foodId} onValueChange={setFoodId}>
          <SelectTrigger>
            <SelectValue placeholder="Alimento…" />
          </SelectTrigger>
          <SelectContent>
            {foods.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name} (HC {f.hc} · P {f.prot} · G {f.fat})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        type="number"
        step="0.25"
        min="0"
        value={servings}
        onChange={(e) => setServings(e.target.value)}
        className="w-20"
        aria-label="Porciones"
      />
      <Button size="sm" onClick={submit}>
        +
      </Button>
    </div>
  );
}

/* =========================== CATÁLOGO =========================== */
function CatalogTab() {
  const [foods, setFoods] = useState<ExchangeFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ExchangeFood | null>(null);
  const [form, setForm] = useState({
    name: "",
    serving_g: "",
    hc: "",
    prot: "",
    fat: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      setFoods(await fetchExchangeFoods());
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar catálogo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setEditing(null);
    setForm({ name: "", serving_g: "", hc: "", prot: "", fat: "" });
  };

  const startEdit = (f: ExchangeFood) => {
    setEditing(f);
    setForm({
      name: f.name,
      serving_g: String(f.serving_g),
      hc: String(f.hc),
      prot: String(f.prot),
      fat: String(f.fat),
    });
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Nombre obligatorio");
      return;
    }
    const payload = {
      name: form.name.trim(),
      serving_g: Number(form.serving_g) || 0,
      hc: Number(form.hc) || 0,
      prot: Number(form.prot) || 0,
      fat: Number(form.fat) || 0,
    };
    try {
      if (editing) {
        await updateExchangeFood(editing.id, payload);
        toast.success("Actualizado");
      } else {
        await createExchangeFood(payload);
        toast.success("Añadido");
      }
      reset();
      load();
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar");
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    try {
      await deleteExchangeFood(id);
      load();
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editing ? "Editar alimento" : "Añadir alimento"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <Label>Nombre</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>g/porción</Label>
            <Input
              type="number"
              value={form.serving_g}
              onChange={(e) => setForm({ ...form, serving_g: e.target.value })}
            />
          </div>
          <div>
            <Label>HC</Label>
            <Input
              type="number"
              step="0.1"
              value={form.hc}
              onChange={(e) => setForm({ ...form, hc: e.target.value })}
            />
          </div>
          <div>
            <Label>Prot</Label>
            <Input
              type="number"
              step="0.1"
              value={form.prot}
              onChange={(e) => setForm({ ...form, prot: e.target.value })}
            />
          </div>
          <div>
            <Label>Grasa</Label>
            <Input
              type="number"
              step="0.1"
              value={form.fat}
              onChange={(e) => setForm({ ...form, fat: e.target.value })}
            />
          </div>
          <div className="sm:col-span-6 flex gap-2">
            <Button onClick={submit}>{editing ? "Guardar" : "Añadir"}</Button>
            {editing && (
              <Button variant="outline" onClick={reset}>
                Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Cargando…</p>
      ) : foods.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay alimentos todavía. Añade el primero arriba.
        </p>
      ) : (
        <div className="space-y-2">
          {foods.map((f) => (
            <Card key={f.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{f.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {Number(f.serving_g)} g · HC {Number(f.hc)} · P {Number(f.prot)} · G{" "}
                    {Number(f.fat)}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => startEdit(f)}>
                    ✏️
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remove(f.id, f.name)}
                  >
                    🗑️
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================== OBJETIVOS =========================== */
function TargetsTab() {
  const [targets, setTargets] = useState<MealTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<
    Array<{
      meal_name: string;
      meal_order: number;
      target_hc: string;
      target_prot: string;
      target_fat: string;
    }>
  >([]);

  const load = async () => {
    setLoading(true);
    try {
      const t = await fetchMealTargets();
      setTargets(t);
      const merged = DEFAULT_MEALS.map((dm) => {
        const ex = t.find((x) => x.meal_name === dm.meal_name);
        return {
          meal_name: dm.meal_name,
          meal_order: ex?.meal_order ?? dm.meal_order,
          target_hc: ex ? String(ex.target_hc) : "0",
          target_prot: ex ? String(ex.target_prot) : "0",
          target_fat: ex ? String(ex.target_fat) : "0",
        };
      });
      // include any custom meal not in defaults
      t.forEach((x) => {
        if (!merged.find((m) => m.meal_name === x.meal_name)) {
          merged.push({
            meal_name: x.meal_name,
            meal_order: x.meal_order,
            target_hc: String(x.target_hc),
            target_prot: String(x.target_prot),
            target_fat: String(x.target_fat),
          });
        }
      });
      merged.sort((a, b) => a.meal_order - b.meal_order);
      setRows(merged);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar objetivos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateRow = (idx: number, key: string, value: string) => {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  };

  const saveAll = async () => {
    try {
      for (const r of rows) {
        await upsertMealTarget({
          meal_name: r.meal_name,
          meal_order: r.meal_order,
          target_hc: Number(r.target_hc) || 0,
          target_prot: Number(r.target_prot) || 0,
          target_fat: Number(r.target_fat) || 0,
        });
      }
      toast.success("Objetivos guardados");
      load();
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar");
    }
  };

  if (loading) return <p className="text-muted-foreground">Cargando…</p>;

  const totals = rows.reduce(
    (acc, r) => ({
      hc: acc.hc + (Number(r.target_hc) || 0),
      prot: acc.prot + (Number(r.target_prot) || 0),
      fat: acc.fat + (Number(r.target_fat) || 0),
    }),
    { hc: 0, prot: 0, fat: 0 },
  );

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center text-sm">
          <strong>Totales día:</strong>
          <Badge variant="secondary">HC {totals.hc.toFixed(1)}</Badge>
          <Badge variant="secondary">Prot {totals.prot.toFixed(1)}</Badge>
          <Badge variant="secondary">Grasa {totals.fat.toFixed(1)}</Badge>
        </CardContent>
      </Card>

      {rows.map((r, i) => (
        <Card key={r.meal_name}>
          <CardContent className="p-3 grid gap-2 sm:grid-cols-5 items-end">
            <div className="sm:col-span-2">
              <Label>{r.meal_name}</Label>
            </div>
            <div>
              <Label className="text-xs">HC</Label>
              <Input
                type="number"
                step="0.5"
                value={r.target_hc}
                onChange={(e) => updateRow(i, "target_hc", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Prot</Label>
              <Input
                type="number"
                step="0.5"
                value={r.target_prot}
                onChange={(e) => updateRow(i, "target_prot", e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Grasa</Label>
              <Input
                type="number"
                step="0.5"
                value={r.target_fat}
                onChange={(e) => updateRow(i, "target_fat", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button onClick={saveAll}>Guardar objetivos</Button>
      {targets.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Aún no has configurado objetivos. Ajusta los valores y pulsa Guardar.
        </p>
      )}
    </div>
  );
}
