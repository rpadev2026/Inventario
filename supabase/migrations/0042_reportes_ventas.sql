-- Reportes de ventas de Fudo: se guarda cada línea vendida (producto, cantidad y monto) y dos reportes sobre ellas.
-- Hasta ahora solo se guardaba la venta y lo que descontó del stock; sin las líneas no se puede saber qué se vendió. Las ventas procesadas
-- antes de esta migración no tienen líneas (cuando se escribió no había ventas reales procesadas todavía).

create table "VentasFudoLineas" (
  "IdLinea" bigint generated always as identity primary key,
  "IdVentaFudo" text not null references "VentasFudo"("IdVentaFudo"),
  "IdProductoFudo" text not null,
  "Nombre" text not null,
  "Cantidad" numeric(14,3) not null check ("Cantidad" > 0),
  -- precio × cantidad que informa Fudo (null si no lo informó); descuentos o propinas de la venta completa no se reparten entre líneas
  "Monto" numeric(14,2) check ("Monto" is null or "Monto" >= 0)
);
create index ventasfudolineas_venta on "VentasFudoLineas"("IdVentaFudo");
create index ventasfudolineas_producto on "VentasFudoLineas"("IdProductoFudo");
alter table public."VentasFudoLineas" enable row level security;
revoke all on public."VentasFudoLineas" from anon, authenticated;
grant select on public."VentasFudoLineas" to app_servidor;
create policy app_servidor_select on public."VentasFudoLineas" for select to app_servidor using (true);

-- procesar_venta_fudo (0034) + guarda cada línea vendida, tenga o no receta vinculada (una venta sin receta igual es una venta).
-- p_lineas = [{"producto": "<id Fudo>", "nombre": "...", "cantidad": n, "monto": n | null}]
create or replace function procesar_venta_fudo(p_venta text, p_cierre timestamptz, p_lineas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l jsonb;
  r record;
  c record;
  v_ok boolean;
  v_cant numeric;
  v_monto numeric;
  v_omitidos jsonb := '[]'::jsonb;
begin
  if coalesce(btrim(p_venta), '') = '' or p_cierre is null then raise exception 'Venta inválida'; end if;
  insert into "VentasFudo"("IdVentaFudo", "FechaCierre") values (p_venta, p_cierre) on conflict do nothing;
  if not found then return jsonb_build_object('procesada', false, 'omitidos', '[]'::jsonb); end if;

  for l in select * from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) loop
    v_cant := (l->>'cantidad')::numeric;
    v_monto := nullif(btrim(coalesce(l->>'monto', '')), '')::numeric;
    if v_cant > 0 then
      insert into "VentasFudoLineas"("IdVentaFudo", "IdProductoFudo", "Nombre", "Cantidad", "Monto")
      values (p_venta, l->>'producto', coalesce(nullif(btrim(l->>'nombre'), ''), l->>'producto'), v_cant, case when v_monto >= 0 then v_monto end);
    end if;
    select "IdReceta", "IdBodegaConsumo", "RendimientoPorciones" into r from "Recetas" where "IdProductoFudo" = l->>'producto';
    v_ok := found;
    if not v_ok or r."IdBodegaConsumo" is null then
      v_omitidos := v_omitidos || jsonb_build_array(jsonb_build_object(
        'producto', l->>'producto', 'nombre', l->>'nombre', 'cantidad', v_cant, 'motivo', case when v_ok then 'sin bodega' else 'sin receta' end));
      continue;
    end if;
    insert into "ConsumosVenta"("IdVentaFudo", "IdReceta", "IdBodega", "IdProducto", "Cantidad")
    select p_venta, r."IdReceta", r."IdBodegaConsumo", x.id_producto, round(sum(x.cantidad), 3)
      from consumo_receta_n(r."IdReceta", v_cant / r."RendimientoPorciones", 0) x
     group by x.id_producto having round(sum(x.cantidad), 3) > 0;
  end loop;

  -- Descuento (por bodega y producto en orden fijo, como el resto de funciones de stock); puede dejarlo negativo.
  perform set_config('inventario.permitir_stock_negativo', 'on', true);
  for c in select "IdBodega", "IdProducto", sum("Cantidad") as cant from "ConsumosVenta" where "IdVentaFudo" = p_venta group by 1, 2 order by 1, 2 loop
    insert into "StockBodega"("IdBodega", "IdProducto", "Cantidad") values (c."IdBodega", c."IdProducto", -c.cant)
    on conflict ("IdBodega", "IdProducto") do update set "Cantidad" = "StockBodega"."Cantidad" - c.cant, "FechaModificacion" = now();
  end loop;
  perform set_config('inventario.permitir_stock_negativo', '', true);

  update "VentasFudo" set "Omitidos" = v_omitidos where "IdVentaFudo" = p_venta;
  return jsonb_build_object('procesada', true, 'omitidos', v_omitidos);
end $$;
revoke all on function procesar_venta_fudo(text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function procesar_venta_fudo(text, timestamptz, jsonb) to app_servidor;

-- Las fechas de los reportes son fechas de Chile: una venta cerrada a las 22:30 del 5 (hora de Chile) cuenta el 5 aunque en UTC sea el 6.
-- Resumen de ventas por producto (el de Fudo) entre dos fechas inclusive. `receta` es la receta vinculada a ese producto de Fudo, si hay.
--   Devuelve {total, ventas, unidades, monto, lineasSinMonto, filas: [...]} (los totales no dependen de la página pedida).
create or replace function reporte_ventas_producto(p_desde date, p_hasta date, p_q text, p_off int, p_lim int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := normalizar_busqueda(coalesce(p_q, ''));
  v_off int := greatest(coalesce(p_off, 0), 0);
  v_lim int := least(greatest(coalesce(p_lim, 50), 1), 100000);
begin
  if p_desde is null or p_hasta is null then raise exception 'Indique el rango de fechas'; end if;
  if p_desde > p_hasta then raise exception 'La fecha inicial no puede ser posterior a la final'; end if;
  return (
    with lin as (
      select l."IdVentaFudo", l."IdProductoFudo", l."Nombre", l."Cantidad", l."Monto", v."FechaCierre"
        from "VentasFudoLineas" l join "VentasFudo" v on v."IdVentaFudo" = l."IdVentaFudo"
       where (v."FechaCierre" at time zone 'America/Santiago')::date between p_desde and p_hasta
         and (v_q = '' or position(v_q in normalizar_busqueda(l."Nombre")) > 0)
    ), prod as (
      select "IdProductoFudo", (array_agg("Nombre" order by "FechaCierre" desc))[1] as nombre,
             sum("Cantidad") as unidades, case when count("Monto") = 0 then null else sum("Monto") end as monto,
             count(distinct "IdVentaFudo") as ventas, count(*) filter (where "Monto" is null) as sin_monto
        from lin group by "IdProductoFudo"
    )
    select jsonb_build_object(
      'total', (select count(*) from prod),
      'ventas', (select count(distinct "IdVentaFudo") from lin),
      'unidades', (select coalesce(sum("Cantidad"), 0) from lin),
      'monto', (select coalesce(sum("Monto"), 0) from lin),
      'lineasSinMonto', (select count(*) from lin where "Monto" is null),
      'filas', (select coalesce(jsonb_agg(jsonb_build_object(
                  'idProductoFudo', f."IdProductoFudo", 'producto', f.nombre, 'unidades', f.unidades, 'monto', f.monto,
                  'ventas', f.ventas, 'sinMonto', f.sin_monto, 'receta', f.receta) order by f.unidades desc, f.nombre), '[]'::jsonb)
                  from (select p.*, r."Nombre" as receta from prod p left join "Recetas" r on r."IdProductoFudo" = p."IdProductoFudo"
                         order by p.unidades desc, p.nombre offset v_off limit v_lim) f)
    )
  );
end $$;
revoke all on function reporte_ventas_producto(date, date, text, int, int) from public, anon, authenticated;
grant execute on function reporte_ventas_producto(date, date, text, int, int) to app_servidor;

-- Ventas por período entre dos fechas inclusive, agrupadas por día, semana (de lunes a domingo) o mes; los períodos sin ventas salen en cero y
-- los de los extremos son parciales (solo cuentan los días del rango). `ventas` = ventas cerradas (tickets), `unidades` y `monto` = suma de sus líneas.
--   p_agrupar: 'dia' | 'semana' | 'mes' · Devuelve {ventas, unidades, monto, lineasSinMonto, filas: [{periodo, ventas, unidades, monto}]}
create or replace function reporte_ventas_periodo(p_desde date, p_hasta date, p_agrupar text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_ini date;
  v_paso interval;
begin
  if p_desde is null or p_hasta is null then raise exception 'Indique el rango de fechas'; end if;
  if p_desde > p_hasta then raise exception 'La fecha inicial no puede ser posterior a la final'; end if;
  if p_hasta - p_desde > 1830 then raise exception 'El rango no puede superar 5 años'; end if;
  if p_agrupar not in ('dia', 'semana', 'mes') then raise exception 'Agrupación no válida'; end if;
  v_ini := case p_agrupar when 'dia' then p_desde when 'semana' then date_trunc('week', p_desde)::date else date_trunc('month', p_desde)::date end;
  v_paso := case p_agrupar when 'dia' then interval '1 day' when 'semana' then interval '7 days' else interval '1 month' end;
  return (
    with v as (
      select v."IdVentaFudo", (v."FechaCierre" at time zone 'America/Santiago')::date as dia
        from "VentasFudo" v
       where (v."FechaCierre" at time zone 'America/Santiago')::date between p_desde and p_hasta
    ), vp as (
      select v.*, case p_agrupar when 'dia' then v.dia when 'semana' then date_trunc('week', v.dia)::date else date_trunc('month', v.dia)::date end as periodo from v
    ), agr as (
      select vp.periodo, count(distinct vp."IdVentaFudo") as ventas, coalesce(sum(l."Cantidad"), 0) as unidades, coalesce(sum(l."Monto"), 0) as monto
        from vp left join "VentasFudoLineas" l on l."IdVentaFudo" = vp."IdVentaFudo" group by vp.periodo
    )
    select jsonb_build_object(
      'ventas', (select count(*) from v),
      'unidades', (select coalesce(sum(l."Cantidad"), 0) from v join "VentasFudoLineas" l on l."IdVentaFudo" = v."IdVentaFudo"),
      'monto', (select coalesce(sum(l."Monto"), 0) from v join "VentasFudoLineas" l on l."IdVentaFudo" = v."IdVentaFudo"),
      'lineasSinMonto', (select count(*) from v join "VentasFudoLineas" l on l."IdVentaFudo" = v."IdVentaFudo" where l."Monto" is null),
      'filas', (select jsonb_agg(jsonb_build_object('periodo', s.p, 'ventas', coalesce(a.ventas, 0), 'unidades', coalesce(a.unidades, 0), 'monto', coalesce(a.monto, 0)) order by s.p)
                  from (select g::date as p from generate_series(v_ini, p_hasta, v_paso) g) s left join agr a on a.periodo = s.p)
    )
  );
end $$;
revoke all on function reporte_ventas_periodo(date, date, text) from public, anon, authenticated;
grant execute on function reporte_ventas_periodo(date, date, text) to app_servidor;
