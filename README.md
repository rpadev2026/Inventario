# Inventario del Restaurant

Next.js (App Router, TypeScript) + Tailwind + Supabase (Postgres). Toda la lógica corre en el servidor.

## Puesta en marcha
1. Crear un proyecto en Supabase y ejecutar en el SQL Editor, en orden:
   `supabase/migrations/0001_esquema.sql`, `0002_funciones.sql`, `0003_solicitudes.sql`, `0004_anular_factura.sql`, `0005_fix_search_path.sql`, `0006_maestros.sql`, `0007_permisos.sql`, `0008_territorio.sql`, `0009_territorio_datos.sql`, `0010_territorio_proveedores.sql`, `0011_vendedor_rut_vigente.sql`, `0012_roles_base_reactivar.sql`, `0013_productos_id_costo_base.sql` y `supabase/seed.sql`. Los datos de regiones, ciudades (provincias) y comunas salen de la API DPA del MOP y se regeneran con `npm run gen:territorio`.
   Nota: `0006` vacía `Compras`, `Productos` y `Solicitudes` y, por `truncate ... cascade`, sus tablas dependientes (detalle de compras, stock, movimientos, historial) (pasa a claves por código de catálogo); aplíquela solo en una base sin datos reales.
   Nota: `0013` también vacía `Compras`, `Productos` y `Solicitudes` (y sus dependientes): `Productos` pasa a la clave `"IdProducto"` con precio de compra y costo unitario base; aplíquela solo en una base sin datos reales.
2. Copiar `.env.example` a `.env.local` y completar:
   - `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API). **La service_role key nunca debe llevar prefijo `NEXT_PUBLIC_` ni subirse a git.**
   - `SESSION_SECRET`: `openssl rand -base64 48`.
   - `RESEND_API_KEY`, `MAIL_FROM` (dominio verificado en Resend) y `APP_URL` para los correos.
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
- El límite de intentos de login es en memoria y por IP (`x-forwarded-for`); detrás de varios servidores o un proxy no confiable use un almacén compartido o el límite del proveedor de hosting.
- La CSP permite `'unsafe-inline'` en scripts (requerido por Next sin nonces). Se puede endurecer con nonces vía proxy.
- La sesión es stateless (8 h). Los roles y el estado del usuario se revalidan en cada petición, pero un token robado sigue válido hasta expirar aunque se cierre sesión.
- Los correos fallidos se reintentan una vez y se registran en el log; no hay cola persistente.
- Las facturas no se editan: se anulan (revierte el stock si no fue despachado) y se vuelven a ingresar.
