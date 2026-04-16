import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { createMovement, type StockItemWithProduct } from "@/lib/stock";

type MovementType = "consumption" | "adjustment" | "waste" | "expiry";

const TITLES: Record<MovementType, string> = {
  consumption: "Registrar consumo",
  adjustment: "Ajuste manual",
  waste: "Registrar merma",
  expiry: "Marcar expirado",
};

const DESCRIPTIONS: Record<MovementType, string> = {
  consumption: "Resta la cantidad consumida del stock.",
  adjustment: "Suma o resta manualmente. Usa negativo para restar.",
  waste: "Resta la cantidad desperdiciada del stock.",
  expiry: "Marca el stock como expirado y resta la cantidad indicada.",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: StockItemWithProduct;
  type: MovementType;
  onSuccess: () => void;
}

export function MovementDialog({ open, onOpenChange, item, type, onSuccess }: Props) {
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdjustment = type === "adjustment";
  const maxQuantity = Number(item.quantity);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const qty = Number(quantity);

    if (!quantity || (isAdjustment ? qty === 0 : qty <= 0)) {
      setError("Cantidad inválida");
      return;
    }

    if (!isAdjustment && qty > maxQuantity) {
      setError(`Máximo disponible: ${maxQuantity} ${item.unit}`);
      return;
    }

    if (isAdjustment && maxQuantity + qty < 0) {
      setError(`El ajuste dejaría el stock en negativo`);
      return;
    }

    setError("");
    setLoading(true);
    try {
      await createMovement({
        stock_item_id: item.id,
        product_id: item.product_id,
        movement_type: type,
        quantity_delta: qty,
        unit: item.unit,
        notes: notes.trim() || null,
      });
      setQuantity("");
      setNotes("");
      onOpenChange(false);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{TITLES[type]}</DialogTitle>
          <DialogDescription>{DESCRIPTIONS[type]}</DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-2">
          <span className="font-medium text-foreground">{item.products.name}</span>
          {" · "}Stock actual: {item.quantity} {item.unit}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Cantidad {isAdjustment ? "(+ o −)" : `(máx ${maxQuantity})`}</Label>
            <Input
              type="number"
              step="any"
              min={isAdjustment ? undefined : "0.01"}
              max={isAdjustment ? undefined : String(maxQuantity)}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={isAdjustment ? "Ej: -50 o 100" : `Máx ${maxQuantity}`}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label>Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Motivo del movimiento..."
              maxLength={500}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Guardando..." : "Confirmar"}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
