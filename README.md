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
- El límite de intentos de login es por IP y vive en la base de datos (compartido entre instancias, con vencimiento). La IP sale de `x-forwarded-for` tomando el valor de la DERECHA que agregó el último proxy de confianza (`lib/auth/ip.ts`; el de la izquierda lo elige el cliente y no se usa): `PROXY_CONFIABLES` = cuántos proxies hay delante de la app (por defecto 1; con 0 la cabecera se ignora y todos comparten un solo contador). Sin proxy delante no hay forma segura de saber la IP.
- La CSP se fija en `proxy.ts` con un nonce por petición (`script-src 'self' 'nonce-…' 'strict-dynamic'`, sin `'unsafe-inline'` en scripts); por eso el layout raíz es dinámico (`await connection()`) y ninguna página se prerenderiza. `style-src` conserva `'unsafe-inline'` (los atributos `style` de React no admiten nonce). Una librería que cargue scripts desde otro origen sin pasar por Next quedará bloqueada: revisar la consola del navegador ("Refused to execute…") tras agregar una.
- La sesión dura 8 h. Los roles y el estado del usuario se revalidan en cada petición, y cambiar o restablecer la clave invalida los tokens anteriores; cerrar sesión también invalida en el servidor los tokens del usuario (sube `VersionSesion` con `revocar_sesiones`, migración 0036), así que cierra todos sus dispositivos.
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

## Integración con Fudo (precio de venta de las recetas)

- Cada receta se puede vincular a un producto de Fudo desde su vista «Ver» (sección «Fudo», con `recetas.gestionar`). El detalle muestra el precio de venta (leído en vivo de la API), el margen por porción y el costo como porcentaje del precio; en la base solo se guarda el id (`Recetas."IdProductoFudo"`).
- Credenciales: `FUDO_API_KEY` y `FUDO_API_SECRET` en el entorno del servidor (se piden a soporte@fu.do indicando la cuenta y un usuario dedicado a la API). Sin ellas la aplicación funciona igual y la sección avisa que Fudo no está configurado.
- API `v1alpha1` (puede cambiar). **Por confirmar con credenciales reales:** el comodín `*` del filtro `ilike` en la búsqueda por nombre, y si `price` incluye IVA (la pantalla lo rotula «con IVA», igual que los costos).

### Ventas de Fudo que descuentan stock

- Cada venta **cerrada** en Fudo descuenta, de la bodega indicada en la receta, los ingredientes de la receta vinculada a ese producto (bruto con merma, convertido a unidad base, por porciones vendidas ÷ porciones de la receta; las sub-recetas se expanden con la proporción de su rendimiento). La bodega se elige al vincular la receta (cada bodega es un tipo de preparación: cuarto frío, cuarto caliente). Cada venta se descuenta **una sola vez** (`VentasFudo`) y queda el detalle en `ConsumosVenta`.
- El stock **puede quedar negativo** por una venta (ya ocurrió); es la única operación que lo permite. Las líneas vendidas sin receta vinculada o sin bodega no descuentan y se listan en `/mantenedores/ventas-fudo` («Vendido sin descontar stock»), pantalla solo Administrador con el botón «Sincronizar ventas ahora».
- Variables: `FUDO_API_KEY`, `FUDO_API_SECRET` y `FUDO_VENTAS_DESDE` (AAAA-MM-DD: desde cuándo se procesan ventas; evita traer el historial). Para sincronizar solo: programar un cron que llame `POST /api/fudo/sincronizar` con `Authorization: Bearer <CRON_SECRET>` (igual que los correos), p. ej. cada 15 minutos.
- **Límites actuales:** una venta cerrada que luego se anula en Fudo no se revierte; los modificadores y subítems (extras, combos) no descuentan; cada venta redondea sus consumos a 3 decimales de la unidad base. Se vuelve a leer desde 2 días antes de la última venta por si alguna cerró tarde.
- **Por confirmar con credenciales reales:** el formato del filtro `closedAt=and(gte…,lt…)`, que la lista de ventas traiga `items` y `items.product` con `include`, y los nombres de los tipos JSON:API.

## Facturas desde Bsale (nivel A: solo cabecera)

- `/compras/bsale` lista las facturas de proveedores recibidas en el SII que Bsale tiene (`GET /v1/third_party_documents.json`, códigos 33 y 34, las más recientes primero). Cada fila indica si ya está registrada (mismo proveedor y folio), si el proveedor no existe aquí (se busca por RUT) o si está disponible; «Registrar» abre «Nueva factura» con proveedor, folio y fecha, y muestra el total de Bsale como referencia. La API **no entrega las líneas** (productos, cantidades, precios): se ingresan a mano. Leer el XML del DTE (`urlXml`) para proponerlas es el nivel B, pendiente.
- Credencial: `BSALE_ACCESS_TOKEN` en el entorno del servidor (token del usuario de Bsale). Sin él la pantalla avisa que no está configurado.
- **Por confirmar con un token real:** que la lista venga ordenada por id ascendente (se lee desde el final con `count`), que la respuesta use `items`, y que `clientCode` sea el RUT del proveedor.

## Reportes

Menú **Reportes** (permiso `reportes.ver`: lo tiene el Administrador y el rol Compras; se asigna a otros roles desde la matriz de roles). Cada reporte se ve en pantalla con filtros y se descarga en CSV para Excel (separador `;`, coma decimal).

- **Stock valorizado** (`/reportes/stock`): cada producto en cada bodega (un mismo producto puede estar en varias) con su valor = cantidad en unidad base × costo unitario base (último precio de factura, con IVA). Un producto con stock y sin costo no suma y se avisa que el total es parcial; el stock negativo (ventas de Fudo) se valoriza en negativo.
- **Ventas por producto** (`/reportes/ventas-producto`) y **Ventas por período** (`/reportes/ventas`: por día, semana de lunes a domingo o mes, con rangos rápidos): salen de las líneas de las ventas de Fudo que se guardan al sincronizar (Mantenedores → Ventas de Fudo, o el cron `/api/fudo/sincronizar`). Las fechas son las de Chile. **Las ventas procesadas antes de la migración 0042 no tienen líneas** y no aparecen.
- **Por confirmar con credenciales reales de Fudo:** el monto de cada línea se calcula como `price` de la línea × `quantity` (si la línea no trae precio, el precio actual del producto); los descuentos o propinas de la venta completa no se reparten entre líneas, así que el total puede diferir del cierre de caja de Fudo.

## Pendiente para el despliegue
Aún no está definido dónde se desplegará la aplicación. Cuando se defina, hay que hacer esto (hoy los correos quedan en la cola `CorreosPendientes` y no se pierden):
1. **`CRON_SECRET`**: inventar un valor de 16+ caracteres (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) y guardarlo como variable de entorno del despliegue. No va en el repositorio.
2. **`RESEND_API_KEY`, `MAIL_FROM` (dominio verificado en Resend) y `APP_URL`**: configurarlos en el entorno de despliegue.
3. **Programar el reintento de correos**: un cron cada 5–10 minutos que llame `POST https://<dominio>/api/correos/procesar` con la cabecera `Authorization: Bearer <CRON_SECRET>`. Respuesta esperada: `{"enviados":N,"fallidos":N}` (401 = valor distinto; 503 = falta `CRON_SECRET` en la app). Según el hosting:
   - Vercel: Cron Jobs en `vercel.json` (envía solo `Authorization: Bearer $CRON_SECRET`, pero con `GET`: habría que aceptar también `GET` en `app/api/correos/procesar/route.ts`).
   - Otro hosting: servicio externo (p. ej. cron-job.org) o GitHub Actions programado; servidor propio: `crontab` con `curl -X POST`.
4. **Proxy / hosting**: fijar `PROXY_CONFIABLES` con el número de proxies que agregan a `x-forwarded-for` delante de la app (límite de login por IP) y comprobar en staging que un `X-Forwarded-For` enviado por el cliente no cambia el contador.
   **Rol acotado** (recomendado): activar `app_servidor` con `SUPABASE_APP_TOKEN` y anotar su fecha de vencimiento (ver la sección anterior).
5. **Probar el envío real de un correo** (aprobar una solicitud) y revisar `CorreosPendientes` (`Estado` 1 = enviado, 2 = fallido tras 5 intentos).

