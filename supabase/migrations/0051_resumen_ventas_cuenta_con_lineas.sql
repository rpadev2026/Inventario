-- «Ventas» del resumen de /ventas-fudo cuenta las ventas que tienen productos (las que Fudo informa): las ventas cerradas vacías (total 0, sin
-- líneas vigentes) también se procesan, pero Fudo no las cuenta y no aportan nada.
create or replace function resumen_ventas_fudo(p_desde date, p_hasta date, p_q text, p_motivo text)
returns jsonb language sql stable security definer set search_path = public as $$
  with v as (select "IdVentaFudo" from ventas_fudo_filtradas(p_desde, p_hasta, p_q, p_motivo)),
  l as (
    select l."IdVentaFudo", l."IdProductoFudo", l."Cantidad", l."Monto"
      from "VentasFudoLineas" l join v on v."IdVentaFudo" = l."IdVentaFudo"
     where coalesce(btrim(p_q), '') = '' or position(normalizar_busqueda(p_q) in normalizar_busqueda(l."Nombre")) > 0
  )
  select jsonb_build_object(
    'ventas', (select count(distinct "IdVentaFudo") from l),
    'unidades', (select coalesce(sum("Cantidad"), 0) from l),
    'monto', (select coalesce(sum("Monto"), 0) from l),
    'productos', (select count(distinct "IdProductoFudo") from l),
    'lineasSinMonto', (select count(*) from l where "Monto" is null));
$$;
