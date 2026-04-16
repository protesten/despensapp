

# DespensApp — Fase 1: Base de Datos y Auth

## Resumen

Crear toda la infraestructura de base de datos (6 tablas, enums, RLS, trigger) y autenticación básica con email/password. Sin UI avanzada — solo una página de login/registro funcional y una página principal protegida.

## Lo que se construirá

### 1. Migración SQL completa

**Enums:**
- `unit_type`: g, ml, unit, kg, l
- `location_type`: pantry, fridge, freezer, other
- `stock_status`: available, low, expired, consumed
- `movement_type`: purchase, consumption, adjustment, waste, expiry
- `open_status_type`: sealed, opened
- `nutrition_source_type`: label, openfoodfacts, food_database, manual, ai_estimate
- `import_status`: pending, previewed, applied, rejected

**Tablas (en orden de dependencia):**
1. `profiles` — FK a `auth.users(id)` con `ON DELETE CASCADE`
2. `products` — catálogo maestro con UNIQUE(user_id, name, brand) y UNIQUE parcial en barcode
3. `product_nutrition` — 1:1 con products, PK = product_id
4. `stock_items` — FK a products y auth.users
5. `inventory_movements` — FK a stock_items, products; campo `quantity_delta`
6. `import_logs` — auditoría de importaciones IA

**RLS en todas las tablas:**
- Políticas SELECT, INSERT, UPDATE, DELETE donde `user_id = auth.uid()`
- `profiles` usa `id = auth.uid()` (ya que id = user id)

**Trigger:**
- Función `handle_new_user()` que crea perfil automáticamente al signup
- Trigger `on_auth_user_created` en `auth.users` AFTER INSERT

### 2. Auth básica

- Habilitar Supabase Auth con email/password
- Instalar `@supabase/supabase-js`
- Crear cliente Supabase (`src/lib/supabase.ts`)
- Crear página de login/registro (`src/routes/auth.tsx`)
- Crear layout protegido con verificación de sesión
- Página principal simple post-login (placeholder para fases futuras)
- Actualizar `__root.tsx` con metadata de DespensApp

### 3. Archivos nuevos

- `src/lib/supabase.ts` — cliente Supabase
- `src/routes/auth.tsx` — login/registro
- `src/routes/_authenticated.tsx` — layout protegido con Outlet
- `src/routes/_authenticated/index.tsx` — página principal (despensa placeholder)
- Actualizar `src/routes/index.tsx` — redirigir a auth o despensa
- Actualizar `src/routes/__root.tsx` — metadata DespensApp

### Lo que NO se implementa
- Open Food Facts, Google Drive, OCR, export/import IA
- UI avanzada de productos, stock o movimientos
- Búsqueda/autocompletado de productos

