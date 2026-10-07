# Precio de compra desde la factura y unidad base del producto — diseño

Fecha: 2026-10-07 · Rama: `feat/precio-desde-factura` · Migración: `0016`

## Objetivo

El precio de compra deja de ingresarse en Productos: lo trae la factura. Cada línea de factura gana el campo **unidad de medida** y guarda precio, unidad y cantidad **tal cual se ingresan**. La transformación (a la unidad del producto) ocurre en Productos: el producto tiene una única unidad, la **unidad base**, que se ingresa al crearlo.

## Decisiones (aprobadas por el usuario)

1. La factura guarda precio, unidad de medida y cantidad sin convertir (`ComprasDetalle`).
2. El producto tiene una sola unidad, la **unidad base**, elegida al crearlo; **reemplaza** a la «Unidad de medida» actual. Stock, solicitudes y pantallas trabajan en la unidad base (p. ej. Gramos).
3. La unidad de una línea debe ser de la misma familia que la unidad base del producto (misma `UnidadBase` en `UnidadesMedida`); si no, la factura se rechaza con mensaje de negocio. Kilo y Gramo sí; Kilo y Litro no.
4. Los datos que dejan de usarse en Productos se eliminan: `"UnidadMedida"` (reemplazada por `"UnidadBase"` ingresada) y `"PrecioCompra"` (ya no se ingresa).

## Supuestos (revisar al aprobar el spec)

- **Costo neto:** el precio de la línea incluye IVA; el costo unitario base se guarda **neto**: `round(precio / 1,19 / Factor, 6)` por unidad base. (Si prefieres el costo con IVA, es un cambio de una línea.)
- **Gana la última factura registrada** (orden de registro, no de fecha de factura). Si un producto aparece varias veces en la misma factura, rige la última línea.
- El **historial** registra un cambio cada vez que el costo unitario base cambia por una factura (no si queda igual). Anular una factura **no** revierte el costo ni el historial.
- La unidad base de un producto solo se elige entre unidades que son base (factor 1: G, ML, UN…). No se cambia una vez que el producto tiene movimientos de stock o facturas (evita reinterpretar cantidades).
- No hay datos que migrar: Productos, Compras y Stock están vacíos (verificado el 2026-10-07).
- La cantidad en stock se guarda en unidad base: `cantidad × Factor` de la unidad de la línea, redondeada a 3 decimales.

## 1. Base de datos (`0016_precio_desde_factura.sql`)

### Productos
- Quitar los triggers `trg_costo_base` y `trg_historial_precio` y sus funciones.
- Quitar las columnas `"UnidadMedida"` y `"PrecioCompra"`.
- `"UnidadBase" text not null` pasa a ser **ingresada** (FK a `UnidadesMedida("Codigo")`); un trigger valida que sea una unidad base (su propia `UnidadBase` y factor 1).
- `"CostoUnitarioBase" numeric(14,6)` pasa a **nullable** (sin compras = sin costo); lo escribe solo `registrar_factura`.
- Se mantiene todo lo demás (`IdProducto`, `Codigo`, `Nombre`, `Formato`, stocks, estado, auditoría).

### ComprasDetalle
- Nueva columna `"UnidadMedida" text not null` (FK a `UnidadesMedida`). `Precio` y `Cantidad` siguen como se ingresan.

### HistorialPreciosProducto (recreada, vacía)
`IdHistorial`, `IdProducto`, `IdCompra` (FK a Compras), `Precio` (numeric(14,2), tal cual la línea, con IVA), `UnidadMedida` (de la línea), `CostoBaseAnterior` (null en la primera compra), `CostoBaseNuevo`, `IdUsuario`, `FechaRegistro`. RLS activo, sin acceso público.

### UnidadesMedida
- `validar_unidad_medida`: no se puede cambiar `UnidadBase`/`Factor` si hay productos con esa `UnidadBase` o líneas de factura con esa `UnidadMedida` (mismo mensaje de negocio).

### RPC
- `registrar_factura`: el detalle recibe `{"producto", "precio", "unidad", "cantidad"}`. Por cada línea valida producto vigente, unidad vigente y **compatible** (misma `UnidadBase`), guarda la línea tal cual, suma al stock `round(cantidad × Factor, 3)` (y registra esa cantidad en `BodegaCentral`), calcula `costo = round(precio / 1,19 / Factor, 6)`, y si difiere de `CostoUnitarioBase` actualiza el producto e inserta el historial (con `IdCompra`). Se mantiene la validación de total (±$1).
- `anular_factura`: revierte el stock con las cantidades ya convertidas de `BodegaCentral` (sin cambios de lógica; mensajes con el nombre del producto).
- `crear_solicitud`, `actualizar_solicitud`, `aprobar_solicitud`, `recepcionar_solicitud` no cambian (cantidades ya en unidad base).

## 2. Aplicación

- **Productos:** el formulario pide «Unidad base» (select de unidades base vigentes) y ya no pide «Precio de compra». «Ver» muestra la unidad base, el **costo unitario base (neto)** o «—» si aún no hay compras, y el historial: fecha, folio de la factura (enlace), precio de la línea con su unidad, costo anterior → nuevo y usuario. El listado muestra la unidad base. La unidad base no se edita si el producto ya tiene stock o facturas.
- **Factura (`/compras/nueva`):** cada línea tiene «Unidad de medida» (select); al elegir producto se propone su unidad base y se ofrecen las unidades de su misma familia. El borrador de `sessionStorage` incluye la unidad (los borradores sin unidad se ignoran). `facturaSchema.detalle[]` suma `unidad` (código).
- **Detalle de factura:** la columna Unidad muestra la unidad de la línea (no la del producto).
- **Solicitudes, Bodegas, Productos (stock), Inicio:** las unidades que se muestran pasan a ser la unidad base del producto.
- **Mantenedor de unidades:** «Dónde se usa» cuenta productos (por unidad base) y líneas de factura (por unidad).

## 3. Pruebas y documentación

- SQL (PGlite): conversión de stock (5 Kilo → 5.000 g), costo neto por unidad base, historial solo si cambia el costo, unidad incompatible rechazada sin dejar cabecera, unidad no vigente rechazada, bloqueo de cambio de factor con uso, producto sin compras sin costo, anulación con stock convertido.
- Unitarias: `facturaSchema` con `unidad`, borrador con unidad, filtro de unidades por familia, esquema de producto con `unidadBase` y sin precio.
- Actualizar `e2e-cleanup.sql` y su prueba (historial con `IdCompra`), `CLAUDE.md` y `README.md`.
- Recorrido en navegador: unidad base al crear producto → factura con unidad distinta de la base (Kilo vs Gramos) → stock y costo → historial → rechazo de unidad incompatible → 375 px; luego limpiar datos de prueba.

## Fuera de alcance
Recetas/consumo, revertir costo al anular, factor propio por producto, costos con IVA.

## Riesgos
- Cambia la forma del detalle de factura y de varias pantallas (≈ 15 archivos): se verifica con `tsc`, la suite completa y el recorrido.
- Las cantidades pasan a unidad base (números grandes en gramos); es la consecuencia de la opción A elegida.
