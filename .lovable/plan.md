
El usuario quiere poder editar un `stock_item` existente (ubicación, fechas, coste, estado de apertura, modo de tracking), no el producto maestro. Hoy solo se puede borrar y recrear.

## Plan

### 1. Nueva función `updateStockItem` en `src/lib/stock.ts`
Función que recibe `id` + campos editables y hace `UPDATE` sobre `stock_items`. Campos editables:
- `location`
- `purchase_date`
- `expiration_date`
- `unit_cost`
- `open_status` (al pasar a `opened` por primera vez, setear `opened_at = now()`)
- `tracking_mode`
- `quantity` (con resync de `package_count` / `serving_count` según el producto)

Importante: NO crea movimiento de inventario. Es una rectificación de datos del propio stock, no un consumo. Si el usuario quiere ajustar cantidad como movimiento auditable, ya tiene "Ajuste" en el menú.

### 2. Nueva ruta `src/routes/_authenticated/despensa.stock.$stockItemId.editar.tsx`
Pantalla similar a `despensa.stock.nuevo.tsx` pero:
- Producto en modo solo lectura (mostrar nombre/marca, no permitir cambiarlo — para cambiar de producto, borrar y recrear)
- Carga datos actuales del `stock_item` + producto
- Formulario con todos los campos editables listados arriba, con el mismo selector de modo (`bulk` / `package` / `serving`) y previsualización de equivalencia que ya tiene `nuevo`
- Botones: Guardar / Cancelar

Reutiliza el mismo bloque de UI del selector de modo extrayendo lo mínimo necesario; si el coste es alto, se duplica de forma controlada.

### 3. Discoverabilidad — entrada en el menú de acciones
En `despensa.stock.index.tsx`, dentro del `ActionMenu`, añadir entrada **"✏️ Editar stock"** justo encima de "Editar producto", que navega a la nueva ruta `/despensa/stock/$stockItemId/editar`.

Mantener "Editar producto" como entrada separada — son dos cosas distintas y ambas son útiles.

### 4. Notas semánticas
- Cambiar `quantity` aquí NO genera movimiento. Documentado en la UI con un texto pequeño: "Para registrar consumo o merma usa el menú de acciones. Esta pantalla solo corrige errores de introducción."
- Cambiar `tracking_mode` recalcula `package_count`/`serving_count` desde `quantity` + sizes del producto.
- Si `open_status` cambia de `sealed` → `opened` y `opened_at` está vacío, lo seteamos automáticamente a `now()`.

### Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/lib/stock.ts` | Añadir `updateStockItem(id, patch)` |
| `src/routes/_authenticated/despensa.stock.$stockItemId.editar.tsx` | **Nuevo** — formulario de edición |
| `src/routes/_authenticated/despensa.stock.index.tsx` | Añadir entrada "✏️ Editar stock" en `ActionMenu` |

Sin migración de DB — todos los campos ya existen.
