# Módulo Recetas — diseño

Fecha: 2026-10-08 · Rama: `feat/recetas` · Migración: `0019`

## Objetivo

Registrar recetas (fichas técnicas) con ingredientes que son productos del inventario u otras recetas (sub-recetas), y calcular su costo total y por porción a partir del `"CostoUnitarioBase"` que dejan las facturas. El módulo parte vacío: no se importa el Excel `Inventario_final.xlsx` (sus datos requieren limpieza previa).

## Decisiones (aprobadas)

1. Claves `bigint identity`, columnas PascalCase entre comillas, estado `"IdEstado"` 0/1 y auditoría igual que `Productos` (`IdUsuarioCreacion`, `FechaRegistroCreacion`, `IdUsuarioModificacion`, `FechaRegistroModificacion`). Una receta se desactiva, no se borra.
2. `Multiplicador` pasa a llamarse **`Cantidad`**: cuántas unidades del ingrediente entran (ej. 1 tira). `PorcionNeta` es lo que aporta cada unidad, en una unidad de medida (ej. 500 GR).
3. `PorcionNeta` de un producto se ingresa en una unidad de la misma familia que su `"UnidadBase"` (se guarda tal cual; se convierte a base solo al costear).
4. Una sub-receta se mide en cantidad con unidad (ej. bechamel rinde 2000 GR), no en porciones. Por eso `Recetas` lleva rendimiento con unidad.
5. Merma como en la ficha del Excel: la pérdida se suma al neto, `bruto = neto × (1 + merma)`.
6. El costo se calcula al mostrar (función SQL), nunca se guarda.

## 1. Base de datos (`0019_recetas.sql`)

### Recetas
| Columna | Tipo / regla |
|---|---|
| `"IdReceta"` | bigint identity, PK |
| `"CodigoReceta"` | text, único, opcional (vacío = null) |
| `"Nombre"` | text, obligatorio, único |
| `"RendimientoPorciones"` | numeric(8,2), > 0, por defecto 1 |
| `"RendimientoCantidad"` | numeric(14,3), > 0, nullable |
| `"RendimientoUnidad"` | text, FK `UnidadesMedida("Codigo")`, nullable |
| `"IdEstado"` | smallint 0/1, por defecto 1 |
| auditoría | como `Productos` |

- Check: `RendimientoCantidad` y `RendimientoUnidad` ambos nulos o ambos con valor.
- Trigger `normalizar_receta` (como `normalizar_producto`): `CodigoReceta := upper(nullif(btrim(CodigoReceta),''))`, `Nombre := upper(btrim(Nombre))`; únicos sin distinguir mayúsculas. Trigger `set_modificacion`.
- Una receta sin rendimiento no puede usarse como sub-receta.
- Una receta no se desactiva si es sub-receta de otra receta vigente (mensaje de negocio, como la regla de unidades de medida).
- RLS activo sin políticas públicas, `revoke` a `anon/authenticated`.

### RecetaDetalles
| Columna | Tipo / regla |
|---|---|
| `"IdDetalle"` | bigint identity, PK |
| `"IdReceta"` | bigint, FK `Recetas`, `on delete cascade` |
| `"IdProducto"` | bigint, FK `Productos`, nullable |
| `"IdSubReceta"` | bigint, FK `Recetas`, nullable |
| `"Cantidad"` | numeric(10,3), > 0, por defecto 1 |
| `"PorcionNeta"` | numeric(10,3), > 0 |
| `"UnidadMedida"` | text, FK `UnidadesMedida("Codigo")` |
| `"PorcentajeMerma"` | numeric(6,4), ≥ 0, por defecto 0 (0,25 = 25 %) |

- Check `ck_Tipo_Origen`: exactamente uno de `IdProducto` / `IdSubReceta`.
- Únicos parciales: `("IdReceta","IdProducto")` y `("IdReceta","IdSubReceta")`.
- Índices por `IdReceta`, `IdProducto`, `IdSubReceta`.
- Trigger: una receta no se incluye a sí misma ni forma ciclos (directos o indirectos).
- Unidad: para producto, misma familia (`UnidadBase`) que la base del producto; para sub-receta, misma familia que su `RendimientoUnidad`. La unidad debe estar vigente.

### RPC
- `guardar_receta(cabecera jsonb, detalles jsonb)`: crea o actualiza (según `id`) la cabecera y reemplaza todos los detalles en una transacción. Valida ingredientes vigentes, sub-recetas con rendimiento, unidades, sin repetidos, mensajes de negocio (`P0001`). Los detalles son `{"producto"|"subreceta": id, "cantidad", "porcion", "unidad", "merma"}`.
- `calcular_receta(id)`: devuelve, por línea, cantidad bruta (`Cantidad × PorcionNeta × (1 + merma)`) y costo, y para la receta costo total, costo por porción y `Incompleto` (algún ingrediente sin costo). Resuelve sub-recetas recursivamente.

### Fórmulas
- Línea de producto: `Cantidad × PorcionNeta × (1+merma)` convertido a la unidad base × `CostoUnitarioBase`. Sin costo → línea «sin costo», receta incompleta (no falla).
- Línea de sub-receta: `Cantidad × PorcionNeta × (1+merma)` convertido a la unidad de su rendimiento × (costo total de la sub-receta ÷ `RendimientoCantidad`).
- Costo por porción = costo total ÷ `RendimientoPorciones`.

### Permisos
Nuevos permisos `recetas.ver` y `recetas.gestionar` en el catálogo de permisos (tabla de permisos asignables por rol) y en `lib/auth/permisos.ts`. El rol Compras recibe `recetas.ver` y `recetas.gestionar`; los demás roles base quedan sin permiso. El Administrador los tiene implícitos.

## 2. Aplicación

- Ruta `/recetas` (`app/(app)/recetas/{page.tsx,actions.ts,form.tsx}`), mismo patrón que Productos; entrada en el menú lateral visible con `recetas.ver`.
- **Listado**: filtro por código/nombre y estado (`lib/recetas-filtro.ts`, `components/app/filtros-listado.tsx`), paginado; columnas código, nombre, porciones, costo por porción (insignia «Incompleto» si falta costo) y estado.
- **Ver** (`?ver=ID`): datos y rendimiento; ingredientes con cantidad, porción neta, unidad, merma, cantidad bruta y costo; enlace a la sub-receta; resumen de costo total y por porción; aviso con los ingredientes sin costo.
- **Crear / Editar** (`?crear=1`, `?editar=ID`, requieren `recetas.gestionar`): cabecera (código, nombre, porciones, rendimiento cantidad + unidad, estado al editar) y líneas con tipo (producto/sub-receta), `combobox`, Cantidad, Porción neta, unidad (solo la familia correcta), Merma en % y quitar. Vista previa del costo con `lib/receta-calculo.ts`. Volver y aviso al guardar. En 375 px las líneas se apilan.
- `lib/validation/schemas.ts`: `recetaSchema` (Zod): cantidades > 0, merma 0–999,9999 %, ingredientes obligatorios y sin repetidos, nombre/código en MAYÚSCULA.
- La acción mapea `P0001` y `23505` (código o nombre ya existe) como en Productos.
- Estilo solo con clases de `tema.css`; formularios con `Field`; sin colores sueltos.

## 3. Pruebas y documentación

- **SQL (PGlite)**: mayúsculas y unicidad; check producto/sub-receta; ciclos directos e indirectos; sub-receta sin rendimiento; unidad de otra familia; no desactivar receta usada; `guardar_receta` reemplaza detalles; `calcular_receta` con merma, conversión KG→G, sub-receta anidada e ingrediente sin costo.
- **Vitest**: `recetaSchema`, `lib/recetas-filtro.ts`, `lib/receta-calculo.ts`.
- `supabase/scripts/e2e-cleanup.sql`: borra recetas E2E (`"Nombre" like '% E2E'` o código `E2E-%`) antes de los productos E2E; actualizar `cleanup.test.ts`.
- Recorrido en navegador (Playwright): crear producto con costo vía factura, receta simple, sub-receta, ingrediente sin costo, validaciones, permisos, 375 px, consola; luego limpieza de datos.
- Actualizar `CLAUDE.md` y `README.md` (migración `0019`, módulo Recetas, permisos).

## Fuera de alcance

Importación del Excel, descontar stock al producir, fotos o instrucciones de preparación, versiones de una receta.

## Riesgos

- La recursión de `calcular_receta` depende de que no haya ciclos: lo garantiza el trigger, con prueba específica.
- El costo usa `CostoUnitarioBase` (con IVA); un producto sin facturas deja la receta incompleta.
- Cambiar el `RendimientoUnidad` de una sub-receta ya usada por otras recetas a otra familia dejaría líneas inválidas: el trigger lo bloquea (con prueba). La unidad base de un producto con facturas ya está bloqueada.
