# Productos con IdProducto y costo unitario base — diseño

Fecha: 2026-10-06 · Rama: `feat/productos-id-costo-base` · Migración: `0013`

## Objetivo

Recrear la tabla `Productos` con clave numérica `"IdProducto"`, código opcional, precio de compra y costo unitario por unidad base (gramo, mililitro o unidad), para costeo. La aplicación debe seguir funcionando completa con la nueva tabla.

## Decisiones (aprobadas)

1. La estructura de la query del usuario es la estructura final (opción A): la clave pasa de `"CodigoProducto"` a `"IdProducto"` y se migran tablas hijas, RPC y app.
2. Los datos existentes son de prueba y se borran (compras, solicitudes, stock, movimientos y productos), igual que en la migración `0006`.
3. `UnidadBase` y `CostoUnitarioBase` se calculan automáticamente a partir de la unidad de medida; no son editables.
4. Nombres de columnas en PascalCase (convención del proyecto), no en minúsculas con guion bajo.
5. `UnidadMedida`, `UnidadBase` y `Formato` se enlazan por **código** (FK a `"Codigo"`), según la regla vigente del proyecto.

## Supuestos

- `PrecioCompra` se ingresa a mano en el producto, es el precio por unidad de medida y las facturas no lo actualizan.
- Stock mínimo/crítico mantienen la precisión `numeric(14,3)` actual.
- La migración se aplica en Supabase con la herramienta, como las anteriores.

## 1. Base de datos (`0013_productos_id_costo_base.sql`)

### UnidadesMedida
- Nuevas columnas `"UnidadBase" text not null` (FK a `"UnidadesMedida"("Codigo")`) y `"Factor" numeric(14,6) not null check ("Factor" > 0)`.
- Valores iniciales: KG→G ×1000, G→G ×1, L→ML ×1000, ML→ML ×1, UN→UN ×1. Unidades existentes no listadas: base = ella misma, factor 1.
- Regla: la unidad base debe ser una unidad cuyo propio `UnidadBase` sea ella misma y factor 1 (la base no se encadena).

### Vaciado
`truncate` de compras, solicitudes, productos y, en cascada, detalles, stock y movimientos; reiniciar la secuencia de solicitudes como en `0006`.

### Productos (recreada)
| Columna | Tipo / regla |
|---|---|
| `"IdProducto"` | bigint identity, PK |
| `"Codigo"` | text, único, opcional |
| `"Nombre"` | text, obligatorio, único |
| `"UnidadMedida"` | text, obligatorio, FK `UnidadesMedida("Codigo")` |
| `"Formato"` | text, obligatorio, FK `Formatos("Codigo")` |
| `"PrecioCompra"` | numeric(12,2), obligatorio, ≥ 0 |
| `"UnidadBase"` | text, FK `UnidadesMedida("Codigo")`, calculada |
| `"CostoUnitarioBase"` | numeric(14,6), calculada |
| `"StockMinimo"`, `"StockCritico"` | numeric(14,3), ≥ 0, `StockCritico <= StockMinimo` |
| `"IdEstado"` | smallint 0/1, por defecto 1 |
| auditoría | `IdUsuarioCreacion`, `FechaRegistroCreacion`, `IdUsuarioModificacion`, `FechaRegistroModificacion` (como hoy) |

- Trigger `BEFORE INSERT OR UPDATE`: lee `UnidadBase` y `Factor` de la unidad de medida y fija `"UnidadBase"` y `"CostoUnitarioBase" = "PrecioCompra" / "Factor"` (redondeo a 6 decimales). Cualquier valor enviado para esas columnas se sobrescribe.
- Mantener RLS activo sin políticas públicas, `revoke` a `anon/authenticated` y el trigger `set_modificacion`, como en las demás tablas.

### Tablas hijas
`ComprasDetalle`, `BodegaCentral`, `StockBodega`, `SolicitudesDetalle` y `MovimientosBodega`: reemplazar `"CodigoProducto"` por `"IdProducto" bigint not null references "Productos"("IdProducto")`, rehaciendo PK/únicos/índices que incluían el código (p. ej. `("IdBodega","IdProducto")` en `StockBodega`).

### RPC
Reescribir con la definición vigente más reciente: `registrar_factura`, `crear_solicitud`, `actualizar_solicitud`, `aprobar_solicitud`, `recepcionar_solicitud` (y `anular_factura`/`cambiar_estado_solicitud` si tocan producto). Los detalles JSON reciben `producto` (id) en vez de `codigo`. Siguen validando que el producto exista y esté vigente (`IdEstado = 1`) y mantienen los mensajes de negocio (`P0001`).

## 2. Aplicación

- **Mantenedor Unidades de medida** (`components/app/catalogo-admin.tsx` / `catalogo-form.tsx`, `lib/services/catalogo.ts`): campos «Unidad base» (select de unidades) y «Factor». Solo para ese catálogo. En Ver se muestran; «Dónde se usa» cuenta también la referencia como unidad base.
- **Productos** (`app/(app)/productos/*`, `lib/productos-filtro.ts`, `lib/validation`): rutas `?ver=ID`, `?editar=ID`; formulario con «Código» (opcional), «Precio de compra»; unidad base y costo unitario base solo lectura en Ver/Editar. El filtro sigue buscando por código o nombre (sin tildes). Zod valida precio con hasta 2 decimales y código con el patrón existente cuando viene.
- **Selectores y flujos**: factura (`/compras/nueva`), solicitudes y movimientos envían `IdProducto` y muestran «código — nombre» (o solo nombre si no hay código). `lib/borrador-factura.ts` y `aplicarPreProducto` usan el id; «Crear producto desde la factura» vuelve con el id recién creado.
- **Páginas afectadas**: inicio (alertas de stock), bodegas (productos y stock), compras y detalle, solicitudes (nueva, detalle), movimientos. Las consultas anidadas cambian el campo de enlace a `IdProducto`.

## 3. Pruebas y documentación

- Actualizar `supabase/tests/db.test.ts`, `cleanup.test.ts`, `lib/productos-filtro.test.ts` y los demás tests que usen el código como clave.
- Nuevas pruebas SQL: cálculo de `UnidadBase`/`CostoUnitarioBase` por unidad (KG, L, UN), recálculo al cambiar precio o unidad, código opcional pero único, nombre único, sobrescritura de valores calculados enviados a mano.
- `supabase/scripts/e2e-cleanup.sql`: productos E2E se identifican por `"Codigo" like 'E2E-%'` (o nombre).
- Actualizar `CLAUDE.md` (esquema, migración `0013`, reglas de Productos y de Unidades de medida).
- Recorrido en navegador con Playwright: mantenedor de unidades → producto → factura → solicitud → aprobación → recepción; revisar consola, 375 px; luego limpiar los datos de prueba.

## Fuera de alcance

Factor propio por producto (p. ej. caja de 12 unidades), actualización automática de `PrecioCompra` desde facturas, recetas.

## Riesgos

- Gran cantidad de archivos tocados (≈14 en app y tests): se verifica con `npx tsc --noEmit` y la suite completa.
- La migración vacía datos: ya autorizado para datos de prueba; verificar antes de aplicar que no hay datos reales.
