

## Problem

The stock page shows "Sin datos nutricionales" even though the products have nutrition data. The issue is in how `product_nutrition` is extracted from the nested Supabase query response.

### Root cause

In `despensa.stock.index.tsx` (line 202-204), the code assumes `product_nutrition` is always an array:

```typescript
const nutrition = Array.isArray(item.products.product_nutrition)
  ? item.products.product_nutrition[0] ?? null
  : null;
```

When Supabase returns `product_nutrition` through a double-nested embed (`stock_items → products → product_nutrition`), it may return a single object instead of an array (depending on PostgREST's relationship detection). If it's an object, `Array.isArray` is `false` and the code falls through to `null`.

### Fix

**1. Update `StockItemWithProduct` type** in `src/lib/stock.ts` to accept both formats:

```typescript
product_nutrition: ProductNutrition[] | ProductNutrition | null;
```

**2. Update the nutrition extraction** in `src/routes/_authenticated/despensa.stock.index.tsx` to handle all shapes:

```typescript
const raw = item.products.product_nutrition;
const nutrition = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
```

This two-line change ensures nutrition displays correctly regardless of whether Supabase returns an array, object, or null.

