# Precio de compra desde la factura y unidad base del producto — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El precio de compra sale de la factura (cada línea con su unidad de medida, guardada tal cual) y el producto trabaja en una única unidad base ingresada al crearlo.

**Architecture:** Una migración `0016` reemplaza `Productos."UnidadMedida"`/`"PrecioCompra"` por la unidad base ingresada, agrega `ComprasDetalle."UnidadMedida"`, recrea el historial y reescribe `registrar_factura`/`anular_factura` (conversión de stock y costo, reversión al anular). La app se adapta por capas: librerías puras → pantallas de Productos → pantallas de Factura → resto de pantallas que muestran unidades.

**Tech Stack:** Next.js (App Router, TS), Supabase/Postgres, PGlite + Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-10-07-precio-desde-factura-design.md`

## Global Constraints

- Rama `feat/precio-desde-factura`; commits con `git add` de rutas explícitas y terminados en `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; la integración a `main` es solo por merge `--no-ff` y solo cuando el usuario lo pida.
- Columnas en PascalCase entre comillas; unidades enlazadas por **código** (FK a `UnidadesMedida("Codigo")`).
- Producto: `"UnidadBase"` obligatoria e ingresada al crear, solo entre unidades base (su propia `UnidadBase` y `Factor` = 1); se elimina `"UnidadMedida"` y `"PrecioCompra"`; `"CostoUnitarioBase" numeric(14,6)` nullable, solo la escribe `registrar_factura`/`anular_factura`.
- Línea de factura: guarda `Precio`, `UnidadMedida` y `Cantidad` tal cual; la unidad debe ser vigente y de la misma familia (misma `UnidadBase`) que la base del producto.
- Stock y `BodegaCentral` en unidad base: `round(cantidad × Factor, 3)`. Costo (con IVA): `round(precio / Factor, 6)` por unidad base.
- Gana la última factura registrada (orden de `IdDetalle`). Historial solo si el costo cambia. Al anular: el costo vuelve al de la última línea de factura **no anulada** del producto (o `null`), filas de historial de esa factura marcadas `Anulada`, y fila `Origen = 'Anulación'` si el costo cambia.
- La unidad base de un producto no se edita si ya tiene stock, facturas, solicitudes o movimientos.
- Stock mínimo/crítico se guardan en unidad base; el formulario permite escribirlos en cualquier unidad de la misma familia (selector, por defecto la base) y el servidor convierte. Solicitudes: cantidades directo en unidad base (selector de unidad en solicitudes queda fuera de alcance).
- Mensajes al usuario: solo de negocio (`P0001`). Sin colores sueltos; etiquetas con `Field`. Instalar dependencias con `--legacy-peer-deps`.
- Entre las tareas 1 y 5 la app no compila (el esquema cambia primero): `npx tsc --noEmit` se exige al final de la Tarea 5; antes solo el Vitest indicado.

## Review Focus

1. Anular una factura B cuyo costo fue seguido por una factura C posterior con el mismo costo no debe cambiar el costo del producto; anular la única factura lo deja en `null` (Tarea 1).
2. Una línea con unidad incompatible, no vigente o con cantidad que convertida a unidad base redondea a 0 debe dar mensaje de negocio y no dejar cabecera, detalle ni stock (Tarea 1).
3. El mismo producto dos veces en una factura (unidades y precios distintos) suma el stock convertido de ambas y rige la última línea; el historial recibe una fila por cambio (Tarea 1).
4. Editar un producto con la unidad base bloqueada no debe poder cambiarla ni por un POST armado a mano: el trigger SQL lo rechaza (prueba en la Tarea 1), la acción ignora el valor enviado (Tarea 3) y el recorrido lo verifica en el navegador (Tarea 6).
5. Un borrador de factura guardado sin unidad en `sessionStorage` se ignora sin romper la pantalla (Tarea 2).

---

### Task 1: Migración 0016 y pruebas SQL

**Files:**
- Create: `supabase/migrations/0016_precio_desde_factura.sql`
- Modify: `supabase/tests/db.test.ts` (seed y tests que usan `UnidadMedida`/`PrecioCompra`/`FACT`; reemplazar los `describe` «productos: costo base» y «historial de precios de compra»; nuevo `describe("precio desde la factura (migración 0016)")`)
- Modify: `supabase/tests/cleanup.test.ts`, `supabase/scripts/e2e-cleanup.sql`

**Interfaces:**
- Produces (SQL): `"Productos"("IdProducto","Codigo","Nombre","UnidadBase" not null,"Formato","CostoUnitarioBase" nullable,"StockMinimo","StockCritico","IdEstado", auditoría)`; `"ComprasDetalle"."UnidadMedida" text not null`; `"HistorialPreciosProducto"("IdHistorial","IdProducto","IdCompra","Origen" in ('Compra','Anulación'),"Precio" null,"UnidadMedida" null,"CostoBaseAnterior" null,"CostoBaseNuevo" null,"Anulada" default false,"IdUsuario","FechaRegistro")`; `registrar_factura(...)` con detalle `[{"producto":<id>,"precio":n,"unidad":"<codigo>","cantidad":n}]` (misma firma de parámetros).

- [ ] **Step 1: Reescribir las pruebas existentes al nuevo modelo (deben fallar).** En `beforeAll` insertar `"Productos"("Codigo","Nombre","UnidadBase","Formato","StockMinimo","StockCritico")`: Harina (`'HAR','G','BOLSA'`, 10000/5000) → id 1, Aceite (`'ACE','ML','BOTELLA'`, 4000/2000) → id 2. El helper `FACT` y todos los detalles JSON agregan `"unidad":"KG"` para Harina y `"unidad":"L"` para Aceite; las cantidades de stock esperadas se multiplican por 1000 (50 KG → 50000 en `StockBodega`, etc.) y las solicitudes/recepciones usan cantidades en gramos/mililitros. Quitar los tests y helpers que insertan `"UnidadMedida"`/`"PrecioCompra"` (`ins(...)` de «productos: costo base», el `describe` de historial 0015) y el test «rechaza producto con unidad/formato inexistente» pasa a probar `UnidadBase` inexistente.
- [ ] **Step 2: Agregar `describe("precio desde la factura (migración 0016)")` con estos tests** (nombres literales):
  - `guarda la línea tal cual y suma el stock convertido a unidad base`: factura con `{"producto":1,"precio":2000,"unidad":"KG","cantidad":5}` → `ComprasDetalle` tiene `Precio=2000`, `UnidadMedida='KG'`, `Cantidad=5`; `BodegaCentral.Cantidad=5000` y `StockBodega` central +5000.
  - `calcula el costo con IVA por unidad base y registra el historial`: costo de Harina = `2.000000` (2000/1000); historial 1 fila `Origen='Compra'`, `CostoBaseAnterior null`, `CostoBaseNuevo 2.000000`, `IdCompra` = la factura.
  - `no registra historial si el costo no cambia`: otra factura con `precio 2`, `unidad G` (mismo costo 2/g) → sigue 1 fila.
  - `rige la última línea y suma el stock de ambas`: una factura con Harina en `KG` a 3000 y luego `G` a 4 → costo `4.000000`, stock +cantidad convertida de ambas, 2 filas nuevas de historial.
  - `rechaza unidad incompatible, no vigente o inexistente sin dejar datos`: unidad `L` para Harina → `/no es compatible/`; unidad con `IdEstado=0` y `'NOPE'` → `/Unidad de medida/`; luego `count(*)` de Compras/ComprasDetalle/BodegaCentral sin cambios.
  - `rechaza una cantidad que convertida a unidad base queda en 0`: unidad con factor `0.0001`... (crear la unidad `MG_E` con base `G` y factor `0.001`, y una línea de cantidad `0.0001`: 0,0001 × 0,001 redondea a 0) → `/demasiado pequeña/`.
  - `anular una factura revierte el costo a la última línea no anulada`: facturas A (Harina 2000 KG), B (3000 KG), C (3000 KG, sin cambio) → anular B deja costo `3.000000` (por C); anular C deja `2.000000` (por A) con fila `Origen='Anulación'`; anular A deja `CostoUnitarioBase null`; las filas de historial de cada factura anulada quedan `Anulada=true`.
  - `anular revierte el stock convertido` (stock central vuelve al valor previo).
  - `la unidad base debe ser base y no se edita con stock, facturas o solicitudes`: insertar producto con `UnidadBase='KG'` falla `/unidad base \(factor 1\)/`; `update ... set "UnidadBase"='ML'` de Harina (con stock) falla `/ya tiene stock o facturas/`; un producto nuevo sin movimientos sí se puede cambiar.
  - `no se puede cambiar el factor de una unidad usada por productos o por líneas de factura`: `update "UnidadesMedida" set "Factor"=500 where "Codigo"='KG'` falla `/hay productos o facturas que usan esta unidad/`.
  - `producto sin compras tiene costo null`.
  - `los mensajes de producto siguen mostrando código y nombre` (adaptar el test de `0014` a las nuevas columnas).
- [ ] **Step 3: Ejecutar** `npx vitest run supabase/tests/db.test.ts` → FAIL (columna `UnidadBase` obligatoria/`UnidadMedida` inexistente).
- [ ] **Step 4: Escribir `0016_precio_desde_factura.sql`** en este orden: (a) `drop trigger`/`drop function` de `trg_costo_base`/`fijar_costo_base` y `trg_historial_precio`/`registrar_historial_precio`; (b) `Productos`: `drop column "UnidadMedida"`, `drop column "PrecioCompra"`, `alter column "CostoUnitarioBase" drop not null`; (c) `ComprasDetalle`: `add column "UnidadMedida" text not null references "UnidadesMedida"("Codigo")` (la tabla está vacía en todos los entornos; documentarlo en el encabezado); (d) `drop table "HistorialPreciosProducto"` y recrearla con las columnas de Interfaces (`IdCompra` FK a `Compras("IdCompra")`, RLS activo, `revoke` a `anon, authenticated`, índice `("IdProducto","IdHistorial" desc)`); (e) trigger `validar_producto_unidad_base()` BEFORE INSERT OR UPDATE en `Productos` (mensajes: `'La unidad base del producto debe ser una unidad base (factor 1)'` y, en UPDATE con `UnidadBase` distinta, si existen filas en `StockBodega`, `ComprasDetalle`, `SolicitudesDetalle` o `MovimientosBodega` del producto, `'No se puede cambiar la unidad base: el producto ya tiene stock o facturas'`); (f) redefinir `validar_unidad_medida()` (de `0013`) para que la comprobación de uso sea `Productos."UnidadBase" = old."Codigo"` o `ComprasDetalle."UnidadMedida" = old."Codigo"`, con el mensaje `'No se puede cambiar la unidad base ni el factor: hay productos o facturas que usan esta unidad'`; (g) `create or replace function registrar_factura(...)` (cuerpo de `0015`) con el algoritmo por línea descrito en el spec §RPC: validar producto vigente → unidad vigente (`'Unidad de medida % no existe o no vigente'`) → compatibilidad (`'La unidad % no es compatible con la unidad base % de %'` usando `etiqueta_producto`) → `v_cant_base := round(cantidad * Factor, 3)` (si `<= 0`: `'La cantidad es demasiado pequeña para la unidad base de %'`) → insertar `ComprasDetalle` (con `UnidadMedida`), `BodegaCentral` y `StockBodega` con `v_cant_base` → `costo := round(precio / Factor, 6)`; si `is distinct from` el `CostoUnitarioBase` actual, actualizar el producto (`IdUsuarioModificacion = p_usuario`) e insertar historial `Origen 'Compra'`; (h) `create or replace function anular_factura(...)` (cuerpo de `0014`) con: revertir stock desde `BodegaCentral` (ya convertido), marcar `Anulada` las filas de historial de la factura, y para cada producto distinto de la factura recalcular el costo desde la última línea (`ComprasDetalle` unida a `Compras` con `IdEstado = 1`, mayor `IdDetalle`, `round(Precio / Factor de su UnidadMedida, 6)`, `null` si no hay) y, si cambia, actualizar el producto e insertar historial `Origen 'Anulación'` con la factura anulada; (i) `revoke all` de las funciones redefinidas.
- [ ] **Step 5: Ejecutar** `npx vitest run supabase/tests/db.test.ts` → PASS.
- [ ] **Step 6: Adaptar `e2e-cleanup.sql` y `cleanup.test.ts`:** productos de prueba y facturas con `"unidad"`; el script borra `HistorialPreciosProducto` donde `"IdProducto" = any(prod_ids)` o `"IdCompra"` pertenece a las compras de los proveedores E2E, antes de borrar `Compras` y `Productos`. Test nuevo: `borra el historial de las facturas y productos E2E y conserva el de los reales`. Ejecutar `npx vitest run supabase/tests` → PASS.
- [ ] **Step 7: Commit**
```bash
git add supabase/migrations/0016_precio_desde_factura.sql supabase/tests supabase/scripts/e2e-cleanup.sql
git commit -m "feat: migración 0016, precio y costo desde la factura con unidad base del producto"
```

---

### Task 2: Librerías puras, esquemas y catálogo

**Files:**
- Create: `lib/unidades.ts`, `lib/unidades.test.ts`
- Modify: `lib/validation/schemas.ts`, `lib/validation/schemas.test.ts`, `lib/productos-filtro.ts`, `lib/productos-filtro.test.ts`, `lib/borrador-factura.ts`, `lib/borrador-factura.test.ts`, `lib/catalogo-nombres.ts`, `lib/services/catalogo.ts`, `lib/services/catalogo.test.ts`

**Interfaces:**
- Produces:
  - `lib/unidades.ts`: `type UnidadInfo = { Codigo: string; Nombre: string; IdEstado: number; UnidadBase: string; Factor: number }`; `unidadesBase(unidades: UnidadInfo[]): UnidadInfo[]` (vigentes con `UnidadBase === Codigo`); `unidadesDeFamilia(unidades: UnidadInfo[], base: string, actual?: string | null): UnidadInfo[]` (vigentes con esa `UnidadBase`, más `actual` aunque esté inactiva); `convertirABase(valor: number, unidad: string, base: string, unidades: UnidadInfo[]): number | null` (`round(valor × Factor, 3)`; `null` si la unidad no existe o es de otra familia).
  - `lib/catalogo-nombres.ts`: `cargarUnidades(): Promise<UnidadInfo[]>` (todas, ordenadas por nombre; `Factor` como número).
  - `productoSchema` → `{ id?: number; codigo?: string; nombre: string; unidadBase: string; formato: string; stockMinimo: number; unidadMinimo?: string; stockCritico: number; unidadCritico?: string; estado: 0|1 }` (sin `unidad` ni `precioCompra`; `stockMinimo`/`stockCritico` son los valores tal como se escribieron, en su selector de unidad; la comparación crítico ≤ mínimo se hace en la acción tras convertir).
  - `facturaSchema.detalle[]` → `{ producto: number; precio: number; unidad: string; cantidad: number }` (`unidad` = `codigoCatalogo`).
  - `Borrador.lineas[]` → `{ producto: string; unidad: string; precio: string; cantidad: string }`; `aplicarPreProducto(lineas, producto)` crea la línea con `unidad: ""`.
  - `ProductoFila` → `{ IdProducto; Codigo: string | null; Nombre; UnidadBase; Formato; CostoUnitarioBase: number | null; StockMinimo; StockCritico; IdEstado }`.
  - `CATALOGOS.unidades.uso` → `Productos` por `UnidadBase` y `{ etiqueta: "Líneas de factura", tabla: "ComprasDetalle", columna: "UnidadMedida", singular: "línea", plural: "líneas" }`.

- [ ] **Step 1: Escribir los tests (fallan):** `unidades.test.ts` — con un arreglo G/KG/ML/L/UN: `unidadesBase` devuelve G, ML, UN; `unidadesDeFamilia(u, "G")` devuelve G y KG (no ML) y agrega una inactiva solo si es `actual`; `convertirABase(5, "KG", "G", u) === 5000`; `convertirABase(0.5, "KG", "G", u) === 500`; `convertirABase(1, "L", "G", u) === null`; `convertirABase(1, "NOPE", "G", u) === null`; `convertirABase(0.0004, "G", "G", u) === 0` (redondea a 3 decimales). `schemas.test.ts` — `productoSchema` acepta `{unidadBase:"G", stockMinimo:"5", unidadMinimo:"KG", ...}`, ya no exige `precioCompra`, rechaza `unidadBase` vacía; `facturaSchema` exige `unidad` en cada línea. `borrador-factura.test.ts` — ida y vuelta con `unidad`; un borrador cuyas líneas no traen `unidad` → `leerBorrador() === null`. `productos-filtro.test.ts` — filas nuevas sin `UnidadMedida`/`PrecioCompra`, `CostoUnitarioBase: null` no rompe. `catalogo.test.ts` — el `uso` de unidades incluye `ComprasDetalle`/`UnidadMedida` y `Productos`/`UnidadBase`.
- [ ] **Step 2:** `npx vitest run lib` → FAIL.
- [ ] **Step 3: Implementar** `lib/unidades.ts` y `cargarUnidades`, y ajustar `productoSchema`, `facturaSchema`, `Borrador`/`esBorrador`/`aplicarPreProducto`, `ProductoFila`/`filtrarProductos` y `CATALOGOS.unidades.uso` según Interfaces.
- [ ] **Step 4:** `npx vitest run lib` → PASS.
- [ ] **Step 5: Commit**
```bash
git add lib
git commit -m "refactor: librerías de unidades, esquemas y catálogo para precio desde la factura"
```

---

### Task 3: Pantallas de Productos

**Files:**
- Modify: `app/(app)/productos/actions.ts`, `form.tsx`, `page.tsx`

**Interfaces:**
- Consumes: Tarea 2 (`UnidadInfo`, `unidadesBase`, `unidadesDeFamilia`, `convertirABase`, `cargarUnidades`, `productoSchema`, `ProductoFila`).
- Produces: `guardarProducto(prev, fd): Promise<{ error?: string; ok?: boolean; id?: number }>`; `FormProducto` props `{ p?: Producto; unidades: UnidadInfo[]; formatos: ItemCatalogo[]; unidadBaseBloqueada?: boolean; volver?; despuesDeGuardar? }` con `Producto = { IdProducto; Codigo; Nombre; UnidadBase; Formato; CostoUnitarioBase: number | null; StockMinimo; StockCritico; IdEstado }`.

- [ ] **Step 1: Implementar la acción.** `guardarProducto`: valida con `productoSchema`; carga `cargarUnidades()` y `cargarCatalogo("Formatos")`; exige que `unidadBase` sea una unidad base vigente (o la actual al editar) y el formato permitido; **al editar usa siempre la `UnidadBase` guardada en la base de datos cuando el producto tiene stock/facturas** (la acción lee las filas y, si existen, ignora el valor enviado: así un POST armado a mano no la cambia); convierte `stockMinimo`/`stockCritico` con `convertirABase(valor, unidadX ?? unidadBase, unidadBase, unidades)` (si da `null`: «Unidad no válida para el stock»); si crítico > mínimo: «El stock crítico no puede superar al mínimo»; guarda sin `PrecioCompra` ni `CostoUnitarioBase`; mapea `23505` (código/nombre) y `P0001` (mensaje del trigger) como mensajes de negocio.
- [ ] **Step 2: Implementar el formulario.** Campos: Código (opcional), Nombre, «Unidad base» (select de `unidadesBase(unidades)`; deshabilitado con ayuda «No se puede cambiar: el producto ya tiene stock o facturas» si `unidadBaseBloqueada`), Formato, Stock mínimo y Stock crítico (cada uno: número + select de unidad con `unidadesDeFamilia(unidades, <base elegida>)`, por defecto la base; al editar se muestran en la unidad base), Estado. Sin «Precio de compra».
- [ ] **Step 3: Implementar la página.** Listado: columna «Unidad» = nombre de la unidad base; `COLS` sin `UnidadMedida`/`PrecioCompra`. Ver: «Unidad base», «Costo unitario base (con IVA)» (`$x por <unidad base>` o «—» si `null`), stock por bodega con la unidad base, y «Historial de precios de compra» con columnas Fecha, Origen (Compra / Anulación; «Anulada» como `Badge` neutral cuando corresponda), Factura (folio con enlace a `/compras/<IdCompra>` si el usuario tiene `compras.ver`), Precio de la línea con su unidad (o «—»), Costo anterior → nuevo, Usuario; consulta `HistorialPreciosProducto` con `Usuarios!HistorialPreciosProducto_IdUsuario_fkey(Nombres,Apellidos)` y `Compras(Folio)`; `unidadBaseBloqueada` se calcula en la página al editar (existe alguna fila en `StockBodega`, `ComprasDetalle`, `SolicitudesDetalle` o `MovimientosBodega` del producto).
- [ ] **Step 4:** `npx vitest run lib` → PASS (sin regresiones; el `tsc` completo se exige en la Tarea 5).
- [ ] **Step 5: Commit**
```bash
git add "app/(app)/productos"
git commit -m "feat: Productos con unidad base ingresada, costo desde factura e historial"
```

---

### Task 4: Pantallas de Factura

**Files:**
- Modify: `app/(app)/compras/nueva/page.tsx`, `form-factura.tsx`, `app/(app)/compras/[id]/page.tsx`, `app/(app)/compras/actions.ts` (solo si el tipo del detalle lo exige)

**Interfaces:**
- Consumes: Tarea 2 (`UnidadInfo`, `unidadesDeFamilia`, `cargarUnidades`, `facturaSchema`, `Borrador` con `unidad`).
- Produces: `FormFactura` props `{ proveedores; productos: { id: number; codigo: string | null; nombre: string; unidadBase: string }[]; unidades: UnidadInfo[]; formasPago; preProveedor?; preProducto? }`; cada línea envía `{ producto, unidad, precio, cantidad }`.

- [ ] **Step 1: Implementar la página nueva.** Selecciona `IdProducto,Codigo,Nombre,UnidadBase` de productos vigentes y pasa `unidades` (`cargarUnidades()`); `registrarFactura` ya recibe el detalle por Zod (con `unidad`).
- [ ] **Step 2: Implementar el formulario.** Cada línea: Producto, «Unidad de medida» (select con `unidadesDeFamilia(unidades, baseDelProducto)`, deshabilitado hasta elegir producto; al elegir un producto se propone su unidad base), Precio unitario (IVA incl.), Cantidad. Validar en cliente que la línea tenga unidad (mensaje por línea). El borrador guarda/restaura la unidad. El total/neto/IVA sigue con `calcularTotales`.
- [ ] **Step 3: Implementar el detalle de factura.** Consultar `ComprasDetalle` con `UnidadMedida` propia (sin `Productos.UnidadMedida`): la columna «Unidad» muestra el nombre de la unidad de la línea.
- [ ] **Step 4:** `npx vitest run lib` → PASS.
- [ ] **Step 5: Commit**
```bash
git add "app/(app)/compras"
git commit -m "feat: unidad de medida en las líneas de la factura"
```

---

### Task 5: Resto de pantallas con unidades

**Files:**
- Modify: `app/(app)/bodegas/page.tsx`, `app/(app)/solicitudes/nueva/page.tsx`, `app/(app)/solicitudes/[id]/page.tsx`, `lib/services/catalogo.ts` (si faltara algo del `uso`)

**Interfaces:**
- Consumes: `Productos.UnidadBase` (reemplaza a `UnidadMedida` en todas las consultas).

- [ ] **Step 1:** En Bodegas (Ver), Solicitudes (nueva y `[id]`) cambiar `UnidadMedida` por `UnidadBase` en los `select`, los mapas de nombres y los rótulos «(unidad)».
- [ ] **Step 2: Verificar:** `grep -rn "UnidadMedida\|PrecioCompra\|precioCompra" app lib components` solo debe mostrar: `ComprasDetalle.UnidadMedida`, el catálogo `UnidadesMedida`, `IdUnidadMedida` y el nombre de tabla; luego `npx tsc --noEmit` sin errores y `npm test` → todo PASS.
- [ ] **Step 3: Commit**
```bash
git add "app/(app)/bodegas/page.tsx" "app/(app)/solicitudes" lib/services/catalogo.ts
git commit -m "refactor: las pantallas de stock y solicitudes muestran la unidad base del producto"
```

---

### Task 6: Aplicar migración, documentación y recorrido en navegador

**Files:**
- Modify: `CLAUDE.md`, `README.md`
- Create (scratchpad, no versionado): guion Playwright `precio-factura.mjs`

- [ ] **Step 1:** Antes de aplicar, consultar en Supabase `Productos`, `Compras`, `ComprasDetalle`, `StockBodega` y `HistorialPreciosProducto` y mostrar los conteos; solo si están vacíos (o son de prueba) aplicar `0016` con `apply_migration`; si no, detenerse y preguntar.
- [ ] **Step 2:** Verificar con `execute_sql` las columnas de `Productos` y `ComprasDetalle`, y `get_advisors` (seguridad): sin tablas sin RLS.
- [ ] **Step 3:** Con el servidor de desarrollo y el guion Playwright (`scripts/e2e-setup.ts` para el usuario admin; proveedor y bodega E2E por SQL): crear producto con unidad base Gramo y stock mínimo «5 Kilo» (queda 5000) → factura con unidad Kilo a $2.000 (stock 5000 g por 5 kilos, costo $2/g, historial) → segunda factura en Gramos con otro precio → unidad incompatible (Litro) rechazada → anular la segunda y comprobar la reversión del costo → unidad base bloqueada en Editar → «Dónde se usa» de KG → 375 px sin scroll horizontal y sin errores de consola. Cada comprobación imprime PASS/FAIL; todo PASS.
- [ ] **Step 4:** Limpiar los datos de prueba con `supabase/scripts/e2e-cleanup.sql` (y las unidades de prueba a mano) y borrar `.env.e2e`.
- [ ] **Step 5:** Actualizar `CLAUDE.md` (migraciones `0001…0016`, sección Productos: unidad base ingresada, costo con IVA desde factura, historial con `Origen`/`Anulada`, selector de unidad en stock mínimo/crítico, línea de factura con unidad) y `README.md`; ejecutar `npx tsc --noEmit` y `npm test` → PASS.
- [ ] **Step 6: Commit**
```bash
git add CLAUDE.md README.md
git commit -m "docs: precio de compra desde la factura y unidad base del producto (migración 0016)"
```
