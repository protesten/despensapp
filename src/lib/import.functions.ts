import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  movementImportPayloadSchema,
  type PreviewMovement,
  type ImportPreviewResult,
} from "./export-import.schemas";

export const previewImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { json: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Parse JSON
    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(data.json);
    } catch {
      throw new Error("JSON inválido");
    }

    // Validate schema
    const parseResult = movementImportPayloadSchema.safeParse(rawPayload);

    const validationErrors: string[] = [];
    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        validationErrors.push(`${issue.path.join(".")}: ${issue.message}`);
      }
    }

    // Create import_log
    const { data: logRow, error: logErr } = await supabase
      .from("import_logs")
      .insert({
        user_id: userId,
        source: "manual_json",
        raw_payload: rawPayload as any,
        status: validationErrors.length > 0 ? "rejected" : "previewed",
        validation_errors: validationErrors.length > 0 ? validationErrors as any : null,
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
      } satisfies ImportPreviewResult;
    }

    // Build preview by checking each movement against current stock
    const preview: PreviewMovement[] = [];
    const globalErrors: string[] = [];

    for (let i = 0; i < parseResult.data.movements.length; i++) {
      const mov = parseResult.data.movements[i];

      const { data: stockItem } = await supabase
        .from("stock_items")
        .select("quantity, unit, status, product_id, products(name)")
        .eq("id", mov.stock_item_id)
        .single();

      if (!stockItem) {
        const pm: PreviewMovement = {
          ...mov,
          product_name: "???",
          current_quantity: 0,
          current_unit: mov.unit,
          resulting_quantity: 0,
          resulting_status: "error",
          error: `Stock item ${mov.stock_item_id} no encontrado`,
        };
        preview.push(pm);
        globalErrors.push(`[${i}] Stock no encontrado`);
        continue;
      }

      if (stockItem.unit !== mov.unit) {
        const pm: PreviewMovement = {
          ...mov,
          product_name: (stockItem as any).products?.name ?? "???",
          current_quantity: Number(stockItem.quantity),
          current_unit: stockItem.unit,
          resulting_quantity: Number(stockItem.quantity),
          resulting_status: stockItem.status ?? "available",
          error: `Unidad incompatible: stock=${stockItem.unit}, movimiento=${mov.unit}`,
        };
        preview.push(pm);
        globalErrors.push(`[${i}] Unidad incompatible`);
        continue;
      }

      if (stockItem.product_id !== mov.product_id) {
        const pm: PreviewMovement = {
          ...mov,
          product_name: (stockItem as any).products?.name ?? "???",
          current_quantity: Number(stockItem.quantity),
          current_unit: stockItem.unit,
          resulting_quantity: Number(stockItem.quantity),
          resulting_status: stockItem.status ?? "available",
          error: `product_id no coincide con el stock_item`,
        };
        preview.push(pm);
        globalErrors.push(`[${i}] product_id no coincide`);
        continue;
      }

      const effectiveDelta = mov.movement_type === "adjustment"
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
      });
    }

    const valid = globalErrors.length === 0;

    // Update log with validation result
    if (!valid) {
      await supabase
        .from("import_logs")
        .update({
          status: "previewed",
          validation_errors: globalErrors as any,
        })
        .eq("id", logRow.id);
    }

    return {
      valid,
      preview,
      errors: globalErrors,
      import_log_id: logRow.id,
    } satisfies ImportPreviewResult;
  });

export const applyImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { import_log_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch the import log
    const { data: log, error: logErr } = await supabase
      .from("import_logs")
      .select("*")
      .eq("id", data.import_log_id)
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
          .single();

        if (!stockItem) {
          errors.push(`[${i}] Stock no encontrado`);
          continue;
        }

        if (stockItem.unit !== mov.unit) {
          errors.push(`[${i}] Unidad incompatible`);
          continue;
        }

        const effectiveDelta = mov.movement_type === "adjustment"
          ? mov.quantity_delta
          : -Math.abs(mov.quantity_delta);

        const newQty = Number(stockItem.quantity) + effectiveDelta;
        if (newQty < 0) {
          errors.push(`[${i}] Stock insuficiente`);
          continue;
        }

        // Insert movement
        const { error: movErr } = await supabase
          .from("inventory_movements")
          .insert({
            product_id: mov.product_id,
            stock_item_id: mov.stock_item_id,
            movement_type: mov.movement_type,
            quantity_delta: effectiveDelta,
            unit: mov.unit,
            moved_at: new Date().toISOString(),
            user_id: userId,
            notes: mov.notes ?? `Importado desde log ${data.import_log_id}`,
          });

        if (movErr) {
          errors.push(`[${i}] Error al insertar movimiento: ${movErr.message}`);
          continue;
        }

        // Update stock
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

    // Update log
    await supabase
      .from("import_logs")
      .update({
        status: errors.length > 0 ? "previewed" : "applied",
        applied_at: new Date().toISOString(),
        validation_errors: errors.length > 0 ? (errors as any) : null,
      })
      .eq("id", data.import_log_id);

    return {
      applied_count: applied.length,
      error_count: errors.length,
      errors,
    };
  });
