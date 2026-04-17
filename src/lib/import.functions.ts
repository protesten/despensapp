import { supabase } from "@/integrations/supabase/client";
import {
  movementImportPayloadSchema,
  type PreviewMovement,
  type ImportPreviewResult,
  type MovementImportItem,
} from "./export-import.schemas";

/**
 * Resuelve el stock_item para un movimiento. Devuelve también hints de diagnóstico
 * cuando los IDs no cuadran:
 *  - si stock_item_id no existe pero product_id sí → puede ser ID inventado / confusión
 *  - si stock_item_id corresponde realmente a un product_id (campos invertidos) → swap hint
 *  - si stock_item_id no existe pero el product_id apunta a un único stock activo → auto-resolver
 */
async function resolveStockItem(mov: MovementImportItem) {
  // 1. Intento directo por stock_item_id
  const { data: direct } = await supabase
    .from("stock_items")
    .select("id, quantity, unit, status, product_id, products(name)")
    .eq("id", mov.stock_item_id)
    .maybeSingle();

  if (direct) {
    return {
      stockItem: direct,
      resolved_stock_item_id: null,
      product_id_exists: true,
      ids_swapped_hint: false,
    };
  }

  // 2. ¿Existe el product_id como producto?
  const { data: productRow } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", mov.product_id)
    .maybeSingle();

  // 3. ¿El stock_item_id que mandaron es en realidad un product_id (swap)?
  const { data: swappedProduct } = await supabase
    .from("products")
    .select("id")
    .eq("id", mov.stock_item_id)
    .maybeSingle();
  const ids_swapped_hint = !!swappedProduct;

  // 4. Auto-resolución tolerante: si el product_id es válido y solo hay un stock activo
  if (productRow) {
    const { data: activeStocks } = await supabase
      .from("stock_items")
      .select("id, quantity, unit, status, product_id, products(name)")
      .eq("product_id", mov.product_id)
      .neq("status", "consumed");

    if (activeStocks && activeStocks.length === 1) {
      return {
        stockItem: activeStocks[0],
        resolved_stock_item_id: activeStocks[0].id,
        product_id_exists: true,
        ids_swapped_hint,
      };
    }

    return {
      stockItem: null,
      resolved_stock_item_id: null,
      product_id_exists: true,
      ids_swapped_hint,
      ambiguous_count: activeStocks?.length ?? 0,
      product_name: productRow.name,
    } as const;
  }

  return {
    stockItem: null,
    resolved_stock_item_id: null,
    product_id_exists: false,
    ids_swapped_hint,
  };
}

export async function previewImport(json: string): Promise<ImportPreviewResult> {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("No autenticado");

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(json);
  } catch {
    throw new Error("JSON inválido");
  }

  const parseResult = movementImportPayloadSchema.safeParse(rawPayload);

  const validationErrors: string[] = [];
  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      validationErrors.push(`${issue.path.join(".")}: ${issue.message}`);
    }
  }

  const { data: logRow, error: logErr } = await supabase
    .from("import_logs")
    .insert({
      user_id: userId,
      source: "manual_json",
      raw_payload: rawPayload as any,
      status: validationErrors.length > 0 ? "rejected" : "previewed",
      validation_errors: validationErrors.length > 0 ? (validationErrors as any) : null,
      validated_payload: parseResult.success ? (parseResult.data as any) : null,
    })
    .select("id")
    .single();

  if (logErr) throw new Error(logErr.message);

  if (!parseResult.success) {
    return {
      valid: false,
      preview: [],
      errors: validationErrors,
      import_log_id: logRow.id,
    };
  }

  const preview: PreviewMovement[] = [];
  const globalErrors: string[] = [];
  // Movimientos enriquecidos (con stock_item_id resuelto) para guardar en validated_payload
  const resolvedMovements: MovementImportItem[] = [];

  for (let i = 0; i < parseResult.data.movements.length; i++) {
    const mov = parseResult.data.movements[i];
    const r = await resolveStockItem(mov);

    if (!r.stockItem) {
      const reasons: string[] = [];
      if (!r.product_id_exists) reasons.push(`product_id ${mov.product_id} tampoco existe`);
      else if ("ambiguous_count" in r && r.ambiguous_count && r.ambiguous_count > 1) {
        reasons.push(
          `product_id existe pero tiene ${r.ambiguous_count} stock_items activos — no se puede auto-resolver`,
        );
      } else {
        reasons.push("product_id existe pero sin stock activo");
      }
      if (r.ids_swapped_hint) {
        reasons.push("⚠️ stock_item_id parece ser en realidad un product_id (campos invertidos)");
      }

      preview.push({
        ...mov,
        product_name: ("product_name" in r && r.product_name) || "???",
        current_quantity: 0,
        current_unit: mov.unit,
        resulting_quantity: 0,
        resulting_status: "error",
        error: `Stock no encontrado. ${reasons.join(". ")}`,
        product_id_exists: r.product_id_exists,
        ids_swapped_hint: r.ids_swapped_hint,
      });
      globalErrors.push(`[${i}] Stock no encontrado`);
      // Mantener movimiento original sin resolver para que applyImport vuelva a fallar limpio
      resolvedMovements.push(mov);
      continue;
    }

    const stockItem = r.stockItem;
    const wasResolved = !!r.resolved_stock_item_id;

    if (stockItem.unit !== mov.unit) {
      preview.push({
        ...mov,
        product_name: (stockItem as any).products?.name ?? "???",
        current_quantity: Number(stockItem.quantity),
        current_unit: stockItem.unit,
        resulting_quantity: Number(stockItem.quantity),
        resulting_status: stockItem.status ?? "available",
        error: `Unidad incompatible: stock=${stockItem.unit}, movimiento=${mov.unit}`,
        resolved_stock_item_id: wasResolved ? stockItem.id : null,
        product_id_exists: true,
      });
      globalErrors.push(`[${i}] Unidad incompatible`);
      resolvedMovements.push(mov);
      continue;
    }

    // Validar product_id solo si NO se auto-resolvió (si se resolvió, ya lo aceptamos)
    if (!wasResolved && stockItem.product_id !== mov.product_id) {
      preview.push({
        ...mov,
        product_name: (stockItem as any).products?.name ?? "???",
        current_quantity: Number(stockItem.quantity),
        current_unit: stockItem.unit,
        resulting_quantity: Number(stockItem.quantity),
        resulting_status: stockItem.status ?? "available",
        error: `product_id no coincide con el stock_item (posible confusión de IDs)`,
        product_id_exists: true,
        ids_swapped_hint: r.ids_swapped_hint,
      });
      globalErrors.push(`[${i}] product_id no coincide`);
      resolvedMovements.push(mov);
      continue;
    }

    const effectiveDelta =
      mov.movement_type === "adjustment"
        ? mov.quantity_delta
        : -Math.abs(mov.quantity_delta);

    const newQty = Number(stockItem.quantity) + effectiveDelta;

    let error: string | null = null;
    if (newQty < 0) {
      error = `Stock insuficiente. Disponible: ${stockItem.quantity}, delta: ${effectiveDelta}`;
      globalErrors.push(`[${i}] Stock insuficiente`);
    }

    let resultingStatus: string;
    if (mov.movement_type === "expiry") resultingStatus = "expired";
    else if (newQty === 0) resultingStatus = "consumed";
    else if (newQty <= Number(stockItem.quantity) * 0.2) resultingStatus = "low";
    else resultingStatus = "available";

    preview.push({
      ...mov,
      product_name: (stockItem as any).products?.name ?? "???",
      current_quantity: Number(stockItem.quantity),
      current_unit: stockItem.unit,
      resulting_quantity: Math.max(0, newQty),
      resulting_status: resultingStatus,
      error,
      resolved_stock_item_id: wasResolved ? stockItem.id : null,
      product_id_exists: true,
    });

    // Guardar el movimiento con stock_item_id ya resuelto para que applyImport no tenga que repetir lookup
    resolvedMovements.push({
      ...mov,
      stock_item_id: stockItem.id,
      product_id: stockItem.product_id,
    });
  }

  const valid = globalErrors.length === 0;

  await supabase
    .from("import_logs")
    .update({
      status: valid ? "previewed" : "previewed",
      validation_errors: globalErrors.length > 0 ? (globalErrors as any) : null,
      validated_payload: { movements: resolvedMovements } as any,
    })
    .eq("id", logRow.id);

  return {
    valid,
    preview,
    errors: globalErrors,
    import_log_id: logRow.id,
  };
}

export async function applyImport(import_log_id: string) {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) throw new Error("No autenticado");

  const { data: log, error: logErr } = await supabase
    .from("import_logs")
    .select("*")
    .eq("id", import_log_id)
    .single();

  if (logErr || !log) throw new Error("Import log no encontrado");
  if (log.status === "applied") throw new Error("Ya fue aplicado");
  if (log.status === "rejected") throw new Error("Import fue rechazado");

  const payload = log.validated_payload as any;
  if (!payload?.movements?.length) throw new Error("No hay movimientos validados");

  const applied: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < payload.movements.length; i++) {
    const mov = payload.movements[i];

    try {
      const { data: stockItem } = await supabase
        .from("stock_items")
        .select("quantity, unit, status")
        .eq("id", mov.stock_item_id)
        .maybeSingle();

      if (!stockItem) {
        errors.push(`[${i}] Stock no encontrado`);
        continue;
      }
      if (stockItem.unit !== mov.unit) {
        errors.push(`[${i}] Unidad incompatible`);
        continue;
      }

      const effectiveDelta =
        mov.movement_type === "adjustment"
          ? mov.quantity_delta
          : -Math.abs(mov.quantity_delta);

      const newQty = Number(stockItem.quantity) + effectiveDelta;
      if (newQty < 0) {
        errors.push(`[${i}] Stock insuficiente`);
        continue;
      }

      const { error: movErr } = await supabase.from("inventory_movements").insert({
        product_id: mov.product_id,
        stock_item_id: mov.stock_item_id,
        movement_type: mov.movement_type,
        quantity_delta: effectiveDelta,
        unit: mov.unit,
        moved_at: new Date().toISOString(),
        user_id: userId,
        notes: mov.notes ?? `Importado desde log ${import_log_id}`,
      });

      if (movErr) {
        errors.push(`[${i}] Error: ${movErr.message}`);
        continue;
      }

      let newStatus: string;
      if (mov.movement_type === "expiry") newStatus = "expired";
      else if (newQty === 0) newStatus = "consumed";
      else if (newQty <= Number(stockItem.quantity) * 0.2) newStatus = "low";
      else newStatus = "available";

      await supabase
        .from("stock_items")
        .update({ quantity: newQty, status: newStatus as any })
        .eq("id", mov.stock_item_id);

      applied.push(mov.stock_item_id);
    } catch (e: any) {
      errors.push(`[${i}] ${e.message}`);
    }
  }

  await supabase
    .from("import_logs")
    .update({
      status: errors.length > 0 ? "previewed" : "applied",
      applied_at: new Date().toISOString(),
      validation_errors: errors.length > 0 ? (errors as any) : null,
    })
    .eq("id", import_log_id);

  return {
    applied_count: applied.length,
    error_count: errors.length,
    errors,
  };
}
