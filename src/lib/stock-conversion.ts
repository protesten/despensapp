import type { Product } from "@/lib/products";

export type TrackingMode = "bulk" | "package" | "serving";

export interface ProductSizeFields {
  default_unit: Product["default_unit"] | null;
  package_size_value: number | null;
  package_size_unit: Product["package_size_unit"] | null;
  serving_size_value: number | null;
  serving_size_unit: Product["serving_size_unit"] | null;
}

export interface ModeAvailability {
  bulk: boolean;
  package: boolean;
  serving: boolean;
  packageReason?: string;
  servingReason?: string;
}

const REASON_NO_PKG = "Define el tamaño del envase en el producto";
const REASON_NO_SRV = "Define el tamaño de la porción en el producto";

export function getModeAvailability(product: ProductSizeFields | null | undefined): ModeAvailability {
  const hasPkg = !!(product?.package_size_value && product.package_size_value > 0);
  const hasSrv = !!(product?.serving_size_value && product.serving_size_value > 0);
  return {
    bulk: true,
    package: hasPkg,
    serving: hasSrv,
    packageReason: hasPkg ? undefined : REASON_NO_PKG,
    servingReason: hasSrv ? undefined : REASON_NO_SRV,
  };
}

/** Convert a count in the chosen mode to bulk quantity (in the product's base unit). */
export function toBulk(count: number, mode: TrackingMode, product: ProductSizeFields | null | undefined): number {
  if (!Number.isFinite(count)) return 0;
  if (mode === "bulk") return count;
  if (mode === "package") {
    const size = product?.package_size_value ?? 0;
    return count * size;
  }
  // serving
  const size = product?.serving_size_value ?? 0;
  return count * size;
}

/** Convert a bulk quantity to a count in the chosen mode. Returns null if not applicable. */
export function fromBulk(quantity: number, mode: TrackingMode, product: ProductSizeFields | null | undefined): number | null {
  if (!Number.isFinite(quantity)) return null;
  if (mode === "bulk") return quantity;
  if (mode === "package") {
    const size = product?.package_size_value ?? 0;
    if (size <= 0) return null;
    return quantity / size;
  }
  const size = product?.serving_size_value ?? 0;
  if (size <= 0) return null;
  return quantity / size;
}

/** Returns the unit string used by a given mode for a product. */
export function unitForMode(mode: TrackingMode, product: ProductSizeFields | null | undefined, fallbackUnit: string): string {
  if (mode === "package") return "envase";
  if (mode === "serving") return "porción";
  return product?.default_unit ?? fallbackUnit;
}

export function bulkUnitFor(product: ProductSizeFields | null | undefined, fallback = "g"): string {
  return product?.package_size_unit ?? product?.serving_size_unit ?? product?.default_unit ?? fallback;
}

export function formatNumber(n: number, maxFrac = 2): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 100) / 100;
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: maxFrac }).format(rounded);
}

export function pluralizeUnit(mode: TrackingMode, count: number): string {
  const abs = Math.abs(count);
  if (mode === "package") return abs === 1 ? "envase" : "envases";
  if (mode === "serving") return abs === 1 ? "porción" : "porciones";
  return "";
}
