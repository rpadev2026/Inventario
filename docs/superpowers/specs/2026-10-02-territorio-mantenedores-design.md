# Mantenedores de Región, Ciudad y Comuna

Fecha: 2026-10-02 · Estado: pendiente de revisión

## Objetivo
En Proveedores (datos del proveedor y sus sucursales), Región, Ciudad y Comuna dejan de ser texto libre y pasan a ser listas desplegables dependientes alimentadas por tres mantenedores. Los mantenedores viven en el menú **Mantenedores** y solo los puede usar el rol **Administrador**. Los datos iniciales provienen de una fuente oficial del Estado de Chile.

## Decisiones acordadas
- **Ciudad = Provincia.** Chile no publica una lista oficial de «ciudades» como división administrativa. La jerarquía oficial es Región → Provincia → Comuna. En pantalla, «Ciudad» muestra la provincia (p. ej. Santiago, Valparaíso, Concepción). En la base la tabla se llama `Provincias`; el mantenedor y la lista se rotulan «Ciudad (provincia)».
- **Fuente oficial:** servicio DPA (División Político-Administrativa, datos SUBDERE) publicado por el MOP: `https://rest-sit.mop.gob.cl/arcgis/rest/services/INTEROP/SERVICIO_DPA/MapServer` (capas 1 Comunas, 2 Provincias, 3 Regiones; campos `CUT_REG`, `CUT_PROV`, `CUT_COM`, `REGION`, `PROVINCIA`, `COMUNA`).
- Al consultarlo (2026-10-02) devuelve 16 regiones, 56 provincias y **345 comunas**; las oficiales son 346. Falta **Antártica** (CUT 12202, provincia Antártica Chilena 122, Magallanes): se agrega manualmente en el generador y queda documentado.

## Datos (migración `supabase/migrations/0008_territorio.sql`)
- Tablas `Regiones`, `Provincias`, `Comunas` con el patrón de `FormasPago`: id identity, `Codigo` único (CUT: `^[0-9]{2}$`, `^[0-9]{3}$`, `^[0-9]{5}$`), `Nombre`, `IdEstado` (0/1), campos de auditoría, trigger `set_modificacion`, RLS activo y `revoke all` a `anon, authenticated`.
- `Provincias."CodigoRegion"` → FK a `Regiones."Codigo"`; `Comunas."CodigoProvincia"` → FK a `Provincias."Codigo"`. Códigos inmutables.
- Seed generado por `scripts/generar-territorio.ts`, que consulta el servicio del MOP, agrega Antártica, valida 16/56/346 y escribe el SQL de inserción. El SQL queda versionado en la migración; la app no depende del servicio en ejecución.
- `Proveedores` y `ProveedoresSucursales`: `Region`, `Ciudad` y `Comuna` pasan a guardar el **código** con FK (a `Regiones`, `Provincias`, `Comunas`), como `FormaPago`. Conversión de los textos actuales por coincidencia de nombre normalizado (sin tildes ni mayúsculas); lo que no coincida queda en `NULL`. Antes de aplicar se listan los casos sin coincidencia.
- Restricción de jerarquía en SQL: la provincia debe pertenecer a la región y la comuna a la provincia (trigger o FK compuesta).
- Los campos siguen siendo opcionales, como hoy.

## Mantenedores (solo Administrador)
- Rutas `/mantenedores/regiones`, `/mantenedores/ciudades` y `/mantenedores/comunas`, con tarjetas nuevas en `/mantenedores`.
- Reutilizan `components/app/catalogo-admin.tsx` y `catalogo-form.tsx`, ampliados con un selector padre (ciudad pide región; comuna pide ciudad y muestra su región).
- Acciones: crear, editar nombre y desactivar o reactivar. Los códigos no se editan.
- Desactivar un registro con hijos vigentes se rechaza con mensaje de negocio.
- Server actions con `requerirAdmin()`, páginas con `requerirPaginaAdmin()`. No son asignables por permiso, igual que el resto de los mantenedores. Zod valida toda entrada.

## Formularios de Proveedor y Sucursal
- `app/(app)/proveedores/forms.tsx` (FormProveedor y FormSucursal): Región, Ciudad y Comuna pasan a `Combobox` dependientes. Al cambiar el padre se limpia el hijo; la lista de hijos se filtra por el padre. Solo se ofrecen registros vigentes (más el valor ya guardado, aunque esté inactivo).
- `app/(app)/proveedores/actions.ts` y `lib/validation/schemas.ts`: reciben códigos y validan en Zod y en servidor que la jerarquía sea coherente.
- Los nombres se resuelven al mostrar (listado y detalle de proveedor), siguiendo `lib/catalogo-nombres.ts`.

## Pruebas
- `supabase/tests/db.test.ts`: jerarquía y FK, conteos del seed (16/56/346), rechazo de combinaciones incoherentes, desactivación con hijos y conversión de los textos existentes.
- Vitest para los esquemas Zod de proveedor y sucursal (jerarquía válida e inválida).
- `npx tsc --noEmit` y `npm test` en verde antes de dar por terminado.

## Fuera de alcance
- Ciudades del INE o ciudades manuales (descartadas).
- Direcciones, códigos postales y localidades.
- Permisos asignables para estos mantenedores.
