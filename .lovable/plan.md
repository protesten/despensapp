

# Fix: Botones de navegacion no funcionan en /despensa

## Problema

`despensa.tsx` es una ruta layout (tiene rutas hijas como `productos.nuevo`), pero no incluye `<Outlet />`. Cuando haces click en "Nuevo" o "Crear primer producto", TanStack Router intenta navegar a `/despensa/productos/nuevo`, pero el componente hijo nunca se renderiza porque el layout no tiene donde mostrarlo.

## Solucion

Separar el contenido de la lista de productos en su propia ruta index, y convertir `despensa.tsx` en un layout puro.

### 1. Crear `src/routes/_authenticated/despensa.index.tsx`

Mover todo el contenido actual de `despensa.tsx` (lista de productos, busqueda, etc.) a este nuevo archivo. Este se renderiza cuando la URL es exactamente `/despensa`.

### 2. Simplificar `src/routes/_authenticated/despensa.tsx`

Convertirlo en un layout minimo que solo renderiza `<Outlet />`:

```tsx
export const Route = createFileRoute("/_authenticated/despensa")({
  component: () => <Outlet />,
});
```

### 3. Sin cambios en las demas rutas

Las rutas `despensa.productos.nuevo.tsx`, `despensa.productos.$productId.tsx` y `despensa.productos.$productId.editar.tsx` no necesitan cambios.

## Resultado

- Click en "Nuevo" o "Crear primer producto" navegara correctamente a `/despensa/productos/nuevo`
- La lista de productos seguira visible en `/despensa`
- Los botones "Volver" de las subpaginas funcionaran correctamente

