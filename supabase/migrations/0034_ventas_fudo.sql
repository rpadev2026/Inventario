-- Ventas de Fudo que descuentan stock: cada venta cerrada rebaja, de la bodega de la receta vendida, los ingredientes de esa receta.
-- Una receta vinculada a un producto de Fudo (0033) indica además la bodega de la que se descuenta ("IdBodegaConsumo": cada bodega es un
-- tipo de preparación, p. ej. cuarto frío o cuarto caliente).

alter table "Recetas" add column "IdBodegaConsumo" bigint references "Bodegas"("IdBodega");

-- Reemplaza la función de la 0033: ahora el vínculo con Fudo exige la bodega de consumo (y desvincular la limpia).
drop function vincular_receta_fudo(bigint, bigint, text);
create or replace function vincular_receta_fudo(p_usuario bigint, p_receta bigint, p_fudo text, p_bodega bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_fudo text := nullif(btrim(coalesce(p_fudo, '')), '');
begin
  if v_fudo is not null and not exists (select 1 from "Bodegas" where "IdBodega" = p_bodega and "IdEstado" = 1) then
    raise exception 'Elija la bodega de la que se descuenta el stock';
  end if;
  update "Recetas" set "IdProductoFudo" = v_fudo, "IdBodegaConsumo" = case when v_fudo is null then null else p_bodega end,
                       "IdUsuarioModificacion" = p_usuario, "FechaRegistroModificacion" = now()
   where "IdReceta" = p_receta;
  if not found then raise exception 'La receta no existe'; end if;
exception when unique_violation then
  raise exception 'Ese producto de Fudo ya está vinculado a otra receta';
end $$;
revoke all on function vincular_receta_fudo(bigint, bigint, text, bigint) from public, anon, authenticated;
grant execute on function vincular_receta_fudo(bigint, bigint, text, bigint) to app_servidor;

-- El stock puede quedar negativo SOLO por una venta (ya ocurrió: no se puede rechazar). El resto de las operaciones siguen sin poder
-- dejarlo bajo cero: la restricción se reemplaza por un trigger con el mismo código de error (check_violation) que se salta solo
-- cuando la función de ventas lo pide dentro de su transacción.
alter table "StockBodega" drop constraint "StockBodega_Cantidad_check";
create or replace function validar_stock_no_negativo() returns trigger language plpgsql as $$
begin
  if new."Cantidad" < 0 and coalesce(current_setting('inventario.permitir_stock_negativo', true), '') <> 'on' then
    raise exception 'Stock insuficiente' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger stock_no_negativo before insert or update on "StockBodega" for each row execute function validar_stock_no_negativo();

-- Ventas ya procesadas (una sola vez cada una) y, por cada una, qué se descontó (sirve de auditoría y para revertir).
create table "VentasFudo" (
  "IdVentaFudo" text primary key,
  "FechaCierre" timestamptz not null,
  "FechaProceso" timestamptz not null default now(),
  -- Líneas vendidas que no descontaron nada: [{"producto","nombre","cantidad","motivo"}] (motivo: «sin receta» o «sin bodega»).
  "Omitidos" jsonb not null default '[]'::jsonb
);
create index ventasfudo_cierre on "VentasFudo"("FechaCierre" desc);
create table "ConsumosVenta" (
  "IdConsumo" bigint generated always as identity primary key,
  "IdVentaFudo" text not null references "VentasFudo"("IdVentaFudo"),
  "IdReceta" bigint not null references "Recetas"("IdReceta"),
  "IdBodega" bigint not null references "Bodegas"("IdBodega"),
  "IdProducto" bigint not null references "Productos"("IdProducto"),
  "Cantidad" numeric(14,3) not null check ("Cantidad" > 0)
);
create index consumosventa_venta on "ConsumosVenta"("IdVentaFudo");
do $$
declare t text;
begin
  foreach t in array array['VentasFudo', 'ConsumosVenta'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to app_servidor', t);
    execute format('create policy app_servidor_select on public.%I for select to app_servidor using (true)', t);
  end loop;
end $$;

-- Ingredientes (productos, en unidad base) que consume una receta: `p_factor` es cuántas veces se prepara la receta completa
-- (para vender N porciones, N / RendimientoPorciones). Las sub-recetas se expanden con la misma proporción que usa el costo:
-- lo que la línea usa (en unidad base) dividido por el rendimiento de la sub-receta (en unidad base).
create or replace function consumo_receta_n(p_receta bigint, p_factor numeric, p_nivel int)
returns table(id_producto bigint, cantidad numeric) language plpgsql stable security definer set search_path = public as $$
declare
  l record;
  v_base numeric;
  v_rend_base numeric;
begin
  if p_nivel > 20 then raise exception 'Receta demasiado anidada'; end if;
  for l in
    select d."IdProducto", d."IdSubReceta", d."Cantidad" * d."PorcionNeta" * (1 + d."PorcentajeMerma") * u."Factor" as base
    from "RecetaDetalles" d join "UnidadesMedida" u on u."Codigo" = d."UnidadMedida"
    where d."IdReceta" = p_receta order by d."IdDetalle"
  loop
    v_base := l.base * p_factor;
    if l."IdProducto" is not null then
      id_producto := l."IdProducto"; cantidad := v_base; return next;
    else
      select s."RendimientoCantidad" * ur."Factor" into v_rend_base
        from "Recetas" s join "UnidadesMedida" ur on ur."Codigo" = s."RendimientoUnidad" where s."IdReceta" = l."IdSubReceta";
      if v_rend_base is null or v_rend_base <= 0 then raise exception 'Una sub-receta no tiene rendimiento'; end if;
      return query select * from consumo_receta_n(l."IdSubReceta", v_base / v_rend_base, p_nivel + 1);
    end if;
  end loop;
end $$;
revoke all on function consumo_receta_n(bigint, numeric, int) from public, anon, authenticated;

-- Procesa una venta cerrada de Fudo: p_lineas = [{"producto": "<id Fudo>", "nombre": "...", "cantidad": n}] (sin las líneas anuladas).
-- Es idempotente por venta: si ya se procesó devuelve {"procesada": false} y no toca el stock. Devuelve {"procesada", "omitidos"}.
create or replace function procesar_venta_fudo(p_venta text, p_cierre timestamptz, p_lineas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  l jsonb;
  r record;
  c record;
  v_ok boolean;
  v_cant numeric;
  v_omitidos jsonb := '[]'::jsonb;
begin
  if coalesce(btrim(p_venta), '') = '' or p_cierre is null then raise exception 'Venta inválida'; end if;
  insert into "VentasFudo"("IdVentaFudo", "FechaCierre") values (p_venta, p_cierre) on conflict do nothing;
  if not found then return jsonb_build_object('procesada', false, 'omitidos', '[]'::jsonb); end if;

  for l in select * from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) loop
    v_cant := (l->>'cantidad')::numeric;
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
