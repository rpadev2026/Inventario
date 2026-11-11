-- Ventas de Fudo: filtros por fecha de venta (día de Chile), producto y motivo; detalle de cada venta y datos para exportar.
-- Filtros comunes: p_desde/p_hasta (fechas de Chile, null = sin límite), p_q (texto del nombre del producto vendido, sin tildes ni mayúsculas)
-- y p_motivo ('sin receta' | 'sin bodega' | vacío = todos; filtra las ventas que tienen líneas omitidas por ese motivo).

-- Ventas que cumplen los filtros (auxiliar: no la llama la aplicación).
create or replace function ventas_fudo_filtradas(p_desde date, p_hasta date, p_q text, p_motivo text)
returns setof "VentasFudo" language sql stable security definer set search_path = public as $$
  select v.* from "VentasFudo" v
   where (p_desde is null or (v."FechaCierre" at time zone 'America/Santiago')::date >= p_desde)
     and (p_hasta is null or (v."FechaCierre" at time zone 'America/Santiago')::date <= p_hasta)
     and (coalesce(btrim(p_q), '') = '' or exists (
           select 1 from "VentasFudoLineas" l
            where l."IdVentaFudo" = v."IdVentaFudo" and position(normalizar_busqueda(p_q) in normalizar_busqueda(l."Nombre")) > 0))
     and (coalesce(p_motivo, '') = '' or exists (
           select 1 from jsonb_array_elements(v."Omitidos") e where e->>'motivo' = p_motivo));
$$;
revoke all on function ventas_fudo_filtradas(date, date, text, text) from public, anon, authenticated;

-- Reemplaza la versión sin filtros de 0043.
drop function if exists faltantes_ventas_fudo(int, int);
-- Lo vendido que no descontó nada, sumado por producto de Fudo (nombre y motivo de la venta más reciente), con filtros y paginado.
-- Devuelve {total, filas: [{producto, nombre, motivo, cantidad}]}.
create or replace function faltantes_ventas_fudo(p_desde date, p_hasta date, p_q text, p_motivo text, p_off int, p_lim int)
returns jsonb language sql stable security definer set search_path = public as $$
  with o as (
    select e->>'producto' as prod, e->>'nombre' as nom, e->>'motivo' as mot, (e->>'cantidad')::numeric as cant, v."FechaCierre" as fc
      from "VentasFudo" v cross join lateral jsonb_array_elements(v."Omitidos") e
     where (p_desde is null or (v."FechaCierre" at time zone 'America/Santiago')::date >= p_desde)
       and (p_hasta is null or (v."FechaCierre" at time zone 'America/Santiago')::date <= p_hasta)
       and (coalesce(p_motivo, '') = '' or e->>'motivo' = p_motivo)
       and (coalesce(btrim(p_q), '') = '' or position(normalizar_busqueda(p_q) in normalizar_busqueda(coalesce(e->>'nombre', ''))) > 0)
  ), g as (
    select prod, (array_agg(nom order by fc desc))[1] as nombre, (array_agg(mot order by fc desc))[1] as motivo, sum(cant) as cantidad
      from o group by prod
  )
  select jsonb_build_object(
    'total', (select count(*) from g),
    'filas', coalesce((select jsonb_agg(jsonb_build_object('producto', x.prod, 'nombre', x.nombre, 'motivo', x.motivo, 'cantidad', x.cantidad) order by x.cantidad desc, x.nombre, x.prod)
                       from (select * from g order by cantidad desc, nombre, prod
                              offset greatest(coalesce(p_off, 0), 0) limit least(greatest(coalesce(p_lim, 10), 0), 100000)) x), '[]'::jsonb));
$$;

-- Una página de ventas con su detalle: las líneas vendidas (producto, cantidad, monto, receta y si descontó) y los ingredientes
-- que se descontaron del stock (por producto y bodega, en unidad base). Las ventas anteriores a la migración 0042 no tienen líneas.
-- Devuelve {total, filas: [{id, cierre, proceso, unidades, monto, lineas: [...], consumos: [...]}]}.
create or replace function listar_ventas_fudo(p_desde date, p_hasta date, p_q text, p_motivo text, p_off int, p_lim int)
returns jsonb language sql stable security definer set search_path = public as $$
  with f as (select * from ventas_fudo_filtradas(p_desde, p_hasta, p_q, p_motivo)),
  pag as (
    select * from f order by "FechaCierre" desc, "IdVentaFudo" desc
    offset greatest(coalesce(p_off, 0), 0) limit least(greatest(coalesce(p_lim, 10), 1), 200)
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', pag."IdVentaFudo", 'cierre', pag."FechaCierre", 'proceso', pag."FechaProceso",
      'unidades', (select coalesce(sum(l."Cantidad"), 0) from "VentasFudoLineas" l where l."IdVentaFudo" = pag."IdVentaFudo"),
      'monto', (select case when count(l."Monto") = 0 then null else sum(l."Monto") end from "VentasFudoLineas" l where l."IdVentaFudo" = pag."IdVentaFudo"),
      'lineas', (select coalesce(jsonb_agg(jsonb_build_object(
                    'producto', l."IdProductoFudo", 'nombre', l."Nombre", 'cantidad', l."Cantidad", 'monto', l."Monto", 'receta', r."Nombre",
                    'estado', coalesce((select e->>'motivo' from jsonb_array_elements(pag."Omitidos") e where e->>'producto' = l."IdProductoFudo" limit 1), 'descontó')
                  ) order by l."IdLinea"), '[]'::jsonb)
                   from "VentasFudoLineas" l left join "Recetas" r on r."IdProductoFudo" = l."IdProductoFudo" where l."IdVentaFudo" = pag."IdVentaFudo"),
      'consumos', (select coalesce(jsonb_agg(jsonb_build_object('producto', x.producto, 'bodega', x.bodega, 'cantidad', x.cantidad, 'unidad', x.unidad) order by x.producto, x.bodega), '[]'::jsonb)
                    from (select etiqueta_producto(c."IdProducto") as producto, b."NombreBodega" as bodega, sum(c."Cantidad") as cantidad, p."UnidadBase" as unidad
                            from "ConsumosVenta" c join "Productos" p on p."IdProducto" = c."IdProducto" join "Bodegas" b on b."IdBodega" = c."IdBodega"
                           where c."IdVentaFudo" = pag."IdVentaFudo" group by c."IdProducto", b."NombreBodega", p."UnidadBase") x)
    ) order by pag."FechaCierre" desc, pag."IdVentaFudo" desc) from pag), '[]'::jsonb));
$$;

-- Una fila por línea vendida de las ventas filtradas (si hay texto de producto, solo las líneas de ese producto), hasta 50.000.
-- Devuelve {truncado, filas: [{venta, cierre, producto, nombre, cantidad, monto, receta, estado}]}.
create or replace function exportar_ventas_fudo(p_desde date, p_hasta date, p_q text, p_motivo text)
returns jsonb language sql stable security definer set search_path = public as $$
  with lin as (
    select v."IdVentaFudo" as venta, v."FechaCierre" as cierre, l."IdLinea" as idl, l."IdProductoFudo" as producto, l."Nombre" as nombre,
           l."Cantidad" as cantidad, l."Monto" as monto, r."Nombre" as receta,
           coalesce((select e->>'motivo' from jsonb_array_elements(v."Omitidos") e where e->>'producto' = l."IdProductoFudo" limit 1), 'descontó') as estado
      from ventas_fudo_filtradas(p_desde, p_hasta, p_q, p_motivo) v
      join "VentasFudoLineas" l on l."IdVentaFudo" = v."IdVentaFudo"
      left join "Recetas" r on r."IdProductoFudo" = l."IdProductoFudo"
     where coalesce(btrim(p_q), '') = '' or position(normalizar_busqueda(p_q) in normalizar_busqueda(l."Nombre")) > 0
     order by v."FechaCierre" desc, v."IdVentaFudo" desc, l."IdLinea"
     limit 50001
  )
  select jsonb_build_object(
    'truncado', (select count(*) > 50000 from lin),
    'filas', coalesce((select jsonb_agg(jsonb_build_object('venta', t.venta, 'cierre', t.cierre, 'producto', t.producto, 'nombre', t.nombre,
                        'cantidad', t.cantidad, 'monto', t.monto, 'receta', t.receta, 'estado', t.estado) order by t.cierre desc, t.venta desc, t.idl)
                       from (select * from lin order by cierre desc, venta desc, idl limit 50000) t), '[]'::jsonb));
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'faltantes_ventas_fudo(date, date, text, text, int, int)', 'listar_ventas_fudo(date, date, text, text, int, int)',
    'exportar_ventas_fudo(date, date, text, text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to app_servidor', f);
  end loop;
end $$;
