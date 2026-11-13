# Avisos push de solicitudes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Native). Steps use checkbox syntax.

**Goal:** Push al enviar una solicitud (gestores) y al aprobar/rechazar (solicitante), con clic a `/solicitudes/<token>`.

**Architecture:** Tabla de suscripciones accesible solo por funciones SQL; servicio de envío con lógica pura probada con falsos y un conector `web-push`; service worker + botón «Activar avisos» en el Inicio.

**Tech Stack:** Next.js (App Router), Supabase/PGlite tests, Vitest, `web-push`.

**Spec:** `docs/superpowers/specs/2026-11-13-push-solicitudes-design.md`

## Global Constraints
- UI en español, trato de «usted» en textos nuevos; clases de `app/tema.css`, sin degradados; controles ≥ 44 px.
- Instalar dependencias con `--legacy-peer-deps`.
- Nunca el id numérico en URLs: el aviso lleva `/solicitudes/<Token>`.
- Un fallo de push nunca revierte ni retrasa la operación de negocio (`after()`, nunca lanza).
- Tabla nueva: clasificar en `supabase/tests/rol-app.test.ts`; `lib/db/tipos.ts` se edita a mano (Supabase MCP caído) siguiendo el formato generado.
- Errores al usuario: solo mensajes de negocio.

## Review Focus
1. Suscripción 404/410 se borra y las demás reciben igual; un fallo de red no borra nada.
2. Un endpoint reutilizado por otro usuario (mismo dispositivo) pasa al nuevo usuario, sin duplicar.
3. Usuario inactivo o con rol inactivo no recibe push; el solicitante recibe solo lo suyo.
4. URL del payload: el clic del `sw.js` solo abre rutas internas (`/...`, no `//` ni `http`).
5. Sin claves VAPID: ni `enviarSolicitud` ni la pantalla fallan.

### Task 1: Migración 0047 y tipos
**Files:** Create `supabase/migrations/0047_suscripciones_push.sql`, `supabase/tests/push.test.ts`; Modify `supabase/tests/rol-app.test.ts` (`SIN_ACCESO` + `"SuscripcionesPush"`), `lib/db/tipos.ts`.
**Interfaces — Produces (SQL):** `guardar_suscripcion_push(p_usuario bigint, p_endpoint text, p_p256dh text, p_auth text) returns void`; `quitar_suscripcion_push(p_endpoint text) returns void`; `suscripciones_push_usuarios(p_usuarios bigint[]) returns table("Endpoint" text,"P256dh" text,"Auth" text)`; `suscripciones_push_permiso(p_permiso text)` mismo retorno. Todas `security definer`, `set search_path = public`, EXECUTE solo para `app_servidor`.
- [ ] Test (`push.test.ts`, PGlite como `rol-app.test.ts`): guardar dos veces el mismo endpoint = 1 fila; mismo endpoint con otro usuario lo reasigna; `quitar` lo borra; `suscripciones_push_usuarios([1])` solo trae las de ese usuario; `suscripciones_push_permiso('solicitudes.gestionar')` trae Administrador y rol con el permiso, no usuario inactivo ni rol sin permiso; `app_servidor` no puede `select` directo de la tabla pero sí `select * from suscripciones_push_usuarios(...)`.
- [ ] Ejecutar: FAIL (función no existe).
- [ ] Migración (mismo patrón de grants que `0025`/`0043`; recipientes con la lógica de `correosPorPermiso`: `Roles."IdEstado"=1`, `UsuariosRoles."IdEstado"=1`, `Usuarios."IdEstado"=1`, rol «Administrador» o con fila en `RolesPermisos`).
- [ ] Clasificar la tabla en la matriz; agregar tipos de tabla y funciones a `tipos.ts`. Ejecutar `npx vitest run supabase` + `npx tsc --noEmit`: PASS. Commit.

### Task 2: Lógica pura de envío
**Files:** Create `lib/services/cola-push.ts`, `lib/services/cola-push.test.ts`.
**Interfaces — Produces:**
```ts
export type Suscripcion = { endpoint: string; p256dh: string; auth: string };
export type AvisoPush = { titulo: string; cuerpo: string; url: string; tag: string };
export type EnviadorPush = (s: Suscripcion, aviso: AvisoPush) => Promise<{ estado: number } | void>; // lanza con { statusCode } si falla
export async function enviarAvisos(subs: Suscripcion[], aviso: AvisoPush, enviar: EnviadorPush, quitar: (endpoint: string) => Promise<void>): Promise<{ enviados: number; quitadas: number; fallidos: number }>
```
- [ ] Tests: todas OK → enviados=n; una lanza `{statusCode:410}` → se llama `quitar` con su endpoint y las demás se envían; 404 igual; `{statusCode:500}` o error sin código → fallidos, NO se quita; si `quitar` lanza no se propaga; lista vacía → ceros sin llamar al enviador.
- [ ] FAIL → implementar (secuencial o `Promise.allSettled`, nunca lanza) → PASS. Commit.

### Task 3: Conector, acciones y enganche
**Files:** Create `lib/services/push.ts`, `lib/services/push.test.ts`, `app/(app)/push/actions.ts`; Modify `app/(app)/solicitudes/actions.ts`, `package.json` (`web-push`, `@types/web-push`, script `gen:vapid` → `scripts/generar-vapid.ts`); Create `scripts/generar-vapid.ts`.
**Interfaces — Produces:**
```ts
export function pushConfigurado(): boolean // VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT presentes
export async function notificarPushEnviada(numero: number, solicitante: string, bodega: string, token: string): Promise<void> // a suscripciones_push_permiso("solicitudes.gestionar"); excluye al propio solicitante
export async function notificarPushResuelta(numero: number, idSolicitante: number, token: string, aprobada: boolean): Promise<void> // a suscripciones_push_usuarios([idSolicitante])
// app/(app)/push/actions.ts
export async function suscribirPush(input: unknown): Promise<{ ok?: true; error?: string }> // Zod {endpoint https url, p256dh, auth}; requerirPermiso("solicitudes.ver_propias","solicitudes.gestionar")
export async function desuscribirPush(input: unknown): Promise<{ ok?: true; error?: string }>
```
Títulos: «Nueva solicitud #N», cuerpo «<Solicitante> envió una solicitud para <Bodega>.»; «Solicitud #N aprobada|rechazada». `tag` = `solicitud-<token>`; `url` = `/solicitudes/<token>`. Envían con `after()` y nunca lanzan; sin `pushConfigurado()` retornan sin hacer nada.
- [ ] Tests (`push.test.ts`, mock de `server-only`, `@/lib/db/supabase`, `web-push`, `next/server`): sin VAPID no consulta la base; con VAPID llama `suscripciones_push_permiso` / `suscripciones_push_usuarios` con los argumentos correctos y arma el payload esperado (url con token, nunca id); 410 llama `quitar_suscripcion_push`; error de la base no lanza. Test de `actions` : entrada inválida (endpoint `http://`, vacío) → error de negocio.
- [ ] FAIL → implementar → PASS. Enganchar: `enviarSolicitud` agrega `Token` al select y llama `after(() => notificarPushEnviada(...))` tras `notificarEnviada`; `aprobarSolicitud`/`rechazarSolicitud` agregan `IdUsuarioSolicitante` y `Token` a la consulta de `correoSolicitante` y llaman `notificarPushResuelta`. Suite completa + tsc + eslint. Commit.

### Task 4: Service worker, manifest, proxy y CSP
**Files:** Create `public/sw.js`, `app/manifest.ts`, `lib/push-url.ts`, `lib/push-url.test.ts`; Modify `proxy.ts`, `proxy` tests si existen.
**Interfaces — Produces:** `export function rutaInterna(url: unknown): string` → la misma ruta si empieza por `/` y no por `//` ni contiene `\`; si no, `"/"`. `sw.js` duplica esa regla en una función propia (no importa módulos) y la prueba la lee como texto para exigir que exista.
- [ ] Tests: `rutaInterna` acepta `/solicitudes/abc`, rechaza `//evil.com`, `https://x`, `javascript:x`, `/\\x`, números. Test sobre `proxy.ts` (patrón de `lib/auth/proxy-inactividad.test.ts`): `/sw.js` y `/manifest.webmanifest` pasan sin sesión; CSP contiene `worker-src 'self'`.
- [ ] FAIL → implementar (`PUBLICAS` + `/sw.js`, `/manifest.webmanifest`; `worker-src 'self'`; `sw.js`: evento `push` con `showNotification(titulo,{body,tag,data:{url}})`, `notificationclick` enfoca una ventana existente o `clients.openWindow(rutaInterna(url))`; manifest: nombre, `start_url:"/"`, `display:"standalone"`, colores de la marca de `tema.css`, ícono SVG) → PASS. Commit.

### Task 5: Botón «Activar avisos», documentación y verificación
**Files:** Create `components/app/activar-avisos.tsx`, `lib/push-cliente.ts`, `lib/push-cliente.test.ts`; Modify `app/(app)/page.tsx`, `CLAUDE.md`, `README.md`, `app/tema.css` (si hace falta una clase).
**Interfaces — Produces:** `export function claveAplicacion(base64Url: string): Uint8Array` (VAPID pública → bytes); `export type EstadoAvisos = "no-soportado"|"ios-sin-instalar"|"bloqueado"|"sin-configurar"|"inactivo"|"activo"`; `export function estadoAvisos(e: { soportado: boolean; esIos: boolean; instalada: boolean; permiso: NotificationPermission|"default"; configurado: boolean; suscrito: boolean }): EstadoAvisos`. `ActivarAvisos({ clavePublica?: string })` (cliente): botón de 44 px con etiqueta visible; pide permiso solo al hacer clic; registra `/sw.js`, `pushManager.subscribe({userVisibleOnly:true, applicationServerKey})`, llama `suscribirPush`; «Desactivar» llama `desuscribirPush` y `unsubscribe()`; mensajes por estado en español (iPhone: «En iPhone, agregue esta aplicación a la pantalla de inicio (Compartir → Agregar a inicio) para recibir avisos»).
- [ ] Tests: `claveAplicacion` decodifica base64url con y sin relleno; `estadoAvisos` cubre cada rama (orden: no-soportado > ios-sin-instalar > sin-configurar > bloqueado > activo/inactivo). Render estático de `ActivarAvisos` muestra el botón con etiqueta.
- [ ] FAIL → implementar; montar en `page.tsx` para quien tiene `solicitudes.ver_propias|gestionar`, pasando `process.env.VAPID_PUBLIC_KEY`. Documentar en CLAUDE.md (migración 0047, push, env) y README («Avisos push»: generar claves, variables, migración, iPhone). 
- [ ] Verificación en navegador (fake Supabase del scratchpad + Playwright, build de producción): `/sw.js` y manifest responden sin sesión, el worker se registra sin violar la CSP, el botón aparece y, con permiso concedido por Playwright, `suscribirPush` guarda; capturas 1280 y 375 px. Suite + tsc + eslint. Commit.
