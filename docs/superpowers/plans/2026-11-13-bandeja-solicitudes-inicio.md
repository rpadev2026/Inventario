# Bandeja de solicitudes en el Inicio — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En `/` (Resumen), listar las solicitudes no finalizadas de cada usuario como bandeja de entrada, con clic hacia `/solicitudes/<token>`.

**Architecture:** Una función pura (`armarBandeja`) clasifica, filtra por usuario, ordena y acota las filas; un servicio (`cargarBandeja`) hace la consulta a Supabase con filtros acotados; un componente de servidor presenta la lista y se monta en `app/(app)/page.tsx`. Sin migración.

**Tech Stack:** Next.js (App Router, server components), Supabase vía `db`, Vitest, clases de `app/tema.css`.

**Spec:** `docs/superpowers/specs/2026-11-13-bandeja-solicitudes-inicio-design.md`

## Global Constraints
- Estados (`app/(app)/solicitudes/estados.ts`): 0 Creada, 1 Enviada, 2 Aprobada, 3 Recepcionada, 4 Recepción parcial, 5 Rechazada. **No finalizadas = 0, 1, 2, 4.**
- Autorización por permiso: `solicitudes.gestionar` (ve las Enviadas/Aprobadas/Parciales de todos) y `solicitudes.ver_propias` / `solicitudes.crear` (solo las suyas). Nunca mostrar borradores ajenos.
- URLs con `"Token"` (uuid), nunca el id numérico; solo clases de `app/tema.css`, sin colores sueltos.
- Máximo 10 filas y enlace «Ver todas» a `/solicitudes`; vacío: «No tienes solicitudes pendientes».
- Sin migración. Se verifica con `npx tsc --noEmit`, `npx eslint .` y `npx vitest run`.

## Review Focus
1. Solicitante con filas ajenas en la entrada → el módulo puro las descarta igual (defensa en profundidad). Test en Task 1.
2. Quien gestiona NO ve borradores ajenos, pero sí los suyos. Test en Task 1.
3. Solicitud propia Enviada de quien gestiona → «En espera de aprobación», no «Por aprobar» (nadie aprueba la suya). Test en Task 1.
4. Más de 10 pendientes → se muestran 10, `total` informa la cantidad real. Test en Task 1.
5. Misma fecha en varias filas → orden estable por id descendente. Test en Task 1.

---

### Task 1: Clasificación pura de la bandeja

**Files:**
- Create: `lib/bandeja-solicitudes.ts`
- Test: `lib/bandeja-solicitudes.test.ts`

**Interfaces:**
- Produces: `type FilaSolicitud = { IdSolicitud: number; Token: string; NumeroSolicitud: number; FechaSolicitud: string; EstadoSolicitud: number; IdUsuarioSolicitante: number; NombreBodega: string; Solicitante: string }`
- Produces: `type Espera = "Por aprobar" | "Por recepcionar" | "Borrador" | "En espera de aprobación" | "En seguimiento"`
- Produces: `type ItemBandeja = FilaSolicitud & { espera: Espera; propia: boolean; requiereAccion: boolean }`
- Produces: `const ESTADOS_NO_FINALIZADOS: readonly number[]` = `[0, 1, 2, 4]`
- Produces: `function armarBandeja(filas: FilaSolicitud[], u: { uid: number; gestiona: boolean }, limite = 10): { items: ItemBandeja[]; total: number }`

- [ ] **Step 1: Escribir las pruebas (fallan)** en `lib/bandeja-solicitudes.test.ts`, con una fábrica `fila(id, estado, solicitante, fecha)`:
  - `descarta Recepcionada (3) y Rechazada (5)` → resultado vacío para un solicitante y para quien gestiona.
  - `solicitante: solo ve las suyas en 0,1,2,4, aunque le pasen ajenas` → ids ajenos ausentes; etiquetas: 0→«Borrador», 1→«En espera de aprobación», 2 y 4→«Por recepcionar».
  - `gestiona: ve Enviadas ajenas como «Por aprobar», Aprobadas/Parciales ajenas como «En seguimiento»`; `requiereAccion` verdadero solo en «Por aprobar» y «Por recepcionar».
  - `gestiona: no ve borradores ajenos pero sí los propios`.
  - `gestiona: su propia Enviada es «En espera de aprobación» (no «Por aprobar»)`.
  - `orden: primero requiereAccion, luego el resto; dentro de cada grupo, FechaSolicitud descendente y, a igual fecha, IdSolicitud descendente`.
  - `límite: con 12 pendientes devuelve 10 items y total = 12`.
  - `sin filas: items = [] y total = 0`.
- [ ] **Step 2: Ejecutar** `npx vitest run lib/bandeja-solicitudes.test.ts`. Esperado: FALLA (módulo inexistente).
- [ ] **Step 3: Implementar `armarBandeja` y exportar los tipos** en `lib/bandeja-solicitudes.ts`. Filtrar por estado y por usuario, derivar `espera`/`propia`/`requiereAccion`, ordenar con un comparador de dos claves y recortar al límite calculando `total` antes.
- [ ] **Step 4: Ejecutar** el mismo comando. Esperado: todas pasan.
- [ ] **Step 5: Commit** `git add lib/bandeja-solicitudes.ts lib/bandeja-solicitudes.test.ts && git commit -m "Bandeja de solicitudes: clasificación pura por usuario"`.

### Task 2: Carga desde Supabase

**Files:**
- Create: `lib/services/bandeja.ts`
- Test: `lib/services/bandeja.test.ts`

**Interfaces:**
- Consumes: `FilaSolicitud`, `armarBandeja`, `ESTADOS_NO_FINALIZADOS` (Task 1), `db` de `@/lib/db/supabase`.
- Produces: `function cargarBandeja(u: { uid: number; gestiona: boolean }): Promise<{ items: ItemBandeja[]; total: number }>` — lanza `Error("No se pudo cargar la bandeja de solicitudes")` si la consulta falla.

- [ ] **Step 1: Escribir las pruebas (fallan)** con `vi.mock("@/lib/db/supabase")` y un constructor de consultas falso que registra las llamadas:
  - `solicitante: filtra por IdUsuarioSolicitante = uid y EstadoSolicitud in [0,1,2,4]` (no usa `.or`).
  - `gestiona: usa un filtro .or que incluye estados 1,2,4 de todos y los borradores (0) solo con IdUsuarioSolicitante = uid`.
  - `la consulta está acotada: orden por IdSolicitud descendente y limit(200)`.
  - `mapea Bodegas.NombreBodega y Usuarios.Nombres/Apellidos a NombreBodega y Solicitante («Nombres Apellidos»)`.
  - `error de la base → lanza «No se pudo cargar la bandeja de solicitudes»`.
- [ ] **Step 2: Ejecutar** `npx vitest run lib/services/bandeja.test.ts`. Esperado: FALLA.
- [ ] **Step 3: Implementar `cargarBandeja`** con el select `IdSolicitud,Token,NumeroSolicitud,FechaSolicitud,EstadoSolicitud,IdUsuarioSolicitante,Bodegas!inner(NombreBodega),Usuarios!Solicitudes_IdUsuarioSolicitante_fkey!inner(Nombres,Apellidos)` (nombre de FK obligatorio por `CLAUDE.md`), aplicar el filtro según `gestiona`, mapear a `FilaSolicitud[]` y delegar en `armarBandeja`.
- [ ] **Step 4: Ejecutar** el mismo comando. Esperado: pasan.
- [ ] **Step 5: Commit** `git commit -m "Bandeja de solicitudes: carga acotada desde Supabase"`.

### Task 3: Componente e integración en el Inicio

**Files:**
- Create: `app/(app)/bandeja-solicitudes.tsx`
- Modify: `app/(app)/page.tsx` (montar bajo los contadores); `app/tema.css` (clases `.bandeja`)
- Test: `app/(app)/bandeja-solicitudes.test.tsx`

**Interfaces:**
- Consumes: `ItemBandeja` (Task 1), `cargarBandeja` (Task 2), `ESTADOS`/`ESTADO_TONO` de `app/(app)/solicitudes/estados.ts`, `Badge`.
- Produces: `function BandejaSolicitudes(props: { items: ItemBandeja[]; total: number; ahora?: Date }): JSX.Element` (presentacional, sin acceso a datos).

- [ ] **Step 1: Escribir las pruebas (fallan)** con `renderToStaticMarkup`:
  - `cada fila es un enlace a /solicitudes/<Token>` (nunca al id numérico) y muestra N°, bodega, solicitante («yo» si `propia`), insignia de estado y la etiqueta `espera`.
  - `las filas con requiereAccion se marcan (clase y punto «●» con texto accesible)`.
  - `vacío muestra «No tienes solicitudes pendientes» y no muestra «Ver todas»`.
  - `con total > items.length muestra «Ver todas (N)» apuntando a /solicitudes`.
  - `la antigüedad se expresa relativa («hace 2 h», «ayer», «hace 3 d») con el reloj inyectado`.
- [ ] **Step 2: Ejecutar** `npx vitest run "app/(app)/bandeja-solicitudes.test.tsx"`. Esperado: FALLA.
- [ ] **Step 3: Implementar `BandejaSolicitudes`** como lista `ul` de filas-enlace (toda la fila es clicable), apilada en celular; estilos `.bandeja*` en `app/tema.css` planos y con el sistema de variables existente. En `page.tsx`, llamar `cargarBandeja({ uid: s.uid, gestiona: bodeguero })` en el `Promise.all` existente (solo si el usuario tiene `solicitudes.ver_propias` o `solicitudes.gestionar`) y renderizar la bandeja bajo los contadores.
- [ ] **Step 4: Ejecutar** el test, `npx tsc --noEmit` y `npx eslint .`. Esperado: sin errores.
- [ ] **Step 5: Commit** `git commit -m "Inicio: bandeja de solicitudes no finalizadas"`.

### Task 4: Verificación en navegador y documentación

**Files:**
- Modify: `CLAUDE.md` (una frase en «Permisos y mantenedores» sobre la bandeja del Inicio).

- [ ] **Step 1:** Levantar la app en modo producción contra el Supabase falso del scratchpad ampliado con filas de `Solicitudes` en los estados 0–5 de dos usuarios; con Playwright comprobar a 1280 px y a 375 px: la bandeja muestra solo las no finalizadas del usuario, el orden esperado y que el clic llega a `/solicitudes/<token>`.
- [ ] **Step 2:** Ejecutar `npx vitest run` completo. Esperado: todo en verde.
- [ ] **Step 3: Commit y push** `git commit -m "Bandeja de solicitudes: documentación" && git push -u origin claude/magical-franklin-spr5dk`.
