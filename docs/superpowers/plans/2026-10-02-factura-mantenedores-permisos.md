# Factura, mantenedores y roles con permisos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar "Nueva factura", crear mantenedores (Formas de pago, Unidades de medida, Formatos, Roles con permisos) y pasar la autorización de nombres de rol a permisos.

**Architecture:** Dos migraciones nuevas (`0006` maestros + regla de fechas; `0007` permisos y RPC de roles). La autorización pasa a `requerirPermiso(...)` con permisos calculados desde `RolesPermisos` y revalidados en cada petición. Los tres catálogos idénticos comparten un servicio y una página genéricos.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`), React 19, Tailwind v4 (`app/tema.css`), Zod 4, Supabase (service_role), Vitest + PGlite.

**Spec:** `docs/superpowers/specs/2026-10-01-factura-formas-pago-roles-permisos-design.md`

**Nota de entorno:** el proyecto NO es un repositorio git: en lugar de "commit", cada tarea termina con un checkpoint `npm test` + `npx tsc --noEmit`. Antes de escribir código Next.js, consultar `node_modules/next/dist/docs/` (versión con cambios). Instalar dependencias con `--legacy-peer-deps`.

## Global Constraints

- UI en español; solo mensajes de negocio (`P0001`) al usuario, nunca errores crudos de la BD.
- Formas de pago, unidades y formatos se guardan **solo por código** (`Codigo`: `^[A-Z0-9_]{1,30}$`, único, inmutable); no se borran, solo se desactivan (`IdEstado` 0/1).
- Precio unitario: hasta **2 decimales**, sin flechas de incremento. Folio: solo enteros > 0, sin flechas.
- Fecha de recepción ≥ fecha de factura; mensaje exacto: `La fecha de recepción no puede ser anterior a la fecha de factura` (Zod y SQL).
- Mantenedores de usuarios, roles, formas de pago, unidades de medida y formatos: solo Administrador, no asignables por permiso. Administrador tiene todos los permisos implícitos.
- Cada server action valida con Zod y llama `requerirPermiso`/`requerirAdmin`; no confiar en ocultar botones.
- Estilos solo con clases de `app/tema.css` (`card`, `btn`, `input`, `table-wrap`, `field`...); formularios con `<Field label>`; grillas `form-grid-N` y `fld-N` (nunca `col-N`); controles de 44 px.
- Consultas anidadas hacia `Usuarios` indican el nombre de la FK.
- Rutas de mantenedores anidadas: `/mantenedores` (índice), `/mantenedores/formas-pago`, `/mantenedores/unidades-medida`, `/mantenedores/formatos`, `/mantenedores/roles` (la spec decía rutas raíz; se anidan para que el menú marque activo el único destino «Mantenedores»).

## Review Focus

1. Precio escrito como `1,5`, `1.234`, `1,555`, `""`, `-1`, `1e3`: coma o punto = decimal; más de 2 decimales, vacío, negativo y notación científica se rechazan (la UI no permite teclearlos).
2. Parámetro `volver` malicioso (`//evil.com`, `https://x`, `/\evil`, `javascript:`): nunca redirige fuera del sitio.
3. Permisos revocados o rol desactivado mientras el usuario tiene sesión abierta: la siguiente petición ya no concede el permiso.
4. Código de catálogo con minúsculas, espacios o duplicado (`contado` vs `CONTADO`): se normaliza a mayúsculas y se rechaza el duplicado con mensaje de negocio.
5. Borrador de factura en `sessionStorage` corrupto o con forma inesperada: se ignora y el formulario arranca vacío.

---

### Task 1: Migración 0006 — maestros, FK por código y regla de fechas

**Files:**
- Create: `supabase/migrations/0006_maestros.sql`
- Modify: `supabase/tests/db.test.ts`, `supabase/tests/cleanup.test.ts` (fixtures con códigos), `supabase/scripts/e2e-cleanup.sql` si inserta/borra productos con unidad o formato textual
- Test: `supabase/tests/db.test.ts`

**Interfaces:**
- Produces: tablas `FormasPago`, `UnidadesMedida`, `Formatos` (`Id…` identity, `Codigo text unique`, `Nombre text`, `IdEstado smallint`, columnas de auditoría `IdUsuarioCreacion/FechaRegistroCreacion/IdUsuarioModificacion/FechaRegistroModificacion`); `Compras.FormaPago`, `Productos.UnidadMedida`, `Productos.Formato` con FK a `…("Codigo")`; `registrar_factura` (misma firma) validando fechas y forma de pago vigente.

- [ ] **Step 1: Write failing tests** en `db.test.ts` (nuevo `describe("maestros y reglas de factura")`): fixtures existentes pasan a `'KG'`, `'BOLSA'`, `'L'`, `'BOTELLA'`, `'CONTADO'`. Tests:
  - `rechaza fecha de recepción anterior a la de factura` → `registrar_factura(...,'2026-10-02','2026-10-01',...)` falla con `/fecha de recepción/i`; misma fecha pasa.
  - `rechaza forma de pago inexistente` (`'NOPE'`) y `inactiva` (tras `update "FormasPago" set "IdEstado"=0 where "Codigo"='CONTADO'`, restaurar después), ambas `/forma de pago/i`.
  - `rechaza producto con unidad/formato inexistente` (`'Tonelada'`) por violación de FK.
  - `siembra formas, unidades y formatos iniciales`: 5 formas (`CONTADO, CREDITO_15, CREDITO_30, CREDITO_60, TRANSFERENCIA`), 5 unidades (`KG,G,L,ML,UN`), 10 formatos (`CAJA,BOLSA,PALLET,BIN,SACHET,BOTELLA,LATA,TARRO,MANGA,PACK`).
  - `código de catálogo solo acepta mayúsculas/dígitos/_`: insertar `'contado'` falla (CHECK).
- [ ] **Step 2: Run** `npx vitest run supabase/tests/db.test.ts` → los nuevos fallan.
- [ ] **Step 3: Escribir `0006_maestros.sql`**: (a) `truncate "Compras","Productos","Solicitudes" restart identity cascade;` y `alter sequence seq_numero_solicitud restart;` (datos de prueba, autorizado por el usuario); (b) crear las 3 tablas con RLS activo sin políticas (como el resto) y CHECK `"Codigo" ~ '^[A-Z0-9_]{1,30}$'`; (c) insertar datos iniciales (nombres = textos actuales: «Contado», «Crédito 15 días», «Crédito 30 días», «Crédito 60 días», «Transferencia»; «Kilo», «Gramos», «Litro», «Mililitro», «Unidad»; «Caja»…«Pack»); (d) `drop constraint if exists "Productos_UnidadMedida_check"`, `"Productos_Formato_check"`; agregar FK a las 3 columnas; (e) `create or replace function registrar_factura` copiando la versión de `0002_funciones.sql` y agregando, antes del insert de cabecera, las dos validaciones con los mensajes `La fecha de recepción no puede ser anterior a la fecha de factura` y `Forma de pago no existe o no vigente`; mantener `security definer set search_path = public` y los grants de `0005`.
- [ ] **Step 4: Run** `npm test` → todo pasa (incluye `cleanup.test.ts` con fixtures actualizados).
- [ ] **Step 5: Checkpoint** `npx tsc --noEmit` (aún pasará: `schemas.ts` sigue igual hasta la Tarea 5).

---

### Task 2: Migración 0007 — permisos de roles y RPC `guardar_rol`

**Files:**
- Create: `supabase/migrations/0007_permisos.sql`
- Test: `supabase/tests/db.test.ts` (nuevo `describe("roles y permisos")`)

**Interfaces:**
- Produces: `Roles."EsBase" boolean`; tabla `RolesPermisos("IdRol","Permiso", auditoría)` PK (`IdRol`,`Permiso`), CHECK `"Permiso" ~ '^[a-z_]+\.[a-z_]+$'`, RLS sin políticas; `guardar_rol(p_usuario bigint, p_id bigint, p_nombre text, p_detalle text, p_estado smallint, p_permisos text[]) returns bigint` (security definer, `search_path = public`, execute revocado a `public/anon/authenticated`; `p_id` null crea).

- [ ] **Step 1: Write failing tests**:
  - `roles base siembran permisos equivalentes`: Compras tiene exactamente `compras.ver, compras.registrar, compras.anular, proveedores.ver, proveedores.gestionar, productos.ver, productos.gestionar`; Bodeguero Central `solicitudes.ver_propias, solicitudes.gestionar, bodegas.ver, movimientos.ver`; Solicitante `solicitudes.ver_propias, solicitudes.crear, bodegas.ver`; Administrador sin filas (implícito); los 4 tienen `EsBase = true`.
  - `guardar_rol crea rol con permisos` y reemplaza permisos al editar.
  - `rechaza nombre duplicado sin distinguir mayúsculas` (`/Ya existe un rol/`).
  - `rechaza renombrar o desactivar un rol base` (`/roles base/`).
  - `rechaza desactivar un rol con usuarios activos` (`/usuarios activos/`); sin usuarios sí permite.
  - `no modifica permisos del rol Administrador` (llamar con `p_permisos` no vacío: sigue sin filas).
- [ ] **Step 2: Run** `npx vitest run supabase/tests/db.test.ts -t "roles y permisos"` → FAIL.
- [ ] **Step 3: Escribir `0007_permisos.sql`** con columna `EsBase` (true para los 4 roles del seed), tabla, siembra con `insert … select` por `NombreRol`, y `guardar_rol`: lock del rol con `for update`; nombre `trim` 1–60; unicidad `lower("NombreRol")`; reglas de roles base (mensajes `Los roles base no se pueden renombrar`, `Los roles base no se pueden desactivar`), `No se puede desactivar un rol con usuarios activos`; reemplazo de permisos (delete + insert) omitido para el rol `Administrador`; auditoría con `p_usuario`. Todos con `raise exception` (P0001).
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Revisar `app/(app)/usuarios/actions.ts` (líneas ~41-75)**: confirmar que quitar rol/desactivar usuario no deja al sistema sin Administrador activo; si no existe la protección, agregarla con test (`db.test.ts` o prueba de la acción) y mensaje `Debe existir al menos un administrador activo`.
- [ ] **Step 6: Checkpoint** `npm test` + `npx tsc --noEmit`.

---

### Task 3: Catálogo de permisos y sesión con permisos

**Files:**
- Create: `lib/auth/permisos.ts`, `lib/auth/permisos.test.ts`
- Modify: `lib/auth/session.ts`, `lib/auth/login.ts` (solo si usa `Sesion`)

**Interfaces:**
- Produces en `lib/auth/permisos.ts`:
  - `PERMISOS: readonly { codigo: Permiso; modulo: string; descripcion: string }[]` — los 12 códigos de la spec: `compras.ver|registrar|anular`, `proveedores.ver|gestionar`, `productos.ver|gestionar`, `bodegas.ver`, `solicitudes.ver_propias|crear|gestionar`, `movimientos.ver`.
  - `type Permiso`; `CODIGOS_PERMISO: readonly [Permiso, ...Permiso[]]` (usable en `z.enum`).
  - `permisosEfectivos(roles: string[], porRol: Record<string, string[]>): Permiso[]` — si `roles` incluye `"Administrador"` devuelve todos; si no, la unión (sin duplicados) de `porRol[rol]`, descartando códigos fuera del catálogo.
  - `tienePermiso(permisos: readonly string[], ...requeridos: Permiso[]): boolean` — verdadero si tiene **alguno**; sin requeridos → true.
- Produces en `session.ts`: `Sesion = { uid; roles: string[]; permisos: Permiso[]; cambiar: boolean }`; `requerirPermiso(...p: Permiso[]): Promise<Sesion>` (lanza `No autenticado` / `Debe cambiar su clave` / `No autorizado`); `requerirPaginaPermiso(...p: Permiso[]): Promise<Sesion>` (redirige a `/login`, `/cambiar-clave` o `/?acceso=denegado`); `requerirAdmin()` y `requerirPaginaAdmin()` (solo rol `Administrador`); `esAdmin(s: Sesion): boolean`.

- [ ] **Step 1: Write failing tests** (`permisos.test.ts`): `permisosEfectivos(["Administrador"], {})` devuelve los 12; `(["Compras"], {Compras:["compras.ver"]})` → `["compras.ver"]`; dos roles se unen sin duplicados; un código desconocido (`"x.y"`) se descarta; `([], {})` → `[]`; `tienePermiso(["compras.ver"], "compras.ver", "productos.ver")` true y `tienePermiso([], "compras.ver")` false. (Review Focus 3: la revocación se prueba aquí porque `permisosEfectivos` se recalcula en cada `leerSesion`; ver paso 4.)
- [ ] **Step 2: Run** `npx vitest run lib/auth/permisos.test.ts` → FAIL.
- [ ] **Step 3: Implement** `lib/auth/permisos.ts` según Interfaces.
- [ ] **Step 4: Modify `leerSesion()`** (`session.ts`): además de roles vigentes, leer `RolesPermisos` de los `IdRol` vigentes del usuario (consulta dentro del mismo `Promise.all`/segunda consulta, filtrando `Roles.IdEstado = 1` y `UsuariosRoles.IdEstado = 1`) y calcular `permisos` con `permisosEfectivos`. El JWT sigue sin llevar permisos (se leen siempre de la BD). Implementar las funciones de `requerir…` listadas; **mantener temporalmente** `requerirRol`/`requerirPagina` hasta la Tarea 4.
- [ ] **Step 5: Checkpoint** `npm test` + `npx tsc --noEmit`.

---

### Task 4: Migrar todas las páginas, acciones, menú y correo a permisos

**Files (modify):** `app/(app)/compras/{page.tsx,actions.ts,nueva/page.tsx}`, `proveedores/{page.tsx,actions.ts,[id]/page.tsx}`, `productos/{page.tsx,actions.ts}`, `bodegas/{page.tsx,actions.ts}`, `solicitudes/{page.tsx,actions.ts,nueva/page.tsx,[id]/page.tsx}`, `movimientos/page.tsx`, `usuarios/{page.tsx,actions.ts}`, `page.tsx` (inicio), `layout.tsx`, `lib/services/correo.ts`, `lib/auth/session.ts` (retirar `requerirRol`/`requerirPagina`).

**Interfaces:** Consume `requerirPermiso`, `requerirPaginaPermiso`, `requerirAdmin`, `requerirPaginaAdmin`, `tienePermiso`, `esAdmin` (Tarea 3). Produce `MENU` con `permisos` en lugar de `roles`.

- [ ] **Step 1: Aplicar la tabla de equivalencias** (acción/página → llamada nueva):

| Hoy | Nuevo |
|---|---|
| compras `page` / `nueva/page` / `registrarFactura` / `anularFactura` | `compras.ver` / `compras.registrar` / `compras.registrar` / `compras.anular` |
| proveedores `page`, `[id]/page` / acciones | `proveedores.ver` / `proveedores.gestionar` |
| productos `page` / `guardarProducto` | `productos.ver` / `productos.gestionar` |
| bodegas `page` (ver) / crear bodega | `bodegas.ver` / `requerirAdmin()` |
| solicitudes `page`, `[id]/page` | `requerirPaginaPermiso("solicitudes.ver_propias","solicitudes.gestionar")` |
| solicitudes `nueva/page`; crear, editar, enviar | `solicitudes.crear` |
| solicitudes recepcionar | `solicitudes.ver_propias` |
| solicitudes aprobar, rechazar | `solicitudes.gestionar` |
| movimientos `page` | `movimientos.ver` |
| usuarios (todas) | `requerirPaginaAdmin()` / `requerirAdmin()` |

  En `solicitudes/page.tsx`, `[id]/page.tsx` y `page.tsx` (inicio) reemplazar `roles.includes(...)`: «ve todas / es bodeguero» = `tienePermiso(s.permisos,"solicitudes.gestionar")`; «puede crear / es solicitante» = `tienePermiso(s.permisos,"solicitudes.crear")`. Mantener intactas las reglas «nadie aprueba su propia solicitud» y «solo el solicitante edita/envía/recepciona la suya».
- [ ] **Step 2: `layout.tsx`**: `MENU` pasa a `{...MenuItem, permisos: Permiso[] | "admin" | null}`; `null` siempre visible (Inicio); `"admin"` solo si `esAdmin(s)`; lista de permisos → `tienePermiso`. Items: Inicio; Compras (`compras.ver`); Proveedores (`proveedores.ver`); Productos (`productos.ver`); Solicitudes (`solicitudes.ver_propias`,`solicitudes.gestionar`); Bodegas (`bodegas.ver`); Movimientos (`movimientos.ver`); Usuarios (`"admin"`); Mantenedores `/mantenedores` icono `settings` (`"admin"`). Agregar el icono `settings` a `components/app/icon.tsx` (engranaje de trazo, mismo estilo).
- [ ] **Step 3: `lib/services/correo.ts`**: los destinatarios del aviso al enviar una solicitud pasan de «rol Bodeguero Central» a «usuarios vigentes con rol vigente que tenga `solicitudes.gestionar` en `RolesPermisos`, más los de rol `Administrador`»; respetar la FK explícita `Usuarios!UsuariosRoles_IdUsuario_fkey`.
- [ ] **Step 4: Retirar** `requerirRol` y `requerirPagina` de `session.ts`; `Grep` de `requerirRol|requerirPagina|roles.includes` en `app lib components` debe devolver 0 resultados (excepto `esAdmin`/`permisosEfectivos`).
- [ ] **Step 5: Verificar** `npm test`, `npx tsc --noEmit`, `npx next build`. Con el servidor local, entrar como Administrador y confirmar que el menú y las pantallas existentes siguen funcionando (comportamiento sin cambios).

---

### Task 5: Esquemas Zod — folio, precio, fechas, códigos de catálogo

**Files:**
- Create: `lib/validation/catalogo.ts`, `lib/numeros.ts`, `lib/numeros.test.ts`
- Modify: `lib/validation/schemas.ts`, `lib/validation/schemas.test.ts`

**Interfaces:**
- Produces `lib/validation/catalogo.ts`: `codigoCatalogo: ZodType<string>` (trim + mayúsculas + `^[A-Z0-9_]{1,30}$`, mensaje `Código: solo letras, números y _ (máx. 30)`); `catalogoSchema = z.object({ codigo: codigoCatalogo, nombre: trim 1–80 «Nombre requerido», estado })`.
- Produces `lib/numeros.ts`: `soloDigitos(s: string): string`; `filtrarDecimal2(s: string): string` (conserva dígitos y como mucho un separador `,` o `.` con ≤2 decimales, para usar al teclear); `parseDecimal2(s: string): number | null` (`null` si no cumple `^\d+([.,]\d{1,2})?$`; coma → punto).
- Modifica `schemas.ts`: elimina `UNIDADES`, `FORMATOS`, `FORMAS_PAGO`; `productoSchema.unidad` y `.formato` pasan a `codigoCatalogo`; `facturaSchema.formaPago` → `codigoCatalogo`; `folio` → texto `^[1-9]\d{0,14}$` (mensaje `Folio: solo números enteros`) convertido a número; `detalle[].precio` acepta número o texto con ≤2 decimales (usar `parseDecimal2`), mensaje `Precio: máximo 2 decimales`; nueva regla `.refine` con path `["fechaRecepcion"]` y el mensaje exacto de Global Constraints.

- [ ] **Step 1: Write failing tests** — `numeros.test.ts`: `parseDecimal2("1,5")===1.5`, `("1.25")===1.25`, `("1,555")===null`, `("")===null`, `("-1")===null`, `("1e3")===null`, `("1.234")===null` (3 decimales, no miles); `filtrarDecimal2("12a,3456")==="12,34"`, `("1.2.3")==="1.2"`; `soloDigitos("1a2-3")==="123"`. `schemas.test.ts`: factura con recepción < factura falla con el mensaje exacto; misma fecha pasa; folio `"12a"`, `"0"`, `"007"`, `"1234567890123456"` fallan; precio `"10,50"` pasa y `"10,555"` falla; `formaPago: "contado"` se normaliza a `CONTADO`; producto con `unidad: "kg"` → `KG`, `"Tonelada x"` falla; `catalogoSchema` rechaza código con espacios.
- [ ] **Step 2: Run** `npx vitest run lib` → FAIL.
- [ ] **Step 3: Implement** los módulos según Interfaces y actualizar los usos de `UNIDADES/FORMATOS/FORMAS_PAGO` solo en `schemas.test.ts` (las pantallas se actualizan en Tareas 6–9; hasta entonces `tsc` fallará en esas pantallas — es esperado dentro de este bloque).
- [ ] **Step 4: Run** `npx vitest run lib` → PASS.

---

### Task 6: Mantenedores de catálogo (Formas de pago, Unidades de medida, Formatos) y página índice

**Files:**
- Create: `lib/services/catalogo.ts`, `components/app/catalogo-admin.tsx` (página servidor + formulario cliente), `app/(app)/mantenedores/page.tsx`, `app/(app)/mantenedores/{formas-pago,unidades-medida,formatos}/page.tsx` y `actions.ts` (cada carpeta)
- Modify: `components/app/icon.tsx` (si falta algún icono usado)
- Test: `lib/services/catalogo.test.ts`

**Interfaces:**
- Produces `lib/services/catalogo.ts`: `type CatalogoCfg = { tabla: "FormasPago" | "UnidadesMedida" | "Formatos"; id: "IdFormaPago" | "IdUnidadMedida" | "IdFormato"; titulo: string; ruta: string }`; `export const CATALOGOS: Record<"formasPago"|"unidades"|"formatos", CatalogoCfg>`; `guardarCatalogo(cfg: CatalogoCfg, uid: number, fd: FormData): Promise<{ error?: string; ok?: boolean }>` — valida con `catalogoSchema`; crear (insert) o editar (`modo=editar`: actualiza solo `Nombre` y `IdEstado`, ignora cambios de `Codigo`); `23505` → `Ya existe un registro con ese código`; otros errores → `No se pudo guardar`; `revalidatePath(cfg.ruta)`.
- Cada `actions.ts` exporta `guardarFormaPago | guardarUnidad | guardarFormato(_: unknown, fd: FormData)` que llaman `requerirAdmin()` y luego `guardarCatalogo`.
- `components/app/catalogo-admin.tsx` exporta `PaginaCatalogo({ cfg, accion })` (server: `requerirPaginaAdmin()`, lista con `table-wrap`+`table`, `Badge` de estado, formulario de alta) y `FormCatalogo({ item?, accion })` (client, `useAccion`; `Código` de solo lectura al editar; `Field` con etiquetas visibles).
- `/mantenedores` (server, `requerirPaginaAdmin()`): tarjetas con enlaces a los 4 mantenedores y breve descripción.

- [ ] **Step 1: Write failing test** (`catalogo.test.ts`, con `db` simulado o contra funciones puras de normalización): `guardarCatalogo` con código `"contado"` guarda `CONTADO`; editar con otro `codigo` no lo cambia; duplicado devuelve `Ya existe un registro con ese código`. (Si mockear `db` resulta incómodo, extraer la normalización a una función pura `prepararFila(cfg, d, uid, editando)` y testear esa.)
- [ ] **Step 2: Run** `npx vitest run lib/services/catalogo.test.ts` → FAIL.
- [ ] **Step 3: Implement** servicio, componentes, páginas y acciones según Interfaces.
- [ ] **Step 4: Run** test → PASS; `npx tsc --noEmit` solo debe fallar por pantallas pendientes (productos/factura).
- [ ] **Step 5: Verificación en navegador** (Browser pane): como Administrador crear «Efectivo» (`EFECTIVO`), editar su nombre, desactivarlo, intentar crear `efectivo` otra vez (rechazado); un usuario no administrador es redirigido a `/?acceso=denegado`.

---

### Task 7: Mantenedor de Roles con permisos

**Files:**
- Create: `app/(app)/mantenedores/roles/{page.tsx,actions.ts,form-rol.tsx}`
- Modify: `lib/validation/schemas.ts` (agregar `rolSchema`), `lib/validation/schemas.test.ts`
- Test: `lib/validation/schemas.test.ts`

**Interfaces:**
- Produces `rolSchema = z.object({ id: opcional entero positivo, nombre: trim 1–60, detalle: opcional ≤200 → null, estado, permisos: z.array(z.enum(CODIGOS_PERMISO)).default([]) })`.
- Produces `guardarRol(_: unknown, fd: FormData): Promise<{ error?: string; ok?: boolean }>` en `actions.ts`: `requerirAdmin()`; parsea con `permisos = fd.getAll("permisos")`; llama `db.rpc("guardar_rol", { p_usuario, p_id, p_nombre, p_detalle, p_estado, p_permisos })`; `P0001` → `error.message`, `23505` → `Ya existe un rol con ese nombre`; `revalidatePath("/mantenedores/roles")` y `/usuarios`.
- `form-rol.tsx` (client, `useAccion`): nombre, detalle, estado, y matriz de casillas agrupadas por `modulo` desde `PERMISOS` (con `descripcion`); para roles base: nombre y estado deshabilitados con nota; para `Administrador`: sin matriz, nota «Tiene todos los permisos».
- `page.tsx` (`requerirPaginaAdmin()`): lista de roles con cantidad de usuarios activos y de permisos, y un `<details>` por rol para editar; formulario de alta.

- [ ] **Step 1: Write failing tests** de `rolSchema`: permiso fuera del catálogo (`"compras.borrar"`) falla; permisos vacíos aceptados; `nombre` vacío falla.
- [ ] **Step 2: Run** `npx vitest run lib/validation` → FAIL.
- [ ] **Step 3: Implement** esquema, acción, formulario y página.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Verificación en navegador** (Review Focus 3, extremo a extremo): crear rol «Consulta» con solo `compras.ver`; asignarlo en `/usuarios` a un usuario de prueba; iniciar sesión con ese usuario: ve Compras (lista) pero no «Nueva factura» (redirige a `/?acceso=denegado`) ni otros módulos; con el usuario ya conectado, quitar el permiso desde el Administrador y recargar: ya no accede. Renombrar/desactivar un rol base muestra el mensaje de negocio.

---

### Task 8: Productos con catálogos de unidad y formato

**Files (modify):** `app/(app)/productos/{page.tsx,form.tsx,actions.ts}`; cualquier pantalla que muestre `UnidadMedida`/`Formato` (buscar con `Grep` `UnidadMedida|Formato` en `app components lib`).

**Interfaces:** Consume `catalogoSchema` no; consume `productoSchema` (códigos) de la Tarea 5. `FormProducto` recibe `unidades: {Codigo: string; Nombre: string; IdEstado: number}[]`, `formatos: (igual)`, y pierde `onDone`; gana `volver?: string` (ver Tarea 10).

- [ ] **Step 1: Página** carga `UnidadesMedida` y `Formatos` (todas) y las pasa al formulario; el desplegable muestra solo vigentes **más** la opción actual del producto si está inactiva (marcada «(no vigente)»); la tabla muestra el `Nombre` resuelto por código.
- [ ] **Step 2: `guardarProducto`**: guarda códigos; antes de escribir verifica que unidad y formato existan y estén vigentes (excepto si no cambian al editar) y devuelve `Unidad de medida no válida` / `Formato no válido`; `23503` (FK) → mismo mensaje de negocio.
- [ ] **Step 3: Resolver nombres** en las demás pantallas que muestran unidad/formato (solicitudes, bodegas, movimientos si aplica) con un mapa `codigo → Nombre`.
- [ ] **Step 4: Verificar** `npm test`, `npx tsc --noEmit` (ahora sin errores de unidades/formatos), y crear un producto con unidad y formato nuevos creados en los mantenedores.

---

### Task 9: Componente de autocompletado y utilidades de borrador y `volver`

**Files:**
- Create: `lib/buscar.ts`, `lib/buscar.test.ts`, `lib/volver.ts`, `lib/volver.test.ts`, `lib/borrador-factura.ts`, `lib/borrador-factura.test.ts`, `components/app/combobox.tsx`

**Interfaces:**
- Produces `lib/buscar.ts`: `type Opcion = { valor: string; etiqueta: string; busqueda: string }`; `normalizar(s: string): string` (minúsculas, sin tildes, sin puntos, guiones ni espacios dobles); `filtrarOpciones(opciones: Opcion[], texto: string, max = 8): Opcion[]` (coincidencia por subcadena sobre `normalizar(busqueda)`; texto vacío → primeras `max`).
- Produces `lib/volver.ts`: `rutaVolverSegura(v: string | null | undefined): string | null` — devuelve `v` solo si empieza con `/`, no con `//` ni `/\`, no contiene `:` ni caracteres de control; si no, `null`.
- Produces `lib/borrador-factura.ts`: `type Borrador = { idProv: string; folio: string; fechaFactura: string; fechaRecepcion: string; formaPago: string; lineas: { codigo: string; precio: string; cantidad: string }[] }`; `guardarBorrador(b: Borrador): void`, `leerBorrador(): Borrador | null` (try/catch; valida forma y tipos; ante JSON inválido o forma inesperada → `null`), `limpiarBorrador(): void` (clave `sessionStorage` `borrador-factura`; todo envuelto en try/catch).
- Produces `components/app/combobox.tsx`: `Combobox({ label, opciones, valor, onCambio, required, placeholder, hint })` — patrón ARIA combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, lista `role="listbox"`), teclado (↑ ↓ Enter Esc), filtra con `filtrarOpciones`, muestra el texto de la opción elegida, `required` bloquea el envío si no hay selección; estilos solo con clases de `tema.css` (agregar `combo-list`/`combo-option` a `app/tema.css` con variables existentes).

- [ ] **Step 1: Write failing tests**: `filtrarOpciones` encuentra por RUT sin puntos (`"76086428"` ↔ `76.086.428-5`), por nombre sin tildes/mayúsculas (`"distribuidora"`), por código de producto y por texto, respeta `max`; `rutaVolverSegura("/compras/nueva")` devuelve la misma ruta y `"//evil.com"`, `"https://x"`, `"/\\evil"`, `"javascript:alert(1)"`, `""`, `null` devuelven `null` (Review Focus 2); `leerBorrador` con `sessionStorage` simulado devuelve `null` para `"{"`, `"[]"`, `'{"idProv":5}'` y el objeto correcto para un borrador válido (Review Focus 5).
- [ ] **Step 2: Run** `npx vitest run lib` → FAIL (si hace falta, configurar el entorno `jsdom` solo para `borrador-factura.test.ts` con un stub manual de `sessionStorage`; no agregar dependencias).
- [ ] **Step 3: Implement** utilidades y componente según Interfaces.
- [ ] **Step 4: Run** `npm test` → PASS.

---

### Task 10: Nueva factura — formulario nuevo y flujo sin modales

**Files (modify):** `app/(app)/compras/nueva/{page.tsx,form-factura.tsx}`, `app/(app)/proveedores/{page.tsx,forms.tsx}`, `app/(app)/productos/{page.tsx,form.tsx}` (parámetro `volver`); `app/tema.css` (solo si falta alguna clase).

**Interfaces:**
- `compras/nueva/page.tsx`: `requerirPaginaPermiso("compras.registrar")`; lee `searchParams` `proveedor` e `producto`; carga proveedores (`IdProveedor, Rut, RazonSocial`, vigentes), productos vigentes (`CodigoProducto, NombreProducto`) y `FormasPago` vigentes (`Codigo, Nombre`); pasa `preProveedor?: string` y `preProducto?: string` a `FormFactura`.
- `FormFactura(props: { proveedores: {id:number; rut:string; nombre:string}[]; productos: {codigo:string; nombre:string}[]; formasPago: {codigo:string; nombre:string}[]; preProveedor?: string; preProducto?: string })`: sin modales ni `FormProveedor`/`FormProducto`.
- `FormProveedor` pierde `rapido` y `onDone`; gana `volver?: string`; `FormProducto` igual (`volver`). Tras crear con éxito, si `rutaVolverSegura(volver)` no es `null`: `router.push(`${ruta}?proveedor=${id}`)` o `?producto=${codigo}`. Las páginas `/proveedores` y `/productos` leen `searchParams.volver` y muestran un enlace «← Volver a la factura» cuando es seguro.

- [ ] **Step 1: Reescribir `FormFactura`**:
  - Proveedor: `Combobox` con opciones `{valor: id, etiqueta: "RUT — Razón social", busqueda: "rut razón social"}`.
  - Producto por línea: `Combobox` con `{valor: codigo, etiqueta: "COD — Nombre", busqueda: "codigo nombre"}`.
  - Folio: `input type="text" inputMode="numeric"` con `soloDigitos` al teclear; sin `type="number"`.
  - Precio unitario: `input type="text" inputMode="decimal"` con `filtrarDecimal2`; cantidad conserva decimales de 3 (también `type="text"` sin flechas, con filtro análogo).
  - Fecha de recepción: `min={fechaFactura}`; si recepción < factura, mensaje en línea bajo el campo y se bloquea el envío; al cambiar la fecha de factura, si queda mayor que la recepción se limpia la recepción.
  - Forma de pago: `<select>` con `formasPago` (vigentes), requerido, sin opción por defecto vacía engañosa (primera opción vacía «Seleccione…»).
  - Enlaces «+ Crear proveedor nuevo» → `/proveedores?volver=/compras/nueva` y «+ Crear producto nuevo» → `/productos?volver=/compras/nueva`; antes de navegar, `guardarBorrador(...)` con el estado actual (usar `<Link onClick>`).
  - Al montar: `leerBorrador()`; si existe, restaurar estado y `limpiarBorrador()`; luego aplicar `preProveedor` / `preProducto` (este último en la primera línea sin producto, o nueva línea).
  - Al registrar con éxito: `limpiarBorrador()` y `router.push("/compras")`.
  - El envío usa los valores de estado (precio/cantidad como texto; `parseDecimal2` para calcular el neto) y llama `registrarFactura`.
- [ ] **Step 2: `compras/page.tsx`**: mostrar `Nombre` de la forma de pago (mapa código → nombre desde `FormasPago`).
- [ ] **Step 3: Eliminar** el CSS de modal solo si deja de usarse (`modal-backdrop`, `modal-panel`) tras `Grep`.
- [ ] **Step 4: Verificar** `npm test`, `npx tsc --noEmit`, `npx next build`.
- [ ] **Step 5: Verificación en navegador** (desktop 1280 px y móvil 375 px, claro y oscuro): (a) buscar proveedor por RUT y por nombre y producto por código y por texto; (b) folio y precio no aceptan letras ni flechas; precio acepta `10,50` y no un tercer decimal; (c) fecha de recepción anterior queda bloqueada con mensaje; (d) «+ Crear proveedor nuevo» → crear → vuelve a la factura con borrador restaurado y proveedor seleccionado; igual con producto; (e) `/proveedores?volver=//evil.com` no muestra el enlace de regreso; (f) registrar una factura completa con forma de pago del mantenedor y ver la lista en `/compras`.

---

### Task 11: Aplicar en Supabase, documentación y limpieza

**Files (modify):** `CLAUDE.md`, `README.md`, `scripts/e2e-setup.ts` (si crea roles/productos con textos antiguos), `supabase/scripts/e2e-cleanup.sql` (incluir datos de prueba nuevos si aplica)

- [ ] **Step 1: Pre-chequeo en Supabase** (proyecto `labbbzggeuivpzkvsmvq`) con `execute_sql`: contar filas de `Compras`, `Productos`, `Solicitudes`, `Usuarios`; confirmar que solo hay datos de prueba (la migración 0006 vacía Compras, Productos y Solicitudes; el usuario ya autorizó borrar datos de prueba). Si hay filas inesperadas, parar y avisar.
- [ ] **Step 2: Aplicar** `0006_maestros` y luego `0007_permisos` con `apply_migration`; verificar con `execute_sql` los conteos de siembra y con `get_advisors` (security) que las tablas nuevas tienen RLS y que no hay avisos nuevos.
- [ ] **Step 3: Recorrido completo** con `npm run dev` apuntando a Supabase: Administrador crea unidad/formato/forma de pago, producto, proveedor, factura, solicitud → aprobación → recepción (flujo existente intacto) y el rol de prueba de la Tarea 7. Limpiar los datos de prueba creados.
- [ ] **Step 4: Actualizar `CLAUDE.md`**: arquitectura de permisos (`requerirPermiso`, catálogo en `lib/auth/permisos.ts`, solo-Administrador), migraciones `0001`…`0007`, mantenedores y rutas, regla «códigos de catálogo, no textos», reglas de folio/precio/fechas, y quitar «Roles: …» como mecanismo de autorización; actualizar `README.md` (orden de migraciones).
- [ ] **Step 5: Verificación final**: `npm test`, `npx tsc --noEmit`, `npx next build` sin errores; reportar resultados reales.
