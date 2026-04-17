
El usuario quiere también poder descargar en CSV/Excel el **consolidado** (una fila por producto, ya agrupado, con totales y nutrición) — lo que hoy solo existe como JSON via `exportConsolidated()`.

## Plan

### 1. Añadir funciones tabulares en `src/lib/export-tabular.ts`

Reutilizar `exportConsolidated()` (ya devuelve `ConsolidatedProduct[]` con todo lo necesario) y aplanar a filas planas para hoja de cálculo.

Columnas del consolidado:
- `producto`, `marca`, `categoría`
- `cantidad_total`, `unidad` (canónica)
- `cantidad_g`, `cantidad_ml`, `cantidad_unidades` (desglose desde `quantity_by_unit`)
- `ubicaciones` (join con `, `)
- `envases_abiertos`, `envases_cerrados`, `total_items`
- `caducidad_proxima`, `todo_caducado` (Sí/No)
- `base_nutricional` (100g/100ml), `kcal_por_100`, `proteinas_por_100`, `carbohidratos_por_100`, `grasas_por_100`
- `nutricion_completa` (Sí/No), `relevancia_nutricional`, `cuenta_para_macros` (Sí/No)
- `fuente`, `fuente_coherente` (Sí/No)

Nuevas funciones:
- `exportConsolidatedToCSV(): Promise<number>`
- `exportConsolidatedToXLSX(): Promise<number>`

Reutilizar helpers existentes (`downloadBlob`, `todayStamp`, BOM UTF-8, auto-fit columnas). Nombre fichero: `despensapp-consolidado-{fecha}.{ext}`.

### 2. UI en `despensa.exportar.tsx` (pestaña "📊 Tabla")

Añadir una segunda sección dentro de la pestaña Tabla con dos botones más:
- **Descargar consolidado (Excel)**
- **Descargar consolidado (CSV)**

Mantener la sección actual (stock detallado) y separar visualmente con un subtítulo o card aparte. Toasts de éxito/error y estados de carga independientes por botón.

### Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/lib/export-tabular.ts` | Añadir `buildConsolidatedRows`, `exportConsolidatedToCSV`, `exportConsolidatedToXLSX` |
| `src/routes/_authenticated/despensa.exportar.tsx` | Añadir bloque + 2 botones en pestaña Tabla |

Sin cambios en DB ni en `export.functions.ts` (`exportConsolidated` ya devuelve todo lo necesario).
