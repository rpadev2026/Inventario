# Motivo del rechazo y aviso de recepción Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Native). Steps use checkbox syntax.

**Goal:** Rechazo con motivo (≤100) visible en bandeja 7 días, detalle, listado, push y correo; push a gestores al recepcionar.

**Architecture:** Migración 0048 (columna + RPC `rechazar_solicitud`), ajustes en la lógica pura de la bandeja, el servicio de consulta, las acciones y las pantallas.

**Tech Stack:** Next.js, Supabase/PGlite tests, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-13-rechazo-motivo-recepcion-push-design.md`

## Global Constraints
- UI en español, «usted»; clases de `tema.css`; etiqueta visible en formularios (`Field`); errores solo de negocio.
- `lib/db/tipos.ts` a mano (Supabase MCP caído); tabla/función nueva: grants a `app_servidor`, ver `0047`.
- Un fallo de push/correo nunca revierte la operación.
- Motivo: texto, recortado, 1 a 100 caracteres, validado en Zod y en SQL.

## Review Focus
1. Rechazar sin motivo, con solo espacios o con 101 caracteres: error de negocio y la solicitud sigue Enviada (UI, acción y SQL).
2. Nadie rechaza la suya ni una que no esté Enviada; `cambiar_estado_solicitud(…,5)` ya no funciona.
3. Rechazadas anteriores (sin motivo) no rompen listado, detalle ni bandeja.
4. Bandeja: rechazada propia a los 6 días 23 h aparece; a los 7 días y 1 min no; ajena nunca; total real.
5. Texto del motivo con `<`, `&` o comillas: se escapa en el correo y se muestra como texto en pantallas y push.

### Task 1: Migración 0048 y tipos
**Files:** Create `supabase/migrations/0048_motivo_rechazo.sql`, `supabase/tests/rechazo.test.ts`; Modify `supabase/tests/db.test.ts` (línea con `cambiar_estado_solicitud(3, ${s2}, 5::smallint)` → usar `rechazar_solicitud`), `supabase/tests/rol-app.test.ts` si hace falta, `lib/db/tipos.ts`.
**Interfaces — Produces:** `"Solicitudes"."MotivoRechazo" text null`; `rechazar_solicitud(p_usuario bigint, p_solicitud bigint, p_motivo text) returns void`.
- [ ] Tests (`rechazo.test.ts`, PGlite como `push.test.ts`): rechazo válido guarda motivo recortado, estado 5, aprobador, fecha e historial; motivo vacío/espacios/101 chars → error «Indique el motivo del rechazo (máximo 100 caracteres)»; 100 chars exactos pasa; desde estado distinto de 1 → «Transición inválida»; el propio solicitante → error; `cambiar_estado_solicitud(.., 5)` → «Transición inválida»; `app_servidor` ejecuta la función.
- [ ] FAIL → migración (columna con check `char_length("MotivoRechazo") between 1 and 100`; función; `create or replace cambiar_estado_solicitud` sin el 5, mismo cuerpo que 0002; grants) → PASS; tipos; `npx vitest run supabase`. Commit.

### Task 2: Bandeja con rechazadas recientes
**Files:** Modify `lib/bandeja-solicitudes.ts`, `lib/bandeja-solicitudes.test.ts`, `lib/services/bandeja.ts`, `lib/services/bandeja.test.ts`, `app/(app)/bandeja-solicitudes.tsx`, `app/(app)/bandeja-solicitudes.test.tsx`, `app/(app)/page.tsx` (sin cambios si la firma se mantiene).
**Interfaces:** `FilaSolicitud` gana `MotivoRechazo: string | null; FechaResolucion: string | null`; `Espera` gana `"Rechazada"`; `export const DIAS_RECHAZADA = 7`; `armarBandeja(filas, u, limite = 10, ahora = new Date())`; `cargarBandeja(u, ahora = new Date())`.
- [ ] Tests puros: propia rechazada hace 6 d 23 h → visible, espera «Rechazada», `requiereAccion` false; hace 7 d 1 min → no; ajena (aunque gestione) → no; sin `FechaResolucion` → no; orden normal por fecha. Servicio: la consulta del solicitante y la del gestor incluyen la rama de rechazadas con `FechaAprobacion.gte.<ISO de ahora−7 d>` (verificar el texto exacto del `.or`), columnas piden `MotivoRechazo,FechaAprobacion`; el total sigue saliendo del conteo. Vista: fila rechazada muestra «Motivo: …» (texto, no HTML) y su insignia; sin motivo (antiguas) no muestra la línea.
- [ ] FAIL → implementar → PASS; suite + tsc + eslint. Commit.

### Task 3: Rechazar con motivo (acción, formulario, detalle, listado, correo)
**Files:** Create `app/(app)/solicitudes/form-rechazar.tsx`, `app/(app)/solicitudes/rechazo.test.ts`; Modify `app/(app)/solicitudes/actions.ts`, `app/(app)/solicitudes/[id]/page.tsx`, `app/(app)/solicitudes/page.tsx`, `lib/services/correo.ts`, `lib/services/push.ts` (+test), `lib/validation/` (esquema `motivoRechazoSchema`).
**Interfaces:** `export const motivoRechazoSchema` (string trim 1–100, mensaje «Indique el motivo del rechazo (máximo 100 caracteres)»); `rechazarSolicitud(_: unknown, fd: FormData): Promise<{error?: string; ok?: boolean}>`; `notificarResuelta(numero, correo, aprobada, motivo?)` y `notificarPushResuelta(numero, idSolicitante, token, aprobada, motivo?)` (cuerpo rechazada: `Motivo: <motivo>`; sin motivo: texto actual).
- [ ] Tests: esquema (vacío, espacios, 101, 100, recorta); acción (mock de `db` y sesión): sin motivo no llama al RPC y devuelve el error; con motivo llama `rechazar_solicitud` con `p_motivo` recortado, notifica con motivo y devuelve ok; error P0001 del RPC se muestra como mensaje de negocio; propia → «No puede rechazar su propia solicitud». Correo: el motivo se escapa (`<b>` no queda como HTML). Push: cuerpo con motivo. Formulario (render estático): etiqueta «Motivo del rechazo», `maxLength` 100, contador «0/100».
- [ ] FAIL → implementar (formulario con `useAccion`, error visible, `router.refresh()` al terminar; detalle muestra «Motivo del rechazo: …» si estado 5 y hay motivo; listado muestra el motivo bajo la insignia con `select` ampliado) → PASS; suite. Commit.

### Task 4: Aviso de recepción
**Files:** Modify `lib/services/push.ts`, `lib/services/push.test.ts`, `app/(app)/solicitudes/actions.ts`; Test `app/(app)/solicitudes/recepcion.test.ts`.
**Interfaces:** `notificarPushRecepcionada(numero: number, solicitante: string, bodega: string, token: string, idSolicitante: number, total: boolean): Promise<void>` (a `suscripciones_push_permiso("solicitudes.gestionar", p_excluir = idSolicitante)`; título «Solicitud #N recepcionada» / «Solicitud #N recepcionada parcialmente»; cuerpo «<Solicitante> recibió los productos para <Bodega>.» / «… recibió una parte de los productos para <Bodega>.»; url por token, tag `solicitud-<token>`).
- [ ] Tests push: total y parcial con título/cuerpo/URL exactos; sin VAPID no consulta. Acción: `recepcionarSolicitud` usa el estado devuelto por el RPC (3 → total, 4 → parcial), llama a `after(notificarPushRecepcionada)` solo si el RPC salió bien; con error del RPC no notifica.
- [ ] FAIL → implementar (consulta de datos de la solicitud con la FK nombrada) → PASS; suite + tsc + eslint. Commit.

### Task 5: Documentación y verificación en navegador
**Files:** Modify `CLAUDE.md`, `README.md` (migración 0048 en el orden de aplicación).
- [ ] Recorrido con el Supabase falso + Playwright (build de producción): formulario de rechazo (vacío → error visible; 101 caracteres bloqueado por `maxLength`; con motivo ok), bandeja del solicitante con la rechazada y su motivo, detalle y listado con motivo; 1280 y 375 px, tema oscuro y claro. Suite + tsc + eslint. Commit y push.
