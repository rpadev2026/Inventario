# Mejoras a Nueva factura, mantenedor de Formas de pago y Roles con permisos

Fecha: 2026-10-01 · Estado: pendiente de revisión

## Objetivo
1. Mejorar el formulario "Nueva factura" (búsquedas, validaciones, sin modales).
2. Crear mantenedor de **Formas de pago** (solo Administrador).
3. Crear mantenedor de **Roles con permisos por módulo** (solo Administrador), y pasar la autorización de la app de "nombre de rol" a "permiso".
4. Crear mantenedores de **Unidades de medida** y **Formatos** de producto (solo Administrador).

Contexto: aún no hay datos reales, por lo que se pueden borrar los datos de prueba y cambiar el esquema sin migrar datos.

## 1. Formulario Nueva factura
- **Proveedor**: campo con autocompletado (combobox accesible) que busca por RUT o razón social (sin distinguir mayúsculas ni puntos del RUT). Opción: "RUT — Razón social".
- **Producto**: mismo componente, busca por código o texto, en cada línea.
- **Crear proveedor / producto**: sin modal. El enlace lleva a `/proveedores` o `/productos`; al guardar, se vuelve a `/compras/nueva` (parámetro `volver`, solo rutas internas permitidas). El borrador de la factura se guarda en `sessionStorage` antes de salir y se restaura al volver; el registro recién creado queda seleccionado. Se eliminan los modales y el modo `rapido` de `FormProveedor`.
- **Folio**: texto con `inputMode="numeric"`, solo dígitos, sin flechas. Entero > 0.
- **Precio unitario**: solo dígitos y un separador decimal, **hasta 2 decimales** (`^\d+([.,]\d{1,2})?$`), sin flechas. La cantidad conserva su validación actual.
- **Fecha de recepción ≥ fecha de factura**: `min` dinámico en el formulario, regla en Zod y `raise P0001` en `registrar_factura` (defensa en SQL).
- **Forma de pago**: desplegable con las formas **vigentes** de la tabla `FormasPago`.

## 2. Formas de pago
Migración `0006`:
- Tabla `FormasPago`: `IdFormaPago` (identity), `Codigo` (texto único, mayúsculas/dígitos/guion bajo, inmutable tras crear), `Nombre`, `IdEstado` (0/1) y columnas de auditoría. RLS activo sin políticas públicas.
- `Compras.FormaPago` guarda **solo el código**, con FK a `FormasPago.Codigo`. Se borran las facturas de prueba (y su detalle y movimientos asociados) antes de agregar la FK.
- `registrar_factura` valida que el código exista y esté vigente (P0001).
- Datos iniciales: las formas actuales (`FORMAS_PAGO` de `lib/validation/schemas.ts`) con un código cada una.
- Pantalla `/formas-pago` (listar, crear, editar nombre, activar/desactivar). La constante `FORMAS_PAGO` se elimina.
- Una forma de pago no se puede borrar (solo desactivar); las facturas la referencian.

## 3. Roles con permisos
### Modelo
- Catálogo de permisos **fijo en código** (`lib/auth/permisos.ts`), con código, módulo y descripción en español. Los permisos asignables:

| Código | Qué permite |
|---|---|
| `compras.ver` | Ver facturas |
| `compras.registrar` | Registrar facturas |
| `compras.anular` | Anular facturas |
| `proveedores.ver` / `proveedores.gestionar` | Ver / crear y editar proveedores, sucursales y vendedores |
| `productos.ver` / `productos.gestionar` | Ver / crear y editar productos |
| `bodegas.ver` | Ver bodegas y stock |
| `solicitudes.ver_propias` | Ver y recepcionar solicitudes propias |
| `solicitudes.crear` | Crear, editar y enviar solicitudes propias |
| `solicitudes.gestionar` | Ver todas, aprobar, rechazar (nunca la propia) |
| `movimientos.ver` | Ver movimientos de bodega |

- Tabla `RolesPermisos` (`IdRol`, `Permiso`, auditoría), PK (`IdRol`, `Permiso`), `Permiso` validado contra el catálogo en la aplicación y con CHECK de formato en SQL. RLS sin políticas públicas.
- **Solo Administrador** (no asignables a ningún otro rol, para evitar escalada de privilegios): gestión de usuarios, roles, formas de pago y creación de bodegas. El rol Administrador tiene todos los permisos de forma implícita y no se edita.
- Los 4 roles base se siembran con los permisos equivalentes a los actuales, de modo que el comportamiento no cambia:
  - Compras: `compras.*`, `proveedores.*`, `productos.*`
  - Bodeguero Central: `solicitudes.ver_propias`, `solicitudes.gestionar`, `bodegas.ver`, `movimientos.ver`
  - Solicitante: `solicitudes.ver_propias`, `solicitudes.crear`, `bodegas.ver`
- Los 4 roles base no se pueden renombrar ni desactivar; sus permisos sí se pueden editar (Administrador excluido). Un rol no se puede desactivar si tiene usuarios activos.

### Autorización
- `leerSesion()` calcula `permisos: string[]` (unión de los permisos de los roles vigentes del usuario, o todos si es Administrador), revalidado contra la BD en cada petición como hoy.
- Se reemplazan `requerirRol(...)` / `requerirPagina(...)` por `requerirPermiso(...)` / `requerirPaginaPermiso(...)`; se mantiene una variante `requerirAdmin()` para las pantallas solo-Administrador. Todas las server actions y páginas migran a permisos. El menú se filtra por permiso.
- Reglas de negocio que dependen del rol (nadie aprueba su propia solicitud; solo el solicitante edita/envía/recepciona la suya) se mantienen y siguen reforzadas en SQL.
- Notificaciones por correo: hoy se envían a quienes tienen el rol "Bodeguero Central"; pasan a enviarse a usuarios con el permiso `solicitudes.gestionar`.

### Pantalla `/roles`
- Listar roles, crear (nombre + detalle), editar nombre/detalle, activar/desactivar, y una matriz de permisos agrupada por módulo con casillas. Los cambios se guardan en una transacción (RPC) y son efectivos de inmediato (la sesión se revalida en cada petición).
- Protecciones: roles base no renombrables ni desactivables; no se puede dejar al sistema sin ningún usuario Administrador activo.

## 4. Unidades de medida y Formatos (módulo Productos)
Hoy ambas listas están fijas en un CHECK de `Productos` y en `lib/validation/schemas.ts` (`UNIDADES`, `FORMATOS`). Pasan a ser tablas administrables, con el mismo patrón que Formas de pago.

Migración `0006` (misma que Formas de pago):
- Tabla `UnidadesMedida`: `IdUnidadMedida` (identity), `Codigo` (texto único, mayúsculas/dígitos/guion bajo, inmutable tras crear), `Nombre`, `IdEstado` (0/1) y auditoría. RLS activo sin políticas públicas.
- Tabla `Formatos`: misma estructura (`IdFormato`, `Codigo`, `Nombre`, `IdEstado`, auditoría).
- `Productos.UnidadMedida` y `Productos.Formato` guardan **solo el código**, con FK a `UnidadesMedida.Codigo` y `Formatos.Codigo`; se eliminan los CHECK de listas fijas. Se borran los productos de prueba (y lo que dependa de ellos: detalle de facturas y solicitudes, stock, movimientos) antes de agregar las FK.
- Datos iniciales: Unidades `KG` Kilo, `G` Gramos, `L` Litro, `ML` Mililitro, `UN` Unidad. Formatos `CAJA`, `BOLSA`, `PALLET`, `BIN`, `SACHET`, `BOTELLA`, `LATA`, `TARRO`, `MANGA`, `PACK` (nombre = nombre actual).
- Las constantes `UNIDADES` y `FORMATOS` se eliminan. Zod valida el código por formato; que exista y esté vigente lo valida la FK más una comprobación en la acción (mensaje de negocio, no error crudo de la BD).
- El formulario de producto ofrece solo las opciones **vigentes**; al editar un producto cuya unidad o formato se desactivó después, esa opción sigue visible para no perder el dato. Las tablas y detalles muestran el nombre (con join), no el código.
- No se puede borrar una unidad o formato (solo desactivar); los productos los referencian.
- Pantallas `/unidades-medida` y `/formatos` (listar, crear, editar nombre, activar/desactivar), visibles solo para **Administrador**. Dado que son datos maestros del módulo Productos, cada pantalla enlaza de vuelta a Productos y el formulario de producto tiene un enlace de ayuda a ellas solo si el usuario es Administrador.

## Menú
"Formas de pago", "Roles", "Unidades de medida" y "Formatos" solo para Administrador; en móvil entran en el menú "Más". Para no saturar el menú del Administrador (ya largo), las cuatro entradas de mantenedores se agrupan bajo un único destino "Mantenedores" (`/mantenedores`) con una página índice que enlaza a cada uno.

## Pruebas y verificación
- Vitest/PGlite: fecha de recepción; `FormasPago`, `UnidadesMedida`, `Formatos` y sus FK de código (producto con unidad/formato inexistente o inactivo rechazado); forma inactiva rechazada; `RolesPermisos`; siembra equivalente de los roles base; protecciones de roles.
- Unitarias: validación de folio y precio (2 decimales), cálculo de permisos efectivos, filtro del menú.
- `tsc`, `next build`; aplicar migración en Supabase y revisar en el navegador: factura completa (desktop y móvil), mantenedores (incluidas unidades y formatos en el formulario de producto), y un rol nuevo con permisos limitados que realmente restrinja el acceso.

## Fuera de alcance
- Permisos por registro o por bodega (cada solicitante ve solo sus solicitudes, como hoy).
- Permisos que habiliten gestión de usuarios/roles a roles no administradores.
