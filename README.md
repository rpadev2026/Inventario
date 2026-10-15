# Inventario del Restaurant

Next.js (App Router, TypeScript) + Tailwind + Supabase (Postgres). Toda la lógica corre en el servidor.

## Puesta en marcha
1. Crear un proyecto en Supabase y ejecutar en el SQL Editor, en orden:
   `supabase/migrations/0001_esquema.sql`, `0002_funciones.sql`, `0003_solicitudes.sql`, `0004_anular_factura.sql`, `0005_fix_search_path.sql`, `0006_maestros.sql`, `0007_permisos.sql`, `0008_territorio.sql`, `0009_territorio_datos.sql`, `0010_territorio_proveedores.sql`, `0011_vendedor_rut_vigente.sql`, `0012_roles_base_reactivar.sql`, `0013_productos_id_costo_base.sql`, `0014_mensajes_producto.sql`, `0015_historial_precios_iva_incluido.sql`, `0016_precio_desde_factura.sql`, `0017_unidad_base_vigente_y_bloqueos.sql`, `0018_producto_mayusculas.sql`, `0019_recetas.sql`, `0020_permisos_tabla.sql`, `0021_recetas_ajustes.sql`, `0022_textos_mayuscula.sql` y `supabase/seed.sql`. Los datos de regiones, ciudades (provincias) y comunas salen de la API DPA del MOP y se regeneran con `npm run gen:territorio`.
   Nota: `0006` vacía `Compras`, `Productos` y `Solicitudes` y, por `truncate ... cascade`, sus tablas dependientes (detalle de compras, stock, movimientos, historial) (pasa a claves por código de catálogo); aplíquela solo en una base sin datos reales.
   Nota: `0016` asume `ComprasDetalle` e `HistorialPreciosProducto` vacías (agrega `UnidadMedida` obligatoria a las líneas y recrea el historial): el producto pasa a tener solo `UnidadBase` (ingresada) y su costo unitario base sale de la factura; aplíquela solo en una base sin facturas.
   Nota: `0013` también vacía `Compras`, `Productos` y `Solicitudes` (y sus dependientes): `Productos` pasa a la clave `"IdProducto"` con precio de compra y costo unitario base; aplíquela solo en una base sin datos reales.
2. Copiar `.env.example` a `.env.local` y completar:
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API). **La service_role key nunca debe llevar prefijo `NEXT_PUBLIC_` ni subirse a git.**
   - `SESSION_SECRET`: `openssl rand -base64 48`.
   - `RESEND_API_KEY`, `MAIL_FROM` (dominio verificado en Resend) y `APP_URL` para los correos. Los correos se encolan en la BD; para reintentar los fallidos, programe un cron (cada 5–10 min) que llame `POST /api/correos/procesar` con `Authorization: Bearer <CRON_SECRET>` (`CRON_SECRET`: 16+ caracteres).
3. Crear el administrador inicial (la clave temporal cumple la política y se debe cambiar al ingresar):
   `npm run seed:admin -- 12345678-5 admin@tu-dominio.cl 'ClaveTemporal#2026'`
   Para no dejar la clave en el historial de la terminal, anteponga un espacio al comando o use una variable de entorno.
4. `npm install --legacy-peer-deps`, `npm run dev` (o `npm run build && npm start`).

## Roles y permisos
La autorización es por permisos asignados a cada rol (matriz en Mantenedores → Roles). Roles base: Administrador (todo; único con acceso a usuarios y mantenedores, y el único que crea o edita bodegas; ver bodegas es el permiso `bodegas.ver`), Compras (facturas, proveedores, productos), Bodeguero Central (aprueba/rechaza solicitudes, movimientos) y Solicitante (crea, envía y recepciona sus solicitudes). El Administrador puede crear otros roles.

## Pruebas
Para probar a mano contra tu Supabase: `node --env-file=.env.local scripts/e2e-setup.ts` crea 4 usuarios de prueba, uno administrador (claves en `.env.e2e`) y, al terminar, `supabase/scripts/e2e-cleanup.sql` (SQL Editor) borra solo esos datos (incluye roles de prueba terminados en ` E2E`).

`npm test` — validadores, esquemas y las funciones SQL (migraciones ejecutadas en Postgres en memoria con PGlite).

## Seguridad: puntos a considerar en producción
- El límite de intentos de login es por IP y vive en la base de datos (compartido entre instancias, con vencimiento). La IP sale del primer valor de `x-forwarded-for`: el proxy o hosting debe normalizar esa cabecera.
- La CSP se fija en `proxy.ts` con un nonce por petición (`script-src 'self' 'nonce-…' 'strict-dynamic'`, sin `'unsafe-inline'` en scripts); por eso el layout raíz es dinámico (`await connection()`) y ninguna página se prerenderiza. `style-src` conserva `'unsafe-inline'` (los atributos `style` de React no admiten nonce). Una librería que cargue scripts desde otro origen sin pasar por Next quedará bloqueada: revisar la consola del navegador ("Refused to execute…") tras agregar una.
- La sesión dura 8 h. Los roles y el estado del usuario se revalidan en cada petición, y cambiar o restablecer la clave invalida los tokens anteriores; cerrar sesión solo borra la cookie local (un token robado sigue válido hasta que se cambie la clave o expire).
- Los correos se guardan en una cola en la BD y se reintentan con espera creciente (ver «Pendiente para el despliegue»).
- Las facturas no se editan: se anulan (revierte el stock si no fue despachado) y se vuelven a ingresar.

## Rol de base de datos acotado (opcional, recomendado)
Por defecto la aplicación habla con Supabase con la clave `service_role`: puede todo, incluidos los esquemas `auth` y `storage`, y se salta RLS. La migración `0030` crea el rol `app_servidor`, que solo puede lo que la app usa: leer, insertar y editar bodegas, proveedores, productos, catálogos, roles de usuario, datos básicos de usuarios y contadores de intentos; encolar correos; y llamar a las funciones SQL. **No borra nada y no escribe directo en facturas, solicitudes, stock, movimientos, recetas ni claves** (eso solo por funciones con reglas de negocio). La matriz exacta está en `supabase/tests/rol-app.test.ts`.

Para activarlo (una vez, en su máquina):
1. Aplique la migración `0030` en Supabase.
2. Copie el **JWT Secret** (Panel de Supabase → Project Settings → API → JWT Settings, «Legacy JWT secret»). Es MÁS poderoso que `service_role`: no lo guarde en el despliegue ni lo comparta.
3. Firme el token (PowerShell): `$env:SUPABASE_JWT_SECRET = "<JWT Secret>"; npm run token:app` (opcional `-- <años>`, por defecto 10). Después `Remove-Item Env:SUPABASE_JWT_SECRET`.
4. En el entorno de la aplicación defina `SUPABASE_APP_TOKEN` (el token), `SUPABASE_ANON_KEY` (la clave anon, que es pública) y `SUPABASE_URL`. Con el token puesto ya no hace falta `SUPABASE_SERVICE_ROLE_KEY` en el despliegue (los scripts `seed:admin` y `e2e-setup` la siguen usando desde su `.env.local`).
5. Sin `SUPABASE_APP_TOKEN` la app usa `service_role`, como antes.

Costos y cuidados: el token **vence** (fecha elegida al firmarlo): anote la fecha y renuévelo antes; si vence, la app deja de conectarse. Para revocarlo de inmediato, `revoke app_servidor from authenticator;` (o rotar el JWT Secret). Una tabla o función nueva no queda accesible al rol hasta agregar su `grant` y su política en una migración y clasificarla en la matriz de `rol-app.test.ts` (la prueba falla si falta).

## Pendiente para el despliegue
Aún no está definido dónde se desplegará la aplicación. Cuando se defina, hay que hacer esto (hoy los correos quedan en la cola `CorreosPendientes` y no se pierden):
1. **`CRON_SECRET`**: inventar un valor de 16+ caracteres (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) y guardarlo como variable de entorno del despliegue. No va en el repositorio.
2. **`RESEND_API_KEY`, `MAIL_FROM` (dominio verificado en Resend) y `APP_URL`**: configurarlos en el entorno de despliegue.
3. **Programar el reintento de correos**: un cron cada 5–10 minutos que llame `POST https://<dominio>/api/correos/procesar` con la cabecera `Authorization: Bearer <CRON_SECRET>`. Respuesta esperada: `{"enviados":N,"fallidos":N}` (401 = valor distinto; 503 = falta `CRON_SECRET` en la app). Según el hosting:
   - Vercel: Cron Jobs en `vercel.json` (envía solo `Authorization: Bearer $CRON_SECRET`, pero con `GET`: habría que aceptar también `GET` en `app/api/correos/procesar/route.ts`).
   - Otro hosting: servicio externo (p. ej. cron-job.org) o GitHub Actions programado; servidor propio: `crontab` con `curl -X POST`.
4. **Proxy / hosting**: que normalice `x-forwarded-for` (límite de login por IP).
   **Rol acotado** (recomendado): activar `app_servidor` con `SUPABASE_APP_TOKEN` y anotar su fecha de vencimiento (ver la sección anterior).
5. **Probar el envío real de un correo** (aprobar una solicitud) y revisar `CorreosPendientes` (`Estado` 1 = enviado, 2 = fallido tras 5 intentos).

