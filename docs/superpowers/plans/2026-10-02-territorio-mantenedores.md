# Mantenedores de Región, Ciudad y Comuna Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los textos libres Región/Ciudad/Comuna de Proveedores y Sucursales por listas dependientes alimentadas por tres mantenedores solo-Administrador, con datos oficiales de Chile.

**Architecture:** Tres tablas jerárquicas (`Regiones` → `Provincias` → `Comunas`, «Ciudad» = Provincia) con códigos CUT y FK por código, sembradas por un script que consulta el servicio DPA del MOP. Los mantenedores reutilizan el servicio/página genéricos de catálogo, ampliados con un padre opcional. Los formularios usan un selector de territorio (tres `Combobox`) y el servidor revalida la jerarquía; la base la impone también con un trigger.

**Tech Stack:** Next.js (App Router) + Supabase/Postgres, Zod, Vitest (PGlite para SQL), `Combobox` existente.

**Spec:** `docs/superpowers/specs/2026-10-02-territorio-mantenedores-design.md`

## Global Constraints

- Fuente oficial: `https://rest-sit.mop.gob.cl/arcgis/rest/services/INTEROP/SERVICIO_DPA/MapServer` (capas 1 Comunas, 2 Provincias, 3 Regiones; campos `CUT_REG`, `CUT_PROV`, `CUT_COM`, `REGION`, `PROVINCIA`, `COMUNA`). Totales esperados: 16 regiones, 56 provincias, 346 comunas (el servicio trae 345: falta **Antártica**, CUT `12202`, provincia `122` «Antártica Chilena», región `12`; se agrega a mano).
- Códigos CUT: región `^[0-9]{2}$`, provincia `^[0-9]{3}$`, comuna `^[0-9]{5}$`. Inmutables tras crear.
- «Ciudad» en la UI = Provincia; mantenedor y lista rotulados «Ciudades (provincias)» / «Ciudad».
- Autorización: solo Administrador (`requerirAdmin()` en actions, `requerirPaginaAdmin()` en páginas); no hay permiso asignable.
- Región/Ciudad/Comuna se guardan por CÓDIGO con FK (nunca texto); siguen siendo opcionales. Si hay comuna debe haber ciudad, y si hay ciudad, región; la jerarquía debe ser coherente.
- Mensajes al usuario: solo de negocio (`P0001` de SQL), nunca errores crudos.
- UI en español; usar clases de `app/tema.css` (`card`, `btn`, `input`, `table-wrap`, ...), `Field`/`Combobox`, sin colores Tailwind sueltos.
- Nueva migración numerada + actualizar `supabase/tests/db.test.ts`. Instalar dependencias con `--legacy-peer-deps`.
- El spec decía una sola migración `0008`; este plan la divide en `0008_territorio.sql` (tablas), `0009_territorio_datos.sql` (inserts generados) y `0010_territorio_proveedores.sql` (conversión + FK + trigger) para que los datos generados no se mezclen con el esquema escrito a mano. Actualizar el spec en Task 7.
- Ningún listado de proveedores muestra región/ciudad/comuna hoy, así que «resolver nombres al mostrar» se cumple con las etiquetas de los combobox del detalle.

## Review Focus

- Proveedor con solo región (sin ciudad ni comuna), o sin ninguno: se guarda sin error.
- Comuna de otra provincia, o ciudad de otra región, enviada a mano (sin pasar por la UI): rechazada con mensaje de negocio en servidor y en SQL.
- Proveedor guardado con una comuna que luego se desactiva: el detalle la sigue mostrando («no vigente») y se puede guardar sin cambiarla; no se puede elegir una inactiva nueva.
- Desactivar una región (o ciudad) con hijos vigentes: mensaje de negocio, sin error crudo de BD.
- Código nuevo con letras o largo incorrecto en estos mantenedores: rechazado; código repetido: «Ya existe un registro con ese código».
- Textos antiguos con tildes/mayúsculas distintas («ÑUBLE», «Valparaiso») se convierten al código correcto; los desconocidos quedan en `NULL` sin romper la migración.

---

## File Structure

- `scripts/territorio.ts` (nuevo): funciones puras `unirTerritorio` y `construirSql`.
- `scripts/generar-territorio.ts` (nuevo): consulta el servicio MOP y escribe `0009`.
- `supabase/migrations/0008_territorio.sql`, `0009_territorio_datos.sql`, `0010_territorio_proveedores.sql` (nuevos).
- `lib/territorio-opciones.ts` (nuevo): tipos y funciones puras de opciones/jerarquía (cliente y servidor).
- `lib/services/territorio.ts` (nuevo, servidor): `cargarTerritorio`, `verificarTerritorio`.
- `components/app/selector-territorio.tsx` (nuevo, cliente): tres combobox dependientes.
- `lib/services/catalogo.ts`, `components/app/catalogo-admin.tsx`, `components/app/catalogo-form.tsx` (modificar): padre opcional, patrón de código, errores `P0001`.
- `app/(app)/mantenedores/{regiones,ciudades,comunas}/{page.tsx,actions.ts}` y `app/(app)/mantenedores/page.tsx` (nuevo/modificar).
- `app/(app)/proveedores/{forms.tsx,actions.ts,page.tsx,[id]/page.tsx}`, `lib/validation/schemas.ts` (modificar).
- Tests: `scripts/territorio.test.ts`, `supabase/tests/db.test.ts`, `lib/territorio-opciones.test.ts`, `lib/validation/schemas.test.ts`, y el test de `prepararFila` si existe (`grep -rl prepararFila lib`).

---

### Task 1: Generador de datos oficiales

**Files:**
- Create: `scripts/territorio.ts`, `scripts/generar-territorio.ts`, `scripts/territorio.test.ts`
- Create (salida del script): `supabase/migrations/0009_territorio_datos.sql`

**Interfaces:**
- Produces:
  - `type FilaComuna = { CUT_REG: string; CUT_PROV: string; CUT_COM: string; REGION: string; PROVINCIA: string; COMUNA: string }`
  - `type Territorio = { regiones: {codigo: string; nombre: string}[]; provincias: {codigo: string; nombre: string; codigoRegion: string}[]; comunas: {codigo: string; nombre: string; codigoProvincia: string}[] }`
  - `unirTerritorio(filas: FilaComuna[]): Territorio` — agrega Antártica si falta (CUT 12202), deduplica y ordena por código; lanza `Error` si el resultado no es 16/56/346 o si algún prefijo de código es incoherente (comuna ↛ provincia ↛ región).
  - `construirSql(t: Territorio): string` — inserts en lote, escapando `'`, en orden regiones→provincias→comunas.

- [ ] **Step 1: Escribir tests en `scripts/territorio.test.ts`** con un `FILAS` mínimo de fixture: `unirTerritorio` sobre 345 filas reales no cabe en un fixture, así que el test genera filas sintéticas (16 regiones × provincias × comunas hasta 56/345 con códigos coherentes) y comprueba: (a) agrega `12202` «Antártica» y el total pasa a 346; (b) no duplica Antártica si ya viene; (c) lanza si falta una provincia (55); (d) lanza si una comuna `01101` está bajo la provincia `021`; (e) `construirSql` escapa `O'Higgins` como `O''Higgins` y contiene `insert into "Regiones"`, `insert into "Provincias"` y `insert into "Comunas"` en ese orden.
- [ ] **Step 2: Ejecutar** `npx vitest run scripts/territorio.test.ts` — esperado: FAIL (módulo no existe).
- [ ] **Step 3: Implementar `scripts/territorio.ts`** con las firmas de arriba (nombres tal cual los entrega la fuente, solo `trim`).
- [ ] **Step 4: Ejecutar** el mismo test — esperado: PASS.
- [ ] **Step 5: Implementar `scripts/generar-territorio.ts`**: `fetch` a `<base>/1/query?where=1%3D1&outFields=CUT_REG,CUT_PROV,CUT_COM,REGION,PROVINCIA,COMUNA&returnGeometry=false&orderByFields=CUT_COM&f=json` (si `exceededTransferLimit` es true, paginar con `resultOffset`), `unirTerritorio`, y escribir `supabase/migrations/0009_territorio_datos.sql` con un comentario de cabecera (fuente, fecha de consulta, nota de Antártica) + `construirSql`. Importar con extensión `.ts` (se ejecuta con `node scripts/generar-territorio.ts`). Agregar en `package.json` el script `"gen:territorio": "node scripts/generar-territorio.ts"`.
- [ ] **Step 6: Ejecutar** `npm run gen:territorio` — esperado: imprime «16 regiones, 56 provincias, 346 comunas» y crea el archivo. Revisar a ojo 10 filas (tildes y «Ñuble» correctas, sin caracteres rotos).
- [ ] **Step 7: Commit**

```bash
git add scripts package.json supabase/migrations/0009_territorio_datos.sql
git commit -m "feat: generador de datos oficiales de regiones, provincias y comunas"
```

---

### Task 2: Migraciones 0008 (tablas) y datos cargados

**Files:**
- Create: `supabase/migrations/0008_territorio.sql`
- Modify: `supabase/tests/db.test.ts` (nuevo `describe("territorio")` al final)

**Interfaces:**
- Produces (SQL): tablas `"Regiones"("IdRegion","Codigo","Nombre","IdEstado",...)`, `"Provincias"(... "CodigoRegion" references "Regiones"("Codigo"))`, `"Comunas"(... "CodigoProvincia" references "Provincias"("Codigo"))`, con las columnas de auditoría de `FormasPago` (`IdUsuarioCreacion`, `FechaRegistroCreacion`, `IdUsuarioModificacion`, `FechaRegistroModificacion`), trigger `trg_mod` con `set_modificacion()`, RLS activo y `revoke all ... from anon, authenticated`. Checks de formato de `Codigo` (patrones de Global Constraints). Trigger `trg_desactivar_territorio` (before update de `IdEstado` 1→0 en `Regiones` y `Provincias`) que hace `raise exception` con mensaje de negocio si hay hijos vigentes: «No se puede desactivar: la región tiene ciudades vigentes» / «No se puede desactivar: la ciudad tiene comunas vigentes». Las FK son por `"Codigo"`, igual que en 0006.

- [ ] **Step 1: Escribir tests en `db.test.ts`** (`describe("territorio")`): conteos `16/56/346` en las tres tablas; `select "Nombre" from "Comunas" where "Codigo"='12202'` es «Antártica»; insertar una comuna con `CodigoProvincia` inexistente falla; insertar región con código `'1'` o `'AB'` falla (check); desactivar la región `'13'` falla con `/ciudades vigentes/`; desactivar una provincia con comunas vigentes falla con `/comunas vigentes/`; desactivar una región recién creada sin hijos (`'99'`) funciona; las tres tablas tienen `relrowsecurity` verdadero.
- [ ] **Step 2: Ejecutar** `npx vitest run supabase/tests/db.test.ts -t territorio` — esperado: FAIL (tablas no existen).
- [ ] **Step 3: Escribir `0008_territorio.sql`** siguiendo el patrón de `0006_maestros.sql` (tablas, trigger de auditoría, RLS, función y trigger de desactivación con `set search_path = public`).
- [ ] **Step 4: Ejecutar** el test del paso 2 — esperado: PASS (las migraciones `0008` y `0009` corren en orden por nombre de archivo).
- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_territorio.sql supabase/tests/db.test.ts
git commit -m "feat: tablas Regiones, Provincias y Comunas con jerarquía y desactivación protegida"
```

---

### Task 3: Migración 0010 — Proveedores y Sucursales por código

**Files:**
- Create: `supabase/migrations/0010_territorio_proveedores.sql`
- Modify: `supabase/tests/db.test.ts`

**Interfaces:**
- Consumes: tablas de Task 2.
- Produces (SQL): en `"Proveedores"` y `"ProveedoresSucursales"`, columnas `"Region"`, `"Ciudad"`, `"Comuna"` (siguen `text`, ahora códigos) con FK a `Regiones("Codigo")`, `Provincias("Codigo")`, `Comunas("Codigo")`; función/trigger `validar_territorio()` (before insert/update en ambas tablas, `set search_path = public`) que lanza: «La comuna requiere ciudad», «La ciudad requiere región», «La comuna no pertenece a la ciudad», «La ciudad no pertenece a la región».

**Conversión (antes de crear las FK):** comparar con `lower(translate(trim(x),'áéíóúüñ','aeiouun'))` contra el nombre normalizado de la tabla maestra. Resultado coherente por construcción: si la comuna coincide → quedan esa comuna, su provincia y su región; si no, pero la ciudad coincide → provincia y su región, comuna `NULL`; si no, pero la región coincide → solo región; si nada coincide → los tres `NULL`. Escribir como `update ... from (select ...)` por tabla (misma sentencia para ambas, p. ej. con un `do $$ ... foreach t ... $$`).

- [ ] **Step 1: Escribir tests en `db.test.ts`.** El `beforeAll` ya inserta «Prov SA» sin territorio; agregar tests: (a) insertar proveedor con `Region='13'` sola funciona; (b) `Comuna='13101'` sin `Ciudad` falla `/requiere ciudad/`; (c) `Ciudad='131', Region='05'` falla `/no pertenece a la región/`; (d) `Region='13', Ciudad='131', Comuna='05101'` falla `/no pertenece a la ciudad/`; (e) combinación válida `('13','131','13101')` funciona en `Proveedores` y en `ProveedoresSucursales`; (f) código inexistente `Region='77'` falla por FK. Para la conversión, un test que ejecuta el SQL de conversión sobre una tabla temporal con filas `'ÑUBLE'`/`'Valparaiso'`/`'Santiago'`/`'Providencia'`/`'xyz'` — para eso, dejar la lógica de conversión en una función SQL `convertir_territorio_texto(region text, ciudad text, comuna text) returns table(region text, ciudad text, comuna text)` que la migración usa y el test invoca directamente; esperado: `('ÑUBLE',null,null)`→`('16',null,null)`; `(null,null,'providencia')`→`('13','131','13123')`; `('Valparaiso','Valparaíso',null)`→`('05','051',null)`; `('xyz','abc','def')`→todo `NULL`.
- [ ] **Step 2: Ejecutar** `npx vitest run supabase/tests/db.test.ts -t "territorio"` — esperado: FAIL.
- [ ] **Step 3: Escribir `0010_territorio_proveedores.sql`**: función `convertir_territorio_texto`, `update` de ambas tablas usándola, `alter table ... add constraint ... foreign key`, función y triggers `validar_territorio`.
- [ ] **Step 4: Ejecutar** `npx vitest run supabase/tests/db.test.ts` completo — esperado: PASS (incluye los tests previos de facturas/solicitudes).
- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0010_territorio_proveedores.sql supabase/tests/db.test.ts
git commit -m "feat: proveedores y sucursales guardan región, ciudad y comuna por código"
```

---

### Task 4: Lógica pura de opciones, jerarquía y Zod

**Files:**
- Create: `lib/territorio-opciones.ts`, `lib/territorio-opciones.test.ts`
- Modify: `lib/validation/schemas.ts` (`proveedorSchema`, `sucursalSchema`), `lib/validation/schemas.test.ts`

**Interfaces:**
- Consumes: `Opcion` (`{ valor: string; etiqueta: string }`) de `lib/buscar.ts`.
- Produces:
  - `type ItemTerritorio = { Codigo: string; Nombre: string; IdEstado: number }`
  - `type Territorio = { regiones: ItemTerritorio[]; ciudades: (ItemTerritorio & { CodigoRegion: string })[]; comunas: (ItemTerritorio & { CodigoProvincia: string })[] }`
  - `type Seleccion = { region: string | null; ciudad: string | null; comuna: string | null }`
  - `opcionesRegion(t: Territorio, actual: string | null): Opcion[]`
  - `opcionesCiudad(t: Territorio, region: string | null, actual: string | null): Opcion[]` — vacío si no hay región; solo ciudades de esa región.
  - `opcionesComuna(t: Territorio, ciudad: string | null, actual: string | null): Opcion[]` — vacío si no hay ciudad.
  - Las tres: solo vigentes, más `actual` si existe aunque esté inactivo (etiqueta `«Nombre (no vigente)»`), ordenadas por nombre.
  - `errorTerritorio(t: Territorio, sel: Seleccion, actual: Seleccion): string | null` — mensajes: «La comuna requiere ciudad», «La ciudad requiere región», «Región no válida», «Ciudad no válida», «Comuna no válida» (no existe, o está inactiva y distinta de `actual`), «La ciudad no pertenece a la región», «La comuna no pertenece a la ciudad»; `null` si todo está bien o todo vacío.

- [ ] **Step 1: Escribir tests** en `lib/territorio-opciones.test.ts` con un `Territorio` de fixture (2 regiones, 3 ciudades, 4 comunas, una comuna inactiva): `opcionesCiudad(t, null, null)` es `[]`; `opcionesCiudad(t,'13',null)` solo trae las de la 13; una comuna inactiva aparece solo si es `actual`, con «(no vigente)»; `errorTerritorio` devuelve `null` para vacío, para solo región y para combinación válida; devuelve exactamente cada mensaje listado para: comuna sin ciudad, ciudad sin región, comuna de otra provincia, ciudad de otra región, código inexistente, comuna inactiva nueva; y `null` cuando la comuna inactiva es igual a `actual`.
- [ ] **Step 2: Ejecutar** `npx vitest run lib/territorio-opciones.test.ts` — esperado: FAIL.
- [ ] **Step 3: Implementar** las funciones en `lib/territorio-opciones.ts` (sin imports de servidor: se usa también en el cliente).
- [ ] **Step 4: Ejecutar** — esperado: PASS.
- [ ] **Step 5: Tests de Zod** en `schemas.test.ts`: `proveedorSchema` y `sucursalSchema` aceptan región sola, vacío, y trío completo (los códigos pasan tal cual como strings); rechazan comuna sin ciudad («La comuna requiere ciudad») y ciudad sin región («La ciudad requiere región»), con `path` en `comuna` / `ciudad`. Ejecutar — esperado: FAIL.
- [ ] **Step 6: Implementar** en `schemas.ts` un `.superRefine` compartido (función `territorioCompleto`) aplicado a ambos esquemas, con esos mensajes; recordar que `proveedorSchema` y `sucursalSchema` son hoy `z.object` sin refine. Ejecutar `npx vitest run lib` — esperado: PASS.
- [ ] **Step 7: Commit**

```bash
git add lib
git commit -m "feat: opciones y validación de jerarquía territorial"
```

---

### Task 5: Mantenedores de Regiones, Ciudades y Comunas

**Files:**
- Modify: `lib/services/catalogo.ts`, `components/app/catalogo-admin.tsx`, `components/app/catalogo-form.tsx`, `app/(app)/mantenedores/page.tsx`
- Create: `app/(app)/mantenedores/{regiones,ciudades,comunas}/{page.tsx,actions.ts}`
- Test: el test existente de `prepararFila`/`guardarCatalogo` (localizar con `grep -rl "prepararFila" lib app`; si no hay, crear `lib/services/catalogo.test.ts`)

**Interfaces:**
- Consumes: `catalogoSchema` (`lib/validation/catalogo.ts`), tablas de Task 2.
- Produces:
  - `CatalogoCfg` ampliado: `tabla` acepta también `"Regiones" | "Provincias" | "Comunas"`; `id` acepta `"IdRegion" | "IdProvincia" | "IdComuna"`; campos opcionales `patronCodigo?: RegExp`, `ayudaCodigo?: string` y `padre?: { columna: "CodigoRegion" | "CodigoProvincia"; tabla: "Regiones" | "Provincias"; etiqueta: "Región" | "Ciudad" }`.
  - `CATALOGOS` con tres claves nuevas: `regiones` (ruta `/mantenedores/regiones`, «Regiones», patrón `^\d{2}$`), `ciudades` («Ciudades (provincias)», `/mantenedores/ciudades`, `^\d{3}$`, padre `CodigoRegion`/`Regiones`/«Región»), `comunas` («Comunas», `/mantenedores/comunas`, `^\d{5}$`, padre `CodigoProvincia`/`Provincias`/«Ciudad»).
  - `prepararFila(cfg, d, uid, editando)`: `Datos` gana `padre?: string`; al **crear** incluye `[cfg.padre.columna]: d.padre`; al **editar** nunca incluye código ni padre.
  - `guardarCatalogo`: si `cfg.patronCodigo` y el código no coincide → `{ error: cfg.ayudaCodigo }`; si `cfg.padre` y falta `padre` → «Elija <etiqueta>» (para crear); error SQL `P0001` → devolver `error.message`; `23503` (padre inexistente) → «El padre elegido no existe»; `23505` sigue siendo «Ya existe un registro con ese código».
  - `FormCatalogo` y `PaginaCatalogo`: con `cfg.padre`, un `<select name="padre">` (etiqueta `cfg.padre.etiqueta`, solo al crear; al editar se muestra deshabilitado con el valor) con opciones de la tabla padre (`Código — Nombre`; para comunas la etiqueta del padre incluye su región: `«Provincia (Región)»`), y una columna del padre en la tabla de la página. El hint del código usa `cfg.ayudaCodigo` (p. ej. «2 dígitos, código CUT») y `inputMode="numeric"`.

- [ ] **Step 1: Escribir tests** del servicio: `prepararFila` al crear una comuna incluye `CodigoProvincia`; al editar no incluye `Codigo` ni `CodigoProvincia`; con las tres cfg nuevas `guardarCatalogo` rechaza código con letras o largo incorrecto (sin tocar la BD: el rechazo ocurre antes del `db`), y exige padre al crear comunas/ciudades. Extraer la validación previa en una función pura `validarEntradaCatalogo(cfg, fd): { error?: string; datos?: Datos }` para poder probarla sin Supabase.
- [ ] **Step 2: Ejecutar** el test — esperado: FAIL.
- [ ] **Step 3: Implementar** los cambios de `catalogo.ts` (incluida `validarEntradaCatalogo`) y las tres entradas nuevas de `CATALOGOS`.
- [ ] **Step 4: Ejecutar** — esperado: PASS.
- [ ] **Step 5: Ampliar `PaginaCatalogo` y `FormCatalogo`** según Interfaces, sin romper los tres catálogos existentes (sin `padre` se ven igual que hoy).
- [ ] **Step 6: Crear las tres rutas** copiando el patrón de `formatos` (`actions.ts` con `requerirAdmin()` + `guardarCatalogo(CATALOGOS.<x>, s.uid, fd)`; `page.tsx` con `PaginaCatalogo`), y agregar tres tarjetas a `TARJETAS` en `mantenedores/page.tsx` con descripciones («Regiones de Chile (código CUT).», «Ciudades = provincias de cada región.», «Comunas de cada ciudad.»).
- [ ] **Step 7: Verificar** `npx tsc --noEmit` y `npm test` — esperado: sin errores.
- [ ] **Step 8: Commit**

```bash
git add lib components app
git commit -m "feat: mantenedores de regiones, ciudades y comunas (solo Administrador)"
```

---

### Task 6: Formularios de Proveedor y Sucursal con selects dependientes

**Files:**
- Create: `lib/services/territorio.ts`, `components/app/selector-territorio.tsx`
- Modify: `app/(app)/proveedores/forms.tsx`, `app/(app)/proveedores/actions.ts`, `app/(app)/proveedores/page.tsx`, `app/(app)/proveedores/[id]/page.tsx`

**Interfaces:**
- Consumes: `Territorio`, `Seleccion`, `opcionesRegion/Ciudad/Comuna`, `errorTerritorio` (Task 4); `Combobox` (`components/app/combobox.tsx`, props `label, opciones, valor, onCambio`, opciones `{valor, etiqueta}`).
- Produces:
  - `cargarTerritorio(): Promise<Territorio>` (servidor): lee las tres tablas completas (vigentes y no) con `CodigoRegion`/`CodigoProvincia` y las ordena por nombre.
  - `verificarTerritorio(sel: Seleccion, actual: Seleccion): Promise<string | null>` (servidor): `cargarTerritorio` + `errorTerritorio`.
  - `<SelectorTerritorio territorio={Territorio} inicial={Seleccion} />` (cliente): tres `Combobox` (Región, Ciudad, Comuna); al cambiar la región limpia ciudad y comuna, al cambiar la ciudad limpia la comuna; renderiza `<input type="hidden" name="region|ciudad|comuna">` con el valor actual; ciudad y comuna quedan sin opciones (y el combobox sin `required`) mientras no haya padre. Debe ocupar tres celdas de la rejilla actual (`form-grid-3` en proveedor, `form-grid-4` en sucursal: envolver en `fld-full` con su propia rejilla interna `form-grid form-grid-3`).
  - `FormProveedor` y `FormSucursal` reciben la prop `territorio: Territorio` y reemplazan los tres `<input>` de texto por `SelectorTerritorio` con `inicial` tomada de `p`/`s` (`Region`, `Ciudad`, `Comuna`).

- [ ] **Step 1: Implementar** `lib/services/territorio.ts` y `selector-territorio.tsx` según Interfaces (el selector es presentación pura sobre las funciones ya probadas de Task 4).
- [ ] **Step 2: Actions.** En `guardarProveedor` y `guardarSucursal`, después del Zod: si es edición, leer los valores actuales (`Region, Ciudad, Comuna`) de la fila; llamar `verificarTerritorio({region: d.region, ciudad: d.ciudad, comuna: d.comuna}, actual)` y devolver `{ error }` si no es `null`. En el `catch`/error de BD, si `error.code === "P0001"` devolver `error.message` (red de seguridad del trigger).
- [ ] **Step 3: Páginas.** `proveedores/page.tsx` y `proveedores/[id]/page.tsx` llaman `cargarTerritorio()` (dentro del `Promise.all` existente en el detalle) y lo pasan a los formularios.
- [ ] **Step 4: Verificar** `npx tsc --noEmit` y `npm test` — esperado: sin errores.
- [ ] **Step 5: Verificación en navegador** (`preview_start` del dev server, con la migración aplicada en una base local/Supabase de prueba según Task 7): `/proveedores` → elegir región, luego ciudad (solo las de esa región), luego comuna; cambiar región limpia los hijos; guardar y reabrir muestra los nombres; sin región, ciudad y comuna no ofrecen opciones. Revisar `read_console_messages` sin errores y captura de pantalla (escritorio y 375 px).
- [ ] **Step 6: Commit**

```bash
git add lib components app
git commit -m "feat: región, ciudad y comuna como listas dependientes en proveedores y sucursales"
```

---

### Task 7: Aplicar en Supabase, documentación y verificación final

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/superpowers/specs/2026-10-02-territorio-mantenedores-design.md`

- [ ] **Step 1: Listar textos sin coincidencia** (antes de aplicar): con `execute_sql` en Supabase, `select distinct "Region","Ciudad","Comuna" from "Proveedores" union select ... from "ProveedoresSucursales"` y comparar a mano con las tablas ya cargadas; mostrar al usuario los que quedarán en `NULL`. **Pedir confirmación al usuario antes del paso 2** (modifica la base real).
- [ ] **Step 2: Aplicar** `0008`, `0009` y `0010` con `apply_migration` (en ese orden); verificar con `execute_sql` los conteos 16/56/346 y con `get_advisors` (security) que las tres tablas nuevas tienen RLS y no hay avisos nuevos.
- [ ] **Step 3: Documentar:** `CLAUDE.md` (migraciones `0001`…`0010`; mantenedores `regiones|ciudades|comunas`; «Ciudad = Provincia»; Región/Ciudad/Comuna por CÓDIGO; `lib/territorio-opciones.ts` y `selector-territorio.tsx`; script `gen:territorio`), `README.md` (orden de migraciones y cómo regenerar los datos), y en el spec reemplazar «migración `0008_territorio.sql`» por la división `0008`/`0009`/`0010` y `scripts/generar-territorio.ts` como fuente de `0009`.
- [ ] **Step 4: Verificación final:** `npx tsc --noEmit`, `npm test` y `npm run build` — esperado: todo en verde. Recorrer en el navegador `/mantenedores` como Administrador (ver las tres tarjetas, crear y editar una ciudad de prueba, intentar desactivar una región con hijos y ver el mensaje de negocio) y confirmar que un usuario no Administrador es redirigido de `/mantenedores/regiones`.
- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md README.md docs
git commit -m "docs: territorio (regiones, ciudades, comunas) en CLAUDE.md, README y spec"
```

---

## Self-Review

- **Spec coverage:** fuente oficial y Antártica (Task 1); tablas, FK, auditoría, RLS, códigos inmutables y desactivación con hijos (Task 2); conversión de textos y FK en Proveedores/Sucursales y jerarquía en SQL (Task 3); validación Zod y de servidor (Tasks 4 y 6); mantenedores solo-Administrador y tarjetas (Task 5); selects dependientes (Task 6); pruebas de SQL, Zod y opciones (Tasks 2–5); documentación (Task 7).
- **Consistencia de tipos:** `Territorio`/`Seleccion`/`ItemTerritorio` se definen en Task 4 y se consumen en Task 6; `CatalogoCfg.padre` y `validarEntradaCatalogo` se definen y usan dentro de Task 5; `Territorio` de `scripts/territorio.ts` es otro tipo (datos de siembra) y no se importa fuera de scripts.
- **Desviaciones del spec registradas:** migración dividida en tres; ningún listado muestra los campos, así que no hay cambio de listados.
