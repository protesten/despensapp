

## Plan final de implementación

### 1. Migración DB
```sql
CREATE TYPE nutrition_relevance_type AS ENUM ('required','optional','ignore');
ALTER TABLE products ADD COLUMN nutrition_relevance nutrition_relevance_type;
```

### 2. `src/lib/nutrition-relevance.ts` (nuevo)
Función pura `classifyNutritionRelevance(product)` que devuelve `"required" | "optional" | "ignore"`.

Orden de resolución:
1. Override manual (`product.nutrition_relevance`) — manda si no es null.
2. Match `ignore`: categorías (`especias`, `hierbas`, `condimentos`, `sal`, `levadura`, `colorantes`) + regex nombre (`sal`, `pimienta`, `orégano`, `comino`, `curry`, `pimentón`, `canela`, `nuez moscada`, `laurel`, `tomillo`, `romero`, `albahaca`, `cilantro`, `perejil`, `cúrcuma`, `cardamomo`, `clavo`, `anís`, `azafrán`, `levadura`).
3. Match `optional` explícito para edulcorantes acalóricos: regex (`stevia`, `eritritol`, `sucralosa`, `aspartamo`, `sacarina`, `xilitol`, `monk fruit`, `edulcorante`).
4. Match `required`: categorías (`aceites`, `salsas`, `frutos secos`, `semillas`, `cremas untables`, `mantequillas`, `chocolates`) + regex azúcares calóricos (`azúcar`, `miel`, `sirope`, `melaza`, `panela`, `jarabe`, `agave`, `arce`).
5. Fallback: `optional`.

### 3. `src/lib/audit.functions.ts`
- `AuditReport` cambia:
  - `missing_nutrition_critical`: productos `required` sin macros.
  - `missing_nutrition_optional`: productos `optional` sin macros.
  - Productos `ignore` sin macros: excluidos de ambas listas.
- Nueva función `setProductRelevance(productId, value)` — update de `products.nutrition_relevance`.
- El select de `auditPantry` incluye `nutrition_relevance`.

### 4. `src/lib/export.functions.ts`
En `ConsolidatedProduct` añadir:
- `nutrition_relevance: "required" | "optional" | "ignore"` (efectivo, resuelto).
- `counts_for_macros: boolean` (= `relevance !== "ignore"`).
- `nutrition_complete`: semántica real preservada — `true` solo si kcal+protein+carbs+fat presentes, **independientemente de relevance**.

### 5. `src/lib/export-import.schemas.ts`
Actualizar `AI_PROMPT_TEMPLATE` con regla general (sin mencionar edulcorantes):

> Cada producto incluye `counts_for_macros`. Si es `false`, el producto puede usarse como ingrediente en la receta pero **NO debe sumarse al `resumen_nutricional` principal**.

### 6. `src/routes/_authenticated/despensa.auditoria.tsx`
- Stat "Sin nutrición" muestra `critical.length` grande + `+N opcionales` pequeño.
- Card "Sin nutrición" dividida en dos subsecciones: **Crítica** (destructive) y **Opcional** (muted).
- Cada item: badge con relevance + `<Select>` mini con opciones `required`/`optional`/`ignore` + default (null) que llama a `setProductRelevance` y recarga.

### 7. `src/integrations/supabase/types.ts`
Auto-regenerado tras migración.

### Archivos tocados
| Archivo | Cambio |
|---|---|
| Migración SQL | Enum + columna nullable |
| `src/lib/nutrition-relevance.ts` | Nuevo — heurística pura |
| `src/lib/audit.functions.ts` | Split lista + `setProductRelevance` |
| `src/lib/export.functions.ts` | Nuevos campos, preservar `nutrition_complete` real |
| `src/lib/export-import.schemas.ts` | Prompt con regla general |
| `src/routes/_authenticated/despensa.auditoria.tsx` | UI dividida + selector manual |

