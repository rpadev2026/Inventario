-- Resumen de las ventas de Fudo que cumplen los MISMOS filtros que las tablas de la pantalla (fecha de Chile, producto y motivo):
-- así el resumen y las tablas siempre coinciden, y sin ventas todo sale en 0.
-- Con texto de producto solo cuentan las líneas de ese producto (como la exportación); sin él, todas las líneas de las ventas filtradas.
-- Devuelve {ventas, unidades, monto, productos, lineasSinMonto}.
create or replace function resumen_ventas_fudo(p_desde date, p_hasta date, p_q text, p_motivo text)
returns jsonb language sql stable security definer set search_path = public as $$
  with v as (select "IdVentaFudo" from ventas_fudo_filtradas(p_desde, p_hasta, p_q, p_motivo)),
  l as (
    select l."IdProductoFudo", l."Cantidad", l."Monto"
      from "VentasFudoLineas" l join v on v."IdVentaFudo" = l."IdVentaFudo"
     where coalesce(btrim(p_q), '') = '' or position(normalizar_busqueda(p_q) in normalizar_busqueda(l."Nombre")) > 0
  )
  select jsonb_build_object(
    'ventas', (select count(*) from v),
    'unidades', (select coalesce(sum("Cantidad"), 0) from l),
    'monto', (select coalesce(sum("Monto"), 0) from l),
    'productos', (select count(distinct "IdProductoFudo") from l),
    'lineasSinMonto', (select count(*) from l where "Monto" is null));
$$;
revoke all on function resumen_ventas_fudo(date, date, text, text) from public, anon, authenticated;
grant execute on function resumen_ventas_fudo(date, date, text, text) to app_servidor;
