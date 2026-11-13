# Aprobación parcial y cierre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Native). Steps use checkbox syntax.

**Goal:** Aprobación parcial con motivo → re-aprobación o cierre por el Administrador → cierre automático a los 7 días, con avisos push y correo.

**Architecture:** Migración 0049 (estados 6 y 7, columnas, funciones SQL), ajustes en estados/validación/bandeja, acciones y pantallas, servicio de cierre por caducidad con ruta para cron y respaldo en el Inicio.

**Tech Stack:** Next.js, Supabase/PGlite tests, Vitest, `web-push`, Resend.

**Spec:** `docs/superpowers/specs/2026-11-13-aprobacion-parcial-cierre-design.md`

## Global Constraints
- UI en español, «usted»; clases de `tema.css`; etiqueta visible en formularios; errores solo de negocio (P0001).
- `lib/db/tipos.ts` a mano (Supabase MCP caído); funciones nuevas: `revoke ... from public, anon, authenticated` y `grant execute ... to app_servidor` (patrón de `0047`/`0048`).
- Motivos: texto recortado (incluye tabulaciones/saltos), 1 a 100 caracteres, validado en Zod y en SQL.
- Un fallo de push/correo nunca revierte la operación (`after()`).
- Estados: 6 = Aprobada parcialmente, 7 = Cerrada.

## Review Focus
1. Aprobar con una cantidad menor a la pedida (o un producto sin informar) por `aprobar_solicitud` falla; por la vía parcial exige motivo; con todo igual a lo pedido, la vía parcial falla («use Aprobar»).
2. Solo el rol Administrador re-aprueba y cierra (también en SQL); nadie re-aprueba la suya; solo desde estado 6; al re-aprobar se revalida el stock.
3. El solicitante y quien gestiona sin rol Administrador no tienen ningún botón de acción en estado 6 (UI) ni pueden actuar (acción/SQL).
4. Cierre automático: exactamente a los 7 días (6 d 23 h no, 7 d 1 min sí), solo estado 6, una sola vez aunque corran el cron y el Inicio a la vez, motivo «Cierre por caducidad de días», historial y avisos a participantes sin duplicar correos.
5. Rechazadas, Recepcionadas y demás flujos anteriores no cambian (aprobar total, rechazar, recepcionar, bandeja).

### Task 1: Migración 0049 y tipos
**Files:** Create `supabase/migrations/0049_aprobacion_parcial_cierre.sql`, `supabase/tests/aprobacion-parcial.test.ts`; Modify `supabase/tests/db.test.ts` (el test «aprueba con cantidad menor…» pasa por parcial + re-aprobación), `supabase/tests/cleanup.test.ts` si falla, `lib/db/tipos.ts`.
**Interfaces — Produces (SQL):** columnas `"Solicitudes"."MotivoParcial" text`, `"MotivoCierre" text`, `"FechaCierre" timestamptz`, `"IdUsuarioCierre" bigint null` (checks 1–100 en ambos motivos); checks de estado `between 0 and 7` (Solicitudes e Historial); `aprobar_parcial_solicitud(p_usuario bigint, p_solicitud bigint, p_items jsonb, p_motivo text) returns void`; `reaprobar_solicitud(p_usuario bigint, p_solicitud bigint) returns void`; `cerrar_solicitud(p_usuario bigint, p_solicitud bigint, p_motivo text) returns void`; `cerrar_solicitudes_caducadas() returns table("IdSolicitud" bigint, "Token" uuid, "NumeroSolicitud" bigint)`; `participantes_solicitud(p_solicitud bigint) returns table("IdUsuario" bigint, "Correo" text)`; `aprobar_solicitud` (misma firma) rechaza si alguna cantidad aprobada < pedida (mensaje «Hay cantidades menores a las pedidas: apruebe parcialmente indicando el motivo»). Lógica de validación compartida en una función interna `aplicar_aprobacion(p_usuario, p_solicitud, p_items) returns boolean` (true = parcial; revalida stock, ≤ pedido, al menos un producto > 0; no cambia el estado).
- [ ] Tests (PGlite; solicitudes insertadas directo como en `rechazo.test.ts`, con detalle y stock en la Bodega Central): los 5 puntos de Review Focus que tocan SQL (parcial vía `aprobar_solicitud` falla; parcial con/sin motivo, motivo 100/101/solo espacios/tab; sin cambios por la vía parcial falla; estado 6 + `FechaAprobacion`; re-aprobar solo Administrador, no la propia, solo desde 6, revalida stock; cerrar solo Administrador, motivo obligatorio, solo desde 6, guarda `IdUsuarioCierre` y fecha; caducadas: 6 d 23 h no / 7 d 1 min sí, solo estado 6, devuelve las cerradas, segunda llamada devuelve vacío, historial con `IdUsuarioCreacion` null; participantes: solicitante + usuarios del historial + Administradores vigentes, sin duplicados ni inactivos; grants).
- [ ] FAIL → migración → PASS; tipos; `npx vitest run supabase`. Commit.

### Task 2: Estados, validación y bandeja
**Files:** Modify `app/(app)/solicitudes/estados.ts`, `lib/validation/motivo-rechazo.ts` (exporta además `motivoSchema(mensaje)`; `motivoRechazoSchema` queda igual), `lib/bandeja-solicitudes.ts`, `lib/services/bandeja.ts`, `app/(app)/bandeja-solicitudes.tsx`, `app/(app)/page.tsx` y sus tests; Create `lib/aprobacion-parcial.ts` + test.
**Interfaces:** `ESTADOS[6]="Aprobada parcialmente"`, `ESTADOS[7]="Cerrada"`, tonos `6:"warn"`, `7:"neutral"`; `export const MSG_MOTIVO_PARCIAL` y `MSG_MOTIVO_CIERRE` («Indique el motivo de la aprobación parcial|del cierre (máximo 100 caracteres)»); `FilaSolicitud.MotivoRechazo` pasa a `Motivo: string | null` (rechazo en 5, parcial en 6); `ESTADOS_NO_FINALIZADOS = [0,1,2,4,6]`; `armarBandeja(filas, u: {uid; gestiona; admin}, limite, ahora)`; `cargarBandeja(u: {uid; gestiona; admin}, ahora)`; `Espera` sin cambios (estado 6: propia → «En espera de aprobación»; Administrador ajena → «Por aprobar» con `requiereAccion`; gestor no Administrador ajena → «En seguimiento»; solicitante ajena no la ve); `export function hayCambioDeCantidades(items: {producto: number; solicitada: number}[], vals: Record<string, string>): boolean` (compara con lo SOLICITADO, vacío = 0).
- [ ] Tests: estados; esquemas de motivo (mensajes distintos); bandeja pura (estado 6 por tipo de usuario, no se confunde con rechazada, el motivo se muestra); servicio (las consultas del solicitante y del gestor incluyen el 6 y piden `MotivoParcial`); vista (fila 6 con «Motivo: …»); `hayCambioDeCantidades`.
- [ ] FAIL → implementar → PASS; suite + tsc + eslint. Commit.

### Task 3: Acciones y pantallas
**Files:** Modify `app/(app)/solicitudes/actions.ts`, `app/(app)/solicitudes/paneles.tsx`, `app/(app)/solicitudes/[id]/page.tsx`, `app/(app)/solicitudes/page.tsx`, `lib/services/correo.ts`, `lib/services/push.ts`; Create `app/(app)/solicitudes/form-cerrar.tsx`, tests de acciones y de servicios.
**Interfaces:** acciones `aprobarParcialSolicitud(input: {id, items, motivo})`, `reaprobarSolicitud(fd)` y `cerrarSolicitud(_: unknown, fd)`; las dos últimas con `requerirAdmin()`; `aprobarParcialSolicitud` con `requerirPermiso("solicitudes.gestionar")` y la regla de no aprobar la propia; push `notificarPushParcial(numero, solicitante, token, idSolicitante, motivo)` (a Administradores —excluye al solicitante— y al solicitante) y `notificarPushCierre(numero, token, motivo, idsParticipantes)`; correo `notificarParcial(numero, correo, motivo)` y `notificarCierre(numero, correos, motivo)` (clave única `cierre:<numero>`, motivo escapado).
- [ ] Tests: acciones (parcial sin motivo/con motivo/sin cambios; no la propia; Administrador-only para re-aprobar y cerrar; llaman al RPC con los argumentos y notifican; errores de negocio y errores crudos); correo (motivo escapado); push (textos exactos).
- [ ] UI: `PanelAprobar` con motivo y dos botones («Aprobar» deshabilitado si cambió alguna cantidad; «Aprobar parcialmente» habilitado solo con cambio y motivo no vacío, contador x/100); estado 6: franja con motivo y «se cierra el <fecha + 7 días>»; Administrador ve «Aprobar» (re-aprobación) y «Cerrar solicitud» con motivo; todos los demás solo ven. Estado 7: motivo del cierre. Listado: filtro de estado 0–7 y motivo bajo la insignia (5, 6 y 7). Commit.

### Task 4: Cierre por caducidad
**Files:** Create `lib/services/caducidad.ts` (+test), `app/api/solicitudes/cerrar-caducadas/route.ts` (+test); Modify `proxy.ts` (`PUBLICAS`) + su prueba, `app/(app)/page.tsx` (respaldo).
**Interfaces:** `cerrarCaducadas(): Promise<{ cerradas: number }>` (RPC `cerrar_solicitudes_caducadas`; por cada una, `participantes_solicitud` → push y correo con motivo «Cierre por caducidad de días»; nunca lanza); ruta `GET` y `POST` protegidas con `rechazarSiNoEsCron`; el Inicio de quien tiene `solicitudes.gestionar` la llama con `after()`.
- [ ] Tests: sin caducadas no avisa; con 2 avisa a cada participante una vez y encola un correo por solicitud (clave `cierre:<n>`); error de la base no lanza; ruta 401 sin secreto, 200 con secreto en GET y POST; `/api/solicitudes/cerrar-caducadas` pasa sin sesión por el proxy.
- [ ] FAIL → implementar → PASS; suite. Commit.

### Task 5: Documentación y verificación en navegador
**Files:** Modify `CLAUDE.md`, `README.md`.
- [ ] Recorrido (Supabase falso + Playwright, build de producción): panel de aprobación (botones según cambios, motivo, contador), detalle en estado 6 como Administrador (Aprobar/Cerrar), como gestor no Administrador y como solicitante (solo ver), bandeja de ambos, cierre con motivo; 1280 y 375 px. Suite + tsc + eslint. Commit y push.
