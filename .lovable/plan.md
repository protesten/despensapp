

## Diagnóstico

El usuario está en `/despensa/productos/{id}/editar` y pulsa el botón **"← Volver"** del header repetidamente sin que pase nada (visible en el session replay: 10+ clicks en x=1578, y=31, solo cambia el atributo `data-transitioning` pero la URL no cambia).

**Causa raíz**: en `despensa.productos.$productId.editar.tsx`:

```tsx
<AppHeader backTo={`/despensa/productos/${productId}`} ... />
```

`AppHeader` internamente hace `<Link to={backTo as any}>`. TanStack Router NO acepta una URL con el `$productId` ya interpolado para rutas dinámicas — exige el patrón literal `/despensa/productos/$productId` + `params={{ productId }}` por separado. Resultado: el Link parece funcional (hover, focus, transición) pero **nunca navega**.

Por eso el usuario percibe "no se puede editar": entra a la pantalla de editar, no puede salir, e interpreta que la edición está rota. El botón "Guardar cambios" ni siquiera se ha llegado a probar (no hay PATCH en network logs).

Lo mismo le pasaría al botón "Cancelar" del formulario: ese sí funciona porque usa `navigate({ to: "/despensa/productos/$productId", params: { productId } })`. Es solo el header el que está roto.

## Plan

### Cambio único: arreglar `AppHeader` para soportar params

Modificar `src/components/layout/AppHeader.tsx` para aceptar `backParams` opcional y pasarlo al `<Link>`:

```tsx
interface AppHeaderProps {
  title?: string;
  backTo?: string;
  backParams?: Record<string, string>;  // nuevo
  backLabel?: string;
  showUser?: boolean;
}
// ...
<Link to={backTo as any} params={backParams as any}>{backLabel}</Link>
```

### Aplicarlo en la página de editar producto

En `src/routes/_authenticated/despensa.productos.$productId.editar.tsx`:

```tsx
<AppHeader
  title="Editar producto"
  backTo="/despensa/productos/$productId"
  backParams={{ productId }}
  backLabel="← Volver"
/>
```

### Archivos tocados

| Archivo | Cambio |
|---|---|
| `src/components/layout/AppHeader.tsx` | Añadir prop `backParams` y pasarlo al `Link` |
| `src/routes/_authenticated/despensa.productos.$productId.editar.tsx` | Usar `backTo` con patrón `$productId` + `backParams` |

Sin migración de DB. Sin cambios en lógica de guardado (que ya funciona, solo no se había llegado a probar porque el usuario quedaba atrapado en la pantalla).

