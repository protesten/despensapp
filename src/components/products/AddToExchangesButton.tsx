import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createExchangeFood, updateExchangeFood } from "@/lib/diet";
import type { ProductWithNutrition } from "@/lib/products";

interface Props {
  product: ProductWithNutrition;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function AddToExchangesButton({ product }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: product.name,
    serving_g: "0",
    hc: "0",
    prot: "0",
    fat: "0",
  });

  const handleClick = async () => {
    const n = product.product_nutrition;
    const kcal = n?.kcal_per_100g != null ? Number(n.kcal_per_100g) : null;
    if (!kcal || kcal <= 0) {
      toast.error(
        "Este producto no tiene calorías registradas. Añade la información nutricional primero.",
      );
      return;
    }
    const carbs = Number(n?.carbs_per_100g ?? 0);
    const prot = Number(n?.protein_per_100g ?? 0);
    const fat = Number(n?.fat_per_100g ?? 0);

    const calc = {
      serving_g: round2(10000 / kcal),
      hc: round2((carbs * 4) / kcal),
      prot: round2((prot * 4) / kcal),
      fat: round2((fat * 9) / kcal),
    };

    // Buscar si ya existe en exchange_foods (mismo nombre, mismo usuario via RLS)
    const { data: existing, error } = await supabase
      .from("exchange_foods")
      .select("id, name")
      .ilike("name", product.name)
      .limit(1);

    if (error) {
      console.error(error);
      toast.error("Error al consultar el catálogo");
      return;
    }

    if (existing && existing.length > 0) {
      const ok = confirm(
        `"${product.name}" ya existe en el catálogo de intercambios. ¿Quieres actualizarlo con los nuevos valores?`,
      );
      if (!ok) return;
      setExistingId(existing[0].id);
    } else {
      setExistingId(null);
    }

    setForm({
      name: product.name,
      serving_g: String(calc.serving_g),
      hc: String(calc.hc),
      prot: String(calc.prot),
      fat: String(calc.fat),
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nombre obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        serving_g: Number(form.serving_g) || 0,
        hc: Number(form.hc) || 0,
        prot: Number(form.prot) || 0,
        fat: Number(form.fat) || 0,
      };
      if (existingId) {
        await updateExchangeFood(existingId, payload);
        toast.success("Alimento actualizado en el catálogo");
      } else {
        await createExchangeFood(payload);
        toast.success("Añadido al catálogo de intercambios");
      }
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleClick}>
        🥗 Añadir al catálogo de intercambios
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {existingId ? "Actualizar intercambio" : "Añadir al catálogo"}
            </DialogTitle>
            <DialogDescription>
              Valores calculados desde la información nutricional. Puedes editarlos
              antes de guardar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div>
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>g/porción</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.serving_g}
                  onChange={(e) => setForm({ ...form, serving_g: e.target.value })}
                />
              </div>
              <div>
                <Label>HC (intercambios)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.hc}
                  onChange={(e) => setForm({ ...form, hc: e.target.value })}
                />
              </div>
              <div>
                <Label>Prot (intercambios)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.prot}
                  onChange={(e) => setForm({ ...form, prot: e.target.value })}
                />
              </div>
              <div>
                <Label>Grasa (intercambios)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.fat}
                  onChange={(e) => setForm({ ...form, fat: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando…" : existingId ? "Actualizar" : "Añadir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
