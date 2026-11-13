# Avisos push de solicitudes — diseño (aprobado)

## Intención
Que quien debe atender una solicitud se entere al instante, en computador, Android e iPhone, sin abrir la aplicación.
- Al ENVIAR una solicitud (estado Enviada; no al crearla como borrador): aviso a todos los usuarios con `solicitudes.gestionar` (incluye Administrador).
- Al APROBAR o RECHAZAR: aviso al solicitante (ampliación pedida por el usuario).
- Un clic en el aviso abre `/solicitudes/<token>`.

## Enfoque elegido: Web Push estándar (VAPID)
Descartados: solo correo (ya existe, depende de `RESEND_API_KEY` y no es inmediato) y app nativa (costo desproporcionado).

## Diseño
- Migración `0047`: tabla `"SuscripcionesPush"` (`IdUsuario`, `Endpoint` único, `P256dh`, `Auth`, fecha). RLS activa, sin acceso directo para `app_servidor` (matriz `SIN_ACCESO`); solo funciones `definer`: `guardar_suscripcion_push` (upsert por endpoint; un dispositivo cambia de usuario si otra persona inicia sesión), `quitar_suscripcion_push`, `suscripciones_push_usuarios(ids)` y `suscripciones_push_permiso(permiso)` (mismos destinatarios que `correosPorPermiso`: roles vigentes con el permiso + Administrador, usuarios vigentes).
- Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` o URL). `npm run gen:vapid` imprime un par; el usuario lo guarda. Sin ellas la aplicación funciona y el botón avisa que los avisos no están configurados.
- `lib/services/cola-push.ts` (lógica pura, probada con falsos): envía a cada suscripción, borra la que responde 404/410, nunca lanza, un fallo no afecta a las demás.
- `lib/services/push.ts` (conecta `web-push` y las funciones SQL): `notificarPushEnviada`, `notificarPushResuelta`; se llaman con `after()` desde `enviarSolicitud`, `aprobarSolicitud` y `rechazarSolicitud`. Un fallo de push nunca revierte la operación.
- Cliente: `public/sw.js` (muestra el aviso; clic abre la URL del payload solo si es una ruta interna), `app/manifest.ts`, componente `ActivarAvisos` en el Inicio (usuarios con `solicitudes.ver_propias` o `solicitudes.gestionar`): pide el permiso solo al tocar el botón, guarda la suscripción vía server action (`app/(app)/push/actions.ts`, `requerirPermiso`). Estados: no soportado / iPhone sin instalar (explica cómo instalar) / bloqueado / sin configurar / activado (con «Desactivar»).
- `proxy.ts`: `/sw.js` y `/manifest.webmanifest` públicos; CSP con `worker-src 'self'` (con `'strict-dynamic'` el worker se bloquearía).

## No objetivos
Push a otros eventos (recepción, stock bajo); preferencias por tipo de aviso; app nativa.

## Límites conocidos
- iPhone solo recibe push con la aplicación instalada en la pantalla de inicio (iOS ≥ 16.4).
- Se activa por dispositivo.
- La entrega real en un teléfono no se puede probar en este entorno: se prueba la lógica y el registro del worker; el usuario verifica en su celular.
