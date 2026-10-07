# Productos con IdProducto y costo unitario base — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recrear `Productos` con clave `"IdProducto"`, código opcional, `"PrecioCompra"` y costo unitario por unidad base calculado, y migrar tablas hijas, RPC y app a `IdProducto`.

**Architecture:** Una migración `0013` vacía los datos de prueba, agrega `UnidadBase`/`Factor` a `UnidadesMedida`, recrea `Productos` (con trigger que calcula unidad y costo base), cambia las 5 tablas hijas a `"IdProducto"` y reescribe los RPC (payload `producto` = id). La app se adapta por capas: validación y librerías puras → mantenedor de unidades → Productos → Compras/Solicitudes/Bodegas/Movimientos/Inicio.

**Tech Stack:** Next.js (App Router, TS), Supabase/Postgres, PGlite + Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-10-06-productos-id-costo-base-design.md`

## Global Constraints

- Columnas en PascalCase entre comillas (convención del proyecto). Columna del nombre: `"Nombre"` (antes `"NombreProducto"`); código: `"Codigo"` (antes `"CodigoProducto"`); clave: `"IdProducto"` bigint identity.
- `UnidadMedida`, `UnidadBase` y `Formato` son FK por **código** (`"Codigo"`), nunca Id numérico.
- `UnidadBase`/`CostoUnitarioBase` NO son editables: las calcula el trigger; `CostoUnitarioBase = round("PrecioCompra" / "Factor", 6)`; `PrecioCompra numeric(12,2) >= 0`; `CostoUnitarioBase numeric(14,6)`.
- Stock mínimo/crítico `numeric(14,3)`, `StockCritico <= StockMinimo`. `Codigo` único y opcional; `Nombre` obligatorio y único.
- Factores iniciales: KG→G ×1000, G→G ×1, L→ML ×1000, ML→ML ×1, UN→UN ×1.
- Mensajes de negocio con `P0001`; nunca errores crudos de la BD al usuario. Instalar dependencias con `--legacy-peer-deps`. Commits con `git add` de rutas explícitas y terminados en `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Trabajo en la rama `feat/productos-id-costo-base`; integración a `main` solo por merge `--no-ff`.
- Tras la Tarea 1 el código de la app deja de compilar hasta terminar la Tarea 5: `npx tsc --noEmit` solo se exige al final de la Tarea 5; antes se corre solo el Vitest indicado.

## Review Focus

1. Dos productos sin código (campo vacío) deben poder coexistir: el formulario envía `null`, nunca `""` (que chocaría con el único).
2. Cambiar `Factor`/`UnidadBase` de una unidad que ya usan productos debe rechazarse con mensaje de negocio (no dejar costos viejos inconsistentes).
3. `?ver=abc`, `?ver=999999` o `?editar=0` en `/productos` deben mostrar el listado sin error 500.
4. Borrador de factura guardado en `sessionStorage` con el formato viejo (`codigo`) debe ignorarse sin romper la pantalla.
5. Detalle de factura/solicitud con `producto` inexistente, no vigente o no numérico debe dar mensaje de negocio y no dejar datos a medias.

---

### Task 1: Migración 0013 y pruebas SQL

**Files:**
- Create: `supabase/migrations/0013_productos_id_costo_base.sql`
- Modify: `supabase/tests/db.test.ts` (seed de `beforeAll`, todos los `"CodigoProducto"`/`"codigo"` de los tests, nuevo `describe("productos: costo base")`)
- Modify: `supabase/tests/conversion.test.ts` (solo si referencia productos)
- Modify: `supabase/seed.sql` (solo si inserta productos)

**Interfaces:**
- Produces (SQL): `"Productos"("IdProducto","Codigo","Nombre","UnidadMedida","Formato","PrecioCompra","UnidadBase","CostoUnitarioBase","StockMinimo","StockCritico","IdEstado", auditoría)`; `"UnidadesMedida"."UnidadBase" text not null` y `"Factor" numeric(14,6) not null`; hijas con `"IdProducto" bigint not null references "Productos"("IdProducto")` en `ComprasDetalle`, `BodegaCentral`, `StockBodega` (PK `("IdBodega","IdProducto")`), `SolicitudesDetalle` (PK `("IdSolicitud","IdProducto")`), `MovimientosBodega`. RPC con las mismas firmas de hoy pero ítems `{"producto":<id>,"cantidad":n}` / `{"producto":<id>,"precio":n,"cantidad":n}`.

- [ ] **Step 1: Actualizar `db.test.ts` al nuevo modelo (fallan hasta tener la migración).** En `beforeAll` insertar `"Productos"("Codigo","Nombre","UnidadMedida","Formato","PrecioCompra","StockMinimo","StockCritico")` con Harina (`'HAR','KG','BOLSA',2000,10,5`) y Aceite (`'ACE','L','BOTELLA',1500,4,2`) → ids 1 y 2; reemplazar en todos los tests `"codigo":"HAR"` por `"producto":1`, `"codigo":"ACE"` por `"producto":2`, `"CodigoProducto"='HAR'` por `"IdProducto"=1`, etc. Mensajes esperados: `/Producto/` se mantiene.
- [ ] **Step 2: Agregar `describe("productos: costo base")` con estos tests** (todos contra el nuevo esquema):
  - `calcula UnidadBase y CostoUnitarioBase`: Harina (KG, 2000) → `UnidadBase='G'`, `CostoUnitarioBase = 2.000000`; Aceite (L, 1500) → `'ML'`, `1.500000`; un producto `UN` de 350 → `'UN'`, `350`.
  - `recalcula al cambiar precio o unidad`: `update "Productos" set "PrecioCompra"=3000 where "IdProducto"=1` → costo `3.000000`; cambiar `UnidadMedida` a `'UN'` → base `'UN'`, costo `3000`.
  - `sobrescribe valores calculados enviados a mano`: insert con `"UnidadBase"='KG'` y `"CostoUnitarioBase"=999` queda con los calculados.
  - `Codigo opcional pero único`: dos productos con `"Codigo"` null conviven; repetir un código con valor falla `/Productos_Codigo_key/`; `Nombre` repetido falla `/Productos_Nombre_key/`.
  - `PrecioCompra negativo falla`; `StockCritico > StockMinimo falla`.
  - `rechaza cambiar Factor/UnidadBase de una unidad en uso`: `update "UnidadesMedida" set "Factor"=500 where "Codigo"='KG'` falla `/hay productos que usan esta unidad/`; en una unidad sin productos (insertar `'CAJ2'`→base `'UN'`, factor 12) sí se puede cambiar.
  - `la unidad base debe ser base`: insertar unidad con `"UnidadBase"='KG'` (que no es base) falla `/unidad base/i`; `"UnidadBase"="Codigo"` con `"Factor"<>1` falla por check.
  - `producto inexistente, no vigente o sin id válido en RPC`: factura/solicitud con `{"producto":999}` y con un producto `IdEstado=0` fallan `/Producto/` sin dejar cabecera.
- [ ] **Step 3: Ejecutar** `npx vitest run supabase/tests/db.test.ts` → FAIL (columnas inexistentes).
- [ ] **Step 4: Escribir `0013_productos_id_costo_base.sql`** en este orden: (a) `truncate "Compras","Productos","Solicitudes" restart identity cascade; alter sequence seq_numero_solicitud restart;` (misma práctica de `0006`); (b) `UnidadesMedida`: agregar `"UnidadBase"` (nullable → poblar con los valores del Global Constraints y `= "Codigo"`/factor 1 para cualquier otra → `not null`), `"Factor"` con `check ("Factor" > 0)`, FK `"UnidadBase"` → `"UnidadesMedida"("Codigo")`, `check ("UnidadBase" <> "Codigo" or "Factor" = 1)`; (c) trigger `validar_unidad_medida()` (BEFORE INSERT OR UPDATE en `UnidadesMedida`): si `UnidadBase <> Codigo`, exige que la fila base exista con `UnidadBase = Codigo` y `Factor = 1` (si no: `raise exception 'La unidad base debe ser una unidad base (factor 1)'`); en UPDATE, si cambian `UnidadBase` o `Factor` y existen `Productos` con esa `UnidadMedida`, `raise exception 'No se puede cambiar la unidad base ni el factor: hay productos que usan esta unidad'`; (d) `drop table "Productos" cascade` y recrearla con la tabla del spec (constraints por defecto: `Productos_Codigo_key`, `Productos_Nombre_key`), RLS activo, `revoke all ... from anon, authenticated` y el trigger `trg_mod` de modificación como en las demás tablas; (e) función `fijar_costo_base()` + trigger `trg_costo_base` BEFORE INSERT OR UPDATE en `Productos` (lee `UnidadBase`,`Factor` de `UnidadesMedida` por `"UnidadMedida"` y fija `UnidadBase` y `CostoUnitarioBase = round("PrecioCompra"/"Factor", 6)`), con `set search_path = public`; (f) en las 5 hijas: `drop column "CodigoProducto"` y `add column "IdProducto" bigint not null references "Productos"("IdProducto")`, rehaciendo las PK de `StockBodega` y `SolicitudesDetalle`; (g) `create or replace` de `registrar_factura`, `crear_solicitud`, `actualizar_solicitud`, `aprobar_solicitud`, `recepcionar_solicitud` y `anular_factura` con el cuerpo vigente (`0006`, `0003`, `0002`, `0004`) cambiando `d->>'codigo'` por `(d->>'producto')::bigint` y `"CodigoProducto"` por `"IdProducto"`; el mensaje de producto inválido pasa a `'Producto % no existe o no vigente'` con el id y el de `anular_factura` nombra el producto por `"Nombre"`; repetir los `revoke all on function ... from public, anon, authenticated`.
- [ ] **Step 5: Ejecutar** `npx vitest run supabase/tests/db.test.ts supabase/tests/conversion.test.ts` → PASS (los de cleanup se arreglan en la Tarea 2).
- [ ] **Step 6: Commit**
```bash
git add supabase/migrations/0013_productos_id_costo_base.sql supabase/tests/db.test.ts supabase/tests/conversion.test.ts supabase/seed.sql
git commit -m "feat: migración 0013, Productos con IdProducto y costo unitario base"
```

---

### Task 2: Script de limpieza E2E y su prueba

**Files:**
- Modify: `supabase/scripts/e2e-cleanup.sql` (líneas con `"CodigoProducto"`)
- Modify: `supabase/tests/cleanup.test.ts`

**Interfaces:**
- Consumes: esquema y RPC de la Tarea 1.
- Produces: el script identifica productos E2E por `"Codigo" like 'E2E-%'` (equivalente: `"IdProducto" in (select "IdProducto" from "Productos" where "Codigo" like 'E2E-%')`, guardado en un arreglo `prod_ids`) y borra por `"IdProducto"`.

- [ ] **Step 1:** Adaptar `cleanup.test.ts`: insertar productos con las columnas nuevas (`REAL-1`, `E2E-HAR`, `PrecioCompra` 100), usar `"producto":<id>` en los JSON, y las verificaciones por `"Codigo"`. Mantener los casos de aborto por datos reales mezclados.
- [ ] **Step 2:** `npx vitest run supabase/tests/cleanup.test.ts` → FAIL.
- [ ] **Step 3:** Reescribir en `e2e-cleanup.sql` todos los filtros `"CodigoProducto" like 'E2E-%'` / `not like` usando `prod_ids` por `"IdProducto"`, sin cambiar los mensajes de aborto ni el orden de borrado.
- [ ] **Step 4:** `npx vitest run supabase/tests` → PASS.
- [ ] **Step 5: Commit**
```bash
git add supabase/scripts/e2e-cleanup.sql supabase/tests/cleanup.test.ts
git commit -m "fix: script de limpieza E2E con IdProducto"
```

---

### Task 3: Validación y librerías puras

**Files:**
- Modify: `lib/validation/schemas.ts` (`productoSchema`, `facturaSchema`), `lib/validation/schemas.test.ts`
- Modify: `lib/productos-filtro.ts`, `lib/productos-filtro.test.ts`
- Modify: `lib/borrador-factura.ts`, `lib/borrador-factura.test.ts`
- Modify: `app/(app)/solicitudes/actions.ts` (solo el esquema `items`)

**Interfaces:**
- Produces:
  - `productoSchema` → `{ id?: number; codigo?: string; nombre: string; unidad: string; formato: string; precioCompra: number; stockMinimo: number; stockCritico: number; estado: 0|1 }`; `codigo` vacío/espacios → `undefined`; si viene, mismo patrón actual (`/^[A-Za-z0-9._-]+$/`, máx. 40); `precioCompra` usa el transform `precio` existente (máx. 2 decimales, mensaje `MSG_PRECIO`) y además ≤ 9_999_999_999.99.
  - `facturaSchema.detalle[]` → `{ producto: number (entero > 0); precio: number; cantidad: number }`.
  - `ProductoFila = { IdProducto: number; Codigo: string | null; Nombre: string; UnidadMedida: string; Formato: string; PrecioCompra: number; UnidadBase: string; CostoUnitarioBase: number; StockMinimo: number; StockCritico: number; IdEstado: number }`; `filtrarProductos` igual firma, busca por `Codigo` (si existe) o `Nombre`.
  - `Borrador.lineas: { producto: string; precio: string; cantidad: string }[]`; `aplicarPreProducto(lineas, producto: string)` (vacío = `producto === ""`).
  - `items` de solicitudes: `{ producto: z.coerce.number().int().positive(), cantidad }`.

- [ ] **Step 1: Escribir tests** que fallen: `productoSchema` acepta `codigo: ""` → `codigo === undefined`, rechaza `precioCompra: "10,555"` con el mensaje de 2 decimales y acepta `"1500"`; `facturaSchema` acepta `producto: 3` y rechaza `producto: 0`/`"abc"`; `filtrarProductos` encuentra por nombre sin tildes y por código, y no falla con `Codigo: null`; `leerBorrador` devuelve `null` para un borrador con líneas `{codigo,...}` (formato viejo) y lo restaura con `{producto,...}`; `aplicarPreProducto` rellena la primera línea con `producto === ""`.
- [ ] **Step 2:** `npx vitest run lib` → FAIL.
- [ ] **Step 3:** Implementar los cambios de las firmas anteriores en cada archivo.
- [ ] **Step 4:** `npx vitest run lib` → PASS.
- [ ] **Step 5: Commit**
```bash
git add lib/validation/schemas.ts lib/validation/schemas.test.ts lib/productos-filtro.ts lib/productos-filtro.test.ts lib/borrador-factura.ts lib/borrador-factura.test.ts "app/(app)/solicitudes/actions.ts"
git commit -m "refactor: validación y librerías de productos por IdProducto"
```

---

### Task 4: Mantenedor de unidades de medida (unidad base y factor)

**Files:**
- Modify: `lib/validation/catalogo.ts`, `lib/services/catalogo.ts`, `lib/services/catalogo.test.ts`
- Modify: `components/app/catalogo-form.tsx`, `components/app/catalogo-admin.tsx`
- Modify: `app/(app)/mantenedores/unidades-medida/page.tsx` (si hace falta pasar opciones)

**Interfaces:**
- Produces:
  - `CatalogoCfg.base?: true` (solo `unidades`); `PropsFormCatalogo.base?: boolean` (serializable).
  - `catalogoUnidadSchema = catalogoSchema.extend({ unidadBase: codigoCatalogo, factor: number > 0, máx. 6 decimales })`.
  - `ItemCatalogo` del form admite `UnidadBase?: string; Factor?: number`; `FormCatalogo` muestra, solo si `cfg.base`, los campos «Unidad base» (select de unidades vigentes que sean base, más «Esta misma unidad» al crear una base) y «Factor» (`input` decimal); ambos de solo lectura al editar una unidad con productos (el servidor igual rechaza).
  - `prepararFila` incluye `UnidadBase` y `Factor` al crear y al editar cuando `cfg.base`.
  - «Ver» muestra «Unidad base» y «Factor»; `cfg.uso` de `unidades` suma `{ etiqueta: "Unidades que la usan como base", tabla: "UnidadesMedida", columna: "UnidadBase", singular: "unidad", plural: "unidades" }`.
  - Errores del trigger (`P0001`) se muestran tal cual (ya lo hace `guardarCatalogo`).

- [ ] **Step 1: Tests** en `catalogo.test.ts`: `validarEntradaCatalogo(CATALOGOS.unidades, fd)` exige `unidadBase` y `factor` > 0; rechaza `factor` `"0"`, `""` y `"1,5"`; `prepararFila(CATALOGOS.unidades, {..., unidadBase:"G", factor:1000}, 1, false)` contiene `UnidadBase:"G"` y `Factor:1000`; `propsFormCatalogo(CATALOGOS.unidades).base === true` y `propsFormCatalogo(CATALOGOS.formatos).base` es `undefined`.
- [ ] **Step 2:** `npx vitest run lib/services/catalogo.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `validarEntradaCatalogo`/`prepararFila`/`propsFormCatalogo` y los cambios de `catalogo-form.tsx`/`catalogo-admin.tsx` (leer `UnidadBase,Factor` en el `select` solo si `cfg.base`).
- [ ] **Step 4:** `npx vitest run lib/services/catalogo.test.ts` → PASS.
- [ ] **Step 5: Commit**
```bash
git add lib/validation/catalogo.ts lib/services/catalogo.ts lib/services/catalogo.test.ts components/app/catalogo-form.tsx components/app/catalogo-admin.tsx "app/(app)/mantenedores/unidades-medida/page.tsx"
git commit -m "feat: unidad base y factor en el mantenedor de unidades de medida"
```

---

### Task 5: Pantallas de Productos y flujos que usan productos

**Files:**
- Modify: `app/(app)/productos/actions.ts`, `form.tsx`, `page.tsx`
- Modify: `app/(app)/compras/nueva/page.tsx`, `form-factura.tsx`, `app/(app)/compras/[id]/page.tsx`
- Modify: `app/(app)/solicitudes/form-solicitud.tsx`, `paneles.tsx`, `nueva/page.tsx`, `[id]/page.tsx`
- Modify: `app/(app)/bodegas/page.tsx`, `app/(app)/movimientos/page.tsx`, `app/(app)/page.tsx`

**Interfaces:**
- Consumes: Tarea 3 (`productoSchema`, `ProductoFila`, `Borrador`, `aplicarPreProducto`, items con `producto`).
- Produces:
  - `guardarProducto(prev, fd): Promise<{ error?: string; ok?: boolean; id?: number }>`; con `modo=editar` usa `id` oculto; `codigo` vacío se guarda como `null`; no envía `UnidadBase`/`CostoUnitarioBase`. `23505` → «El código ya existe» o «El nombre ya existe» según el nombre de la restricción en `error.message`/`details` (`Productos_Codigo_key`/`Productos_Nombre_key`).
  - `FormProducto`: campo «Precio de compra» (`precioCompra`, `inputMode="decimal"`, usa `filtrarDecimal` de `lib/numeros.ts`), «Código» opcional y editable; `?producto=<id>` al volver a la factura.
  - `/productos`: `?ver=ID`, `?editar=ID` con `ID` entero > 0 (cualquier otro valor se ignora y se muestra el listado); Ver muestra «Precio de compra», «Unidad base» y «Costo unitario base» (formateo con la unidad base); listado muestra Código (o «—») y Nombre.
  - Selectores de factura y solicitudes envían `producto` (id) y rotulan `Codigo — Nombre` o solo `Nombre` si no hay código; `StockBodega`/`SolicitudesDetalle`/`ComprasDetalle`/`MovimientosBodega` se consultan por `IdProducto` y `Productos!inner(Nombre,Codigo,...)`.

- [ ] **Step 1:** Adaptar `actions.ts`, `form.tsx` y `page.tsx` de Productos según las interfaces (ids numéricos, `COLS` nuevo, `Dato` de precio/unidad base/costo).
- [ ] **Step 2:** Adaptar factura (`page.tsx` pasa `{ id, codigo, nombre }`; `form-factura.tsx` valor del combobox = id como texto; `detalle` envía `producto`; `?producto=` preselecciona) y `compras/[id]`.
- [ ] **Step 3:** Adaptar solicitudes (`form-solicitud.tsx`, `paneles.tsx`, `nueva`, `[id]`), `bodegas`, `movimientos` e inicio (`page.tsx`: agrupar stock por `IdProducto`).
- [ ] **Step 4:** Verificar: `npx tsc --noEmit` sin errores y `npm test` → todo PASS.
- [ ] **Step 5: Commit**
```bash
git add "app/(app)/productos" "app/(app)/compras" "app/(app)/solicitudes" "app/(app)/bodegas/page.tsx" "app/(app)/movimientos/page.tsx" "app/(app)/page.tsx"
git commit -m "feat: pantallas de Productos y flujos con IdProducto, precio de compra y costo base"
```

---

### Task 6: Aplicar migración, documentación y recorrido en navegador

**Files:**
- Modify: `CLAUDE.md` (migraciones `0001…0013`, descripción de `0013`, sección Productos, Unidades de medida con base/factor, `Estado de las pruebas`), `README.md` si menciona `CodigoProducto`
- Create (scratchpad, no versionado): guion Playwright `productos-id.mjs`

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1:** Antes de aplicar, consultar en Supabase (`execute_sql`) las filas de `Productos`, `Compras` y `Solicitudes` y mostrarlas al usuario; solo si son de prueba (confirmado en el spec) aplicar `0013` con `apply_migration`. Si hay datos que no parecen de prueba, detenerse y preguntar.
- [ ] **Step 2:** Verificar en Supabase con `execute_sql`: columnas de `Productos`, factores de `UnidadesMedida`, y que `get_advisors` (seguridad) no reporte tablas sin RLS.
- [ ] **Step 3:** Con `npm run dev` y el guion Playwright (`scripts/e2e-setup.ts` para el usuario admin): mantenedor de unidades (crear unidad con base/factor; editar la de un producto en uso → error) → crear producto sin código y con precio → ver costo base → factura con ese producto → solicitud → aprobar → recepcionar → stock en la bodega; revisar consola sin errores, 375 px y `?ver=abc`. Cada comprobación imprime PASS/FAIL; todo debe ser PASS.
- [ ] **Step 4:** Limpiar datos de prueba (usuarios E2E, productos/unidades/bodegas creados) con `supabase/scripts/e2e-cleanup.sql` o `delete` acotado y borrar `.env.e2e`.
- [ ] **Step 5:** Actualizar `CLAUDE.md`/`README.md`. Ejecutar `npx tsc --noEmit` y `npm test` → PASS.
- [ ] **Step 6: Commit**
```bash
git add CLAUDE.md README.md
git commit -m "docs: Productos con IdProducto y costo unitario base (migración 0013)"
```
