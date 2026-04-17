import * as XLSX from "xlsx";
import { exportStockDetailed } from "./export.functions";
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
