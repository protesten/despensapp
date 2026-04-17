import * as XLSX from "xlsx";
import { exportStockDetailed, exportConsolidated, type ConsolidatedProduct } from "./export.functions";
import { LOCATION_LABELS, STATUS_LABELS, OPEN_STATUS_LABELS } from "./stock";

export interface StockRow {
  producto: string;
  marca: string;
  cantidad: number;
  unidad: string;
  ubicacion: string;
  estado: string;
  apertura: string;
  fecha_compra: string;
  fecha_caducidad: string;
  coste_unitario: string;
  modo_seguimiento: string;
  envases: string;
  raciones: string;
  abierto_el: string;
  creado_el: string;
}

function stripEmoji(label?: string | null): string {
  if (!label) return "";
  return label.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").trim();
}

async function buildStockRows(): Promise<StockRow[]> {
  const { stock } = await exportStockDetailed();
  return (stock as any[]).map((s) => ({
    producto: s.products?.name ?? "",
    marca: s.products?.brand ?? "",
    cantidad: Number(s.quantity ?? 0),
    unidad: s.unit ?? "",
    ubicacion: stripEmoji(LOCATION_LABELS[s.location ?? ""] ?? s.location ?? ""),
    estado: STATUS_LABELS[s.status ?? ""] ?? s.status ?? "",
    apertura: OPEN_STATUS_LABELS[s.open_status ?? ""] ?? s.open_status ?? "",
    fecha_compra: s.purchase_date ?? "",
    fecha_caducidad: s.expiration_date ?? "",
    coste_unitario: s.unit_cost != null ? String(s.unit_cost) : "",
    modo_seguimiento: s.tracking_mode ?? "",
    envases: s.package_count != null ? String(s.package_count) : "",
    raciones: s.serving_count != null ? String(s.serving_count) : "",
    abierto_el: s.opened_at ?? "",
    creado_el: s.created_at ?? "",
  }));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function exportStockToCSV(): Promise<number> {
  const rows = await buildStockRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
  // BOM for Excel UTF-8 compatibility
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `despensapp-stock-${todayStamp()}.csv`);
  return rows.length;
}

export async function exportStockToXLSX(): Promise<number> {
  const rows = await buildStockRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto-fit column widths
  const headers = Object.keys(rows[0] ?? {});
  ws["!cols"] = headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String((r as any)[h] ?? "").length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Stock");
  XLSX.writeFile(wb, `despensapp-stock-${todayStamp()}.xlsx`);
  return rows.length;
}

// ───────────────────────────────────────────────────────────────────
// Consolidado: una fila por producto
// ───────────────────────────────────────────────────────────────────

export interface ConsolidatedRow {
  producto: string;
  marca: string;
  categoria: string;
  cantidad_total: string;
  unidad: string;
  cantidad_g: string;
  cantidad_ml: string;
  cantidad_unidades: string;
  ubicaciones: string;
  envases_abiertos: number;
  envases_cerrados: number;
  total_items: number;
  caducidad_proxima: string;
  todo_caducado: string;
  base_nutricional: string;
  kcal_por_100: string;
  proteinas_por_100: string;
  carbohidratos_por_100: string;
  grasas_por_100: string;
  nutricion_completa: string;
  relevancia_nutricional: string;
  cuenta_para_macros: string;
  fuente: string;
  fuente_coherente: string;
}

const yesNo = (v: boolean) => (v ? "Sí" : "No");
const numStr = (v: number | null | undefined) =>
  v != null && !Number.isNaN(v) ? String(v) : "";

function mapConsolidatedRow(p: ConsolidatedProduct): ConsolidatedRow {
  const locLabels = (p.locations ?? []).map((l) =>
    stripEmoji(LOCATION_LABELS[l] ?? l),
  );
  return {
    producto: p.name,
    marca: p.brand ?? "",
    categoria: p.category ?? "",
    cantidad_total: numStr(p.total_quantity),
    unidad: p.unit ?? "",
    cantidad_g: numStr(p.quantity_by_unit?.g),
    cantidad_ml: numStr(p.quantity_by_unit?.ml),
    cantidad_unidades: numStr(p.quantity_by_unit?.unit),
    ubicaciones: locLabels.join(", "),
    envases_abiertos: p.open_items,
    envases_cerrados: p.sealed_items,
    total_items: p.total_items,
    caducidad_proxima: p.nearest_expiration_date ?? "",
    todo_caducado: yesNo(p.all_expired),
    base_nutricional: p.nutrition_basis ?? "",
    kcal_por_100: numStr(p.kcal_per_100),
    proteinas_por_100: numStr(p.protein_per_100),
    carbohidratos_por_100: numStr(p.carbs_per_100),
    grasas_por_100: numStr(p.fat_per_100),
    nutricion_completa: yesNo(p.nutrition_complete),
    relevancia_nutricional: p.nutrition_relevance,
    cuenta_para_macros: yesNo(p.counts_for_macros),
    fuente: p.source ?? "",
    fuente_coherente: yesNo(p.source_coherent),
  };
}

async function buildConsolidatedRows(): Promise<ConsolidatedRow[]> {
  const { products } = await exportConsolidated();
  return products.map(mapConsolidatedRow);
}

export async function exportConsolidatedToCSV(): Promise<number> {
  const rows = await buildConsolidatedRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `despensapp-consolidado-${todayStamp()}.csv`);
  return rows.length;
}

export async function exportConsolidatedToXLSX(): Promise<number> {
  const rows = await buildConsolidatedRows();
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] ?? {});
  ws["!cols"] = headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map((r) => String((r as any)[h] ?? "").length),
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Consolidado");
  XLSX.writeFile(wb, `despensapp-consolidado-${todayStamp()}.xlsx`);
  return rows.length;
}
