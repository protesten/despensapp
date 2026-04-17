

## Plan

### Parte A — Bug "no encuentro botón Editar"

Existe una ruta `/despensa/productos/$productId/editar` totalmente funcional, pero el botón Editar solo aparece dentro del detalle del producto, no es descubrible.

**Cambios:**

1. **Lista productos (`despensa.index.tsx`)**: añadir botón ✏️ Editar al lado del ✕ en cada Card.
2. **Detalle producto (`despensa.productos.$productId.tsx`)**: ya tiene el botón — verificar que sigue visible (sí lo está).
3. **Lista stock (`despensa.stock.index.tsx`)**: en el `ActionMenu` de cada item añadir entrada "✏️ Editar producto" que navega a `/despensa/productos/$productId/editar` con el `product_id` del stock.

### Parte B — Stock por envases / porciones

**Modelo de datos (migración)**: añadir a `stock_items` tres columnas para soportar modo dual:
- `tracking_mode` enum (`bulk` | `package` | `serving`) — cómo prefiere el usuario contar este stock.
- `package_count` numeric nullable — número de envases actuales (cuando aplica).
- `serving_count` numeric nullable — número de porciones actuales (cuando aplica).

`quantity` + `unit` siguen siendo la fuente de verdad canónica (en g/ml/unit). Los campos `package_count`/`serving_count` se derivan/sincronizan automáticamente desde `quantity` usando `package_size_value` y `serving_size_value` del producto.

**Lógica de conversión (nuevo `src/lib/stock-conversion.ts`)**:
- `toBulk(count, mode, product)` → cantidad en unidad base (12 envases × 1000ml = 12000ml).
- `fromBulk(quantity, mode, product)` → cuenta de envases o porciones.
- Validaciones: solo permitir modo `package` si el producto tiene `package_size_value` y unidad compatible; igual para `serving`.

**UI añadir stock (`despensa.stock.nuevo.tsx`)**:

Cuando el producto seleccionado tiene `package_size_value` y/o `serving_size_value`, mostrar un selector de modo:

```text
¿Cómo cuentas este stock?
( ) 12 envases (1000 ml c/u) → 12 000 ml
( ) 400 porciones (30 g c/u) → 12 000 g
( ) Cantidad bruta en ml/g
```

Input principal cambia su label dinámicamente ("Envases", "Porciones", "Cantidad"). Debajo, texto pequeño con la equivalencia calculada en tiempo real. Internamente siempre se guarda `quantity` en bruto + el modo elegido.

**UI consumir/movimiento (`MovementDialog.tsx`)**:

Si `tracking_mode` del stock es `package` o `serving`, mostrar el input en esa unidad ("consumir 1 envase", "consumir 2 porciones") con equivalencia visible ("= 1000 ml"). Internamente se convierte a bulk antes de llamar a `createMovement`.

**Visualización (lista stock)**:

Mostrar la cantidad principal en el modo elegido más la equivalencia entre paréntesis:
- `12 envases (12 000 ml)` 
- `8 porciones (240 g)`
- `500 g` (modo bulk)

### Archivos tocados

| Archivo | Cambio |
|---|---|
| Migración SQL | Enum `tracking_mode_type` + columnas en `stock_items` |
| `src/lib/stock-conversion.ts` | **Nuevo** — funciones puras de conversión |
| `src/lib/stock.ts` | `StockFormData` + `MovementFormData` con `tracking_mode`, `createStockItem` y `createMovement` aceptan modo |
| `src/routes/_authenticated/despensa.index.tsx` | Botón ✏️ Editar en cada card |
| `src/routes/_authenticated/despensa.stock.nuevo.tsx` | Selector de modo + equivalencias en vivo |
| `src/routes/_authenticated/despensa.stock.index.tsx` | Mostrar cantidad en modo + equivalencia + entrada "Editar producto" en menú |
| `src/components/stock/MovementDialog.tsx` | Input en unidad del modo + equivalencia |

### Notas

- Stock existente queda automáticamente como `tracking_mode = 'bulk'` (default en migración) — comportamiento actual preservado.
- Si el producto no define `package_size_value`/`serving_size_value`, los modos correspondientes quedan deshabilitados con tooltip "Define el tamaño del envase en el producto".
- Edición posterior del producto que cambie `package_size_value` no recalcula stocks históricos (se respeta `quantity` original).

