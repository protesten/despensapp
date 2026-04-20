
## Objetivo

Arreglar la vista móvil de la sección Dieta para que no se corten frases, productos ni controles en pantallas estrechas como la del screenshot.

## Cambios propuestos

### 1. Ajustar el contenedor principal de Dieta para móvil

En `src/routes/_authenticated/dieta.tsx`:

- Reducir padding horizontal en móvil (`px-3 sm:px-4`) para ganar ancho útil.
- Asegurar que el contenido no fuerce overflow horizontal.
- Mantener la navegación superior consistente y desplazable horizontalmente.

### 2. Corregir las tarjetas de días y comidas

En `DayPlan`:

- Reducir el padding de `CardHeader` y `CardContent` en móvil.
- Cambiar los encabezados de día/comida para que puedan partirse en varias líneas sin cortar texto.
- Hacer que los totales de intercambios bajen a una segunda línea cuando no quepan.
- Evitar que nombres largos como `Post-entreno/Merienda` empujen los iconos o se corten de forma fea.

### 3. Rediseñar las filas de alimentos generados en móvil

Actualmente una fila intenta meter en una sola línea:

```text
checkbox + nombre largo + gramos + badge HC/P/G + botón borrar
```

Eso provoca cortes. Lo cambiaré a una estructura responsive:

```text
[ ] Nombre del alimento largo
    200g · 0.3 HC · 0.9 P · 0.1 G          [x]
```

Concretamente:

- Permitir que el nombre del alimento haga wrap (`break-words`) en lugar de `truncate`.
- Separar nombre, gramos e intercambios en líneas compactas.
- Mantener el checkbox y el botón eliminar siempre visibles.
- En escritorio, conservar una fila más compacta si hay espacio.

### 4. Arreglar el selector de productos del stock

El desplegable muestra nombres muy largos y actualmente se salen/cortan. Haré estos cambios:

- En el formulario de añadir alimento (`AddEntryForm`), pasar de una fila rígida a una disposición responsive:
  - Móvil: selector en ancho completo, gramos y botón `+` debajo.
  - Escritorio: selector + gramos + botón en una sola línea.
- En `SelectContent`, limitar el ancho al viewport móvil (`max-w-[calc(100vw-2rem)]`).
- En cada `SelectItem`, permitir texto multilínea y corte de palabras largas.
- Mostrar cada opción como:
  ```text
  Nombre del producto
  Marca · 450g disp.
  ```
  en lugar de una frase larga de una sola línea.

### 5. Mejorar pequeños textos que se cortan

- Cambiar textos demasiado largos en botones móviles si hace falta:
  - `Generar semana con IA` puede mantenerse, pero con icono y texto centrado flexible.
  - `Semana anterior` / `Semana siguiente` se mantendrán, pero con layout que no obligue a cortar el rango de fechas.
- Revisar la pestaña de objetivos para que los labels y campos mantengan buen ancho en móvil.

## Archivos a modificar

- `src/routes/_authenticated/dieta.tsx`
  - Layout principal de Dieta
  - `PlannerTab`
  - `DayPlan`
  - `AddEntryForm`
  - Filas de alimentos generados
  - Select items del stock

No hace falta tocar base de datos ni lógica de IA para este ajuste; es un cambio de presentación responsive.

## Criterios de validación

Después de implementar:

- En móvil de 375px:
  - Los nombres largos de productos del desplegable no se salen de pantalla.
  - Las filas de alimentos generados no cortan el nombre ni ocultan el botón borrar.
  - El selector de producto, input de gramos y botón `+` caben correctamente.
  - Los encabezados de comidas y totales no se pisan.
  - No aparece scroll horizontal accidental.
- En escritorio:
  - La vista sigue siendo compacta y usable.
