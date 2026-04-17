import { useState, useMemo, type FormEvent } from "react";
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
import {
  toBulk,
  fromBulk,
  formatNumber,
  pluralizeUnit,
  type TrackingMode,
} from "@/lib/stock-conversion";

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
  const mode: TrackingMode = (item.tracking_mode ?? "bulk") as TrackingMode;

  const [count, setCount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isAdjustment = type === "adjustment";
  const bulkUnit = item.unit;
  const stockBulk = Number(item.quantity);

  // Max amount in current mode units
  const maxInMode = useMemo(() => {
    if (mode === "bulk") return stockBulk;
    return fromBulk(stockBulk, mode, item.products) ?? stockBulk;
  }, [mode, stockBulk, item.products]);

  const numericCount = Number(count);
  const validInput = !!count && (isAdjustment ? numericCount !== 0 : numericCount > 0);
  const bulkDelta = validInput ? toBulk(Math.abs(numericCount), mode, item.products) : 0;
  const signedBulkDelta = isAdjustment && numericCount < 0 ? -bulkDelta : bulkDelta;

  const modeUnitLabel =
    mode === "package" ? pluralizeUnit("package", numericCount || 1) :
    mode === "serving" ? pluralizeUnit("serving", numericCount || 1) :
    bulkUnit;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validInput) {
      setError("Cantidad inválida");
      return;
    }

    if (!isAdjustment && numericCount > maxInMode) {
      setError(`Máximo disponible: ${formatNumber(maxInMode)} ${modeUnitLabel}`);
      return;
    }

    if (isAdjustment && stockBulk + signedBulkDelta < 0) {
      setError(`El ajuste dejaría el stock en negativo`);
      return;
    }

    setError("");
    setLoading(true);
    try {
      // createMovement expects positive quantity_delta; sign is applied by type.
      // For adjustment we pass the signed value as-is.
      const qtyDeltaForApi = isAdjustment ? signedBulkDelta : bulkDelta;

      await createMovement({
        stock_item_id: item.id,
        product_id: item.product_id,
        movement_type: type,
        quantity_delta: qtyDeltaForApi,
        unit: bulkUnit,
        notes: notes.trim() || null,
      });
      setCount("");
      setNotes("");
      onOpenChange(false);
      toast.success(`${TITLES[type]} registrado correctamente`);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputLabel = isAdjustment
    ? `Cantidad (+ o −) en ${modeUnitLabel}`
    : `Cantidad en ${modeUnitLabel} (máx ${formatNumber(maxInMode)})`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{TITLES[type]}</DialogTitle>
          <DialogDescription>{DESCRIPTIONS[type]}</DialogDescription>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-2">
          <span className="font-medium text-foreground">{item.products.name}</span>
          {" · "}Stock actual: {formatNumber(maxInMode)} {modeUnitLabel}
          {mode !== "bulk" && (
            <span className="text-xs"> ({formatNumber(stockBulk)} {bulkUnit})</span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>{inputLabel}</Label>
            <Input
              type="number"
              step="any"
              min={isAdjustment ? undefined : "0.01"}
              max={isAdjustment ? undefined : String(maxInMode)}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder={isAdjustment ? "Ej: -1 o 2" : `Máx ${formatNumber(maxInMode)}`}
              required
              autoFocus
            />
            {validInput && mode !== "bulk" && (
              <p className="text-xs text-muted-foreground">
                = {formatNumber(Math.abs(signedBulkDelta))} {bulkUnit}
                {isAdjustment && numericCount < 0 ? " (resta)" : ""}
              </p>
            )}
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
