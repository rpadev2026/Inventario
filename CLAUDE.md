@AGENTS.md

# Inventario del Restaurant

Sistema de inventario de insumos y materia prima: facturas de compra → Bodega Central → solicitudes de insumos a otras bodegas con aprobación y recepción.
Stack: Next.js (App Router, TypeScript) + Tailwind + Supabase (Postgres). UI en español.

## Comandos
- `npm run dev` / `npm run build` / `npm start`
- `npm test` — Vitest: validadores, esquemas y funciones SQL (migraciones ejecutadas en PGlite, sin necesitar Supabase)
- `npx tsc --noEmit` — chequeo de tipos
- `npm run seed:admin -- <rut> <correo> <clave>` — crea el administrador inicial (requiere `.env.local`)
- Instalar dependencias siempre con `--legacy-peer-deps`.

## Arquitectura
- Toda la lógica corre en el servidor (server actions). El navegador nunca habla con Supabase; el servidor usa `service_role` (`lib/db/supabase.ts`, solo servidor). Las tablas tienen RLS activo sin políticas públicas.
- `app/(app)/<modulo>/` páginas + `actions.ts` (módulos: compras, proveedores, productos, bodegas, solicitudes, movimientos, usuarios, mantenedores); `lib/auth/` sesión, hash y login; `lib/services/` reglas de negocio y correo; `lib/validation/` Zod y RUT.
- Las operaciones críticas son funciones SQL transaccionales en `supabase/migrations/` (`registrar_factura`, `anular_factura`, `crear_solicitud`, `actualizar_solicitud`, `aprobar_solicitud`, `cambiar_estado_solicitud`, `recepcionar_solicitud`). No reimplementar esa lógica en la app: llamar al RPC.
- Las migraciones se ejecutan en orden `0001`…`0010` + `seed.sql` (`0006` maestros y FK por código, `0007` permisos de roles y RPC `guardar_rol`, `0008` tablas de territorio, `0009` datos oficiales generados, `0010` proveedores/sucursales por código + trigger de jerarquía). Cambios de esquema = nueva migración numerada, y actualizar `supabase/tests/db.test.ts`.

## Permisos y mantenedores
- La autorización es por PERMISO, no por nombre de rol. Catálogo en `lib/auth/permisos.ts` (`compras.ver|registrar|anular`, `proveedores.ver|gestionar`, `productos.ver|gestionar`, `bodegas.ver`, `solicitudes.ver_propias|crear|gestionar`, `movimientos.ver`). `leerSesion` lee `RolesPermisos` en cada petición (no van en el token) y calcula los efectivos con `permisosEfectivos`.
- Server actions: `requerirPermiso(...)`; páginas: `requerirPaginaPermiso(...)` (alguno de los permisos basta). Pantallas solo-Administrador (usuarios, mantenedores y crear/editar bodegas; ver bodegas es el permiso `bodegas.ver`): `requerirAdmin` / `requerirPaginaAdmin`; NO son asignables por permiso. Administrador tiene todos los permisos de forma implícita (sin filas en `RolesPermisos`).
- Mantenedores (solo Administrador): `/mantenedores` (índice), `/mantenedores/formas-pago`, `/mantenedores/unidades-medida`, `/mantenedores/formatos` (`components/app/catalogo-admin.tsx` + `catalogo-form.tsx`) y `/mantenedores/roles` (matriz de permisos; guarda con el RPC `guardar_rol`; los 4 roles base `EsBase` no se renombran).
- Territorio (solo Administrador): `/mantenedores/regiones`, `/mantenedores/ciudades` y `/mantenedores/comunas` (mismo `catalogo-admin` con padre opcional; códigos CUT inmutables; no se desactiva un padre con hijos vigentes). «Ciudad» = Provincia (la jerarquía oficial es Región → Provincia → Comuna; no existe lista oficial de ciudades). Datos de la API DPA del MOP (SUBDERE) generados con `npm run gen:territorio` → `0009_territorio_datos.sql` (la API trae 345 comunas; se agrega Antártica 12202). En Proveedores/Sucursales `Region`, `Ciudad` y `Comuna` guardan CÓDIGO (FK + trigger `validar_territorio`); formularios con `components/app/selector-territorio.tsx` (tres combobox dependientes), lógica pura y validación de jerarquía en `lib/territorio-opciones.ts`, carga/verificación en servidor en `lib/services/territorio.ts`.
- Formas de pago, unidades de medida y formatos se guardan por CÓDIGO (FK a `FormasPago`/`UnidadesMedida`/`Formatos`), nunca como texto; los nombres se resuelven al mostrar (`lib/catalogo-nombres.ts`, `lib/catalogo-opciones.ts`).
- Factura (`/compras/nueva`): folio solo enteros; precio hasta 2 decimales; fecha de recepción ≥ fecha de factura. Se valida en Zod y también en SQL (`registrar_factura`).
- Crear proveedor/producto desde la factura: enlaces `?volver=/compras/nueva` (ruta validada con `lib/volver.ts`, nunca redirige fuera del sitio); el borrador de la factura se guarda en `sessionStorage` (`lib/borrador-factura.ts`) y se restaura al volver, preseleccionando lo recién creado (`aplicarPreProducto`).
- Paginación: `lib/paginacion.ts` (`paginar`: 10 por defecto; 10/25/50/75/100; estado en la URL) y `components/app/paginador.tsx`. Bodegas (`/bodegas`): listado con filtro por nombre (sin tildes) y estado (`lib/bodegas-filtro.ts`, `?q&estado&pagina&tam`); `?ver=ID` (bodega y productos, `?ppagina&ptam`), `?editar=ID` y `?crear=1` (solo Administrador) son vistas aparte con botón Volver que conserva página y filtros; al guardar/crear vuelven al listado con un aviso que se difumina (`components/app/aviso.tsx`, `?aviso=`). Tablas con `table-wrap-sticky` tienen scroll propio y la fila de títulos fija.
- Buscadores: `components/app/combobox.tsx` (accesible) con `lib/buscar.ts` (normaliza tildes/mayúsculas); entradas numéricas con `lib/numeros.ts` (`filtrarDecimal`, `parseCantidad`, `parseDecimal2`).

## Diseño de la aplicación ("Pizarra y esmeralda", Flat)
- Generado con la skill ui-ux-pro-max (estilo Flat; Poppins para títulos/botones + Open Sans para texto). Modo claro por defecto y oscuro automático (`prefers-color-scheme`). Sin sombras ni degradados.
- Todo el estilo vive en `app/tema.css` (variables `--surface`, `--text-muted`, `--primary`... y clases semánticas). Las pantallas NO usan colores Tailwind sueltos: usar `card`, `btn btn-primary|secondary|danger`, `input`, `table-wrap`+`table`, `link`, `pill`, `badge`, `alert`, `page-title`, `section-title`.
- Formularios: siempre etiqueta visible con `components/app/field.tsx` (`<Field label="...">`), nunca solo placeholder. Rejillas: `form-grid form-grid-2|3|4` y `fld-2|fld-3|fld-full` (NO llamarlas `col-N`: Tailwind v4 tiene `col-N` y le gana). Líneas de detalle: `line-grid line-grid-3|4` (apiladas en celular).
- Estados: `components/app/badge.tsx` (punto + texto; el color nunca es la única señal). Tonos: ok, warn, danger, info, neutral.
- Navegación: barra lateral oscura en ≥1024 px; en pantallas menores barra superior + barra inferior con máx. 5 destinos (4 + «Más» con hoja). Íconos SVG de trazo en `components/app/icon.tsx` (sin emojis).
- Controles de 44 px, foco visible, respeta `prefers-reduced-motion`. Tablas con scroll horizontal en pantallas estrechas.

## Reglas que no hay que romper
- Autorización: cada server action llama `requerirPermiso(...)` o `requerirAdmin()` (`lib/auth/session.ts`), que revalida usuario, roles y permisos contra la BD. No confiar en el token ni en ocultar botones. `requerirRol`/`requerirPagina` ya no existen.
- Roles base: Administrador (todo, implícito), Compras, Bodeguero Central, Solicitante; el Administrador puede crear más roles con la matriz de permisos. El rol no autoriza por su nombre (salvo Administrador): lo hacen sus permisos.
- Nadie aprueba ni rechaza su propia solicitud; solo el solicitante edita, envía y recepciona la suya (reforzado también en SQL).
- Validar toda entrada con Zod; mostrar al usuario solo mensajes de negocio (código `P0001` de las funciones SQL), nunca errores crudos de la BD.
- Contraseñas: argon2id, política de 12+ caracteres, historial de las últimas 5. Nunca texto plano ni logs de claves.
- Las consultas con relaciones anidadas hacia `Usuarios` deben indicar el nombre de la FK (`Usuarios!Tabla_Columna_fkey`): `Solicitudes`, `HistorialSolicitudes` y `UsuariosRoles` tienen varias.
- Next.js aquí es una versión nueva: `middleware` se llama `proxy.ts`; consultar `node_modules/next/dist/docs/` ante dudas.

## Estado de las pruebas
- Recorrido manual real contra Supabase ya hecho (login, proveedor, productos, factura, solicitud → envío → aprobación → recepción parcial y final, alertas de stock, permisos). Datos de prueba con prefijo `E2E` / bodega "Cocina E2E" (ya limpiados).
- `node --env-file=.env.local scripts/e2e-setup.ts` crea/reactiva 4 usuarios E2E: compras, solicitante, bodega y `e2e.admin` con rol Administrador (claves aleatorias en `.env.e2e`, ignorado por git).
- `supabase/scripts/e2e-cleanup.sql` (pegar en el SQL Editor de Supabase) borra SOLO los datos E2E (usuarios `e2e.%@example.test`, proveedor/productos/bodegas E2E y roles no base terminados en ` E2E`, p. ej. `Consulta E2E`) en una transacción y aborta si hay datos reales mezclados; no toca maestros (formas de pago, unidades, formatos) de prueba: bórrelos a mano; probado en `supabase/tests/cleanup.test.ts`. Después de limpiar, borrar `.env.e2e`.

## Pendiente conocido
- Migraciones `0006` a `0010` ya aplicadas en Supabase; El recorrido en navegador de territorio (mantenedores, selects dependientes, tipeo parcial, comuna desactivada, 375 px, no-Administrador) ya se hizo con Playwright (23/23); FALTA además el recorrido en navegador del nuevo formulario de factura (buscadores, validaciones, volver/borrador) y de los flujos de permisos y mantenedores, y limpiar los usuarios/datos E2E después.
- Automatizar ese recorrido con Playwright (hoy fue manual) y probar el envío real de correos (falta `RESEND_API_KEY`).
- Límite de intentos de login en memoria (no sirve con varias instancias); correos sin cola persistente. Detalle en `README.md`.
