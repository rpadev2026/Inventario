-- Reportes: permiso `reportes.ver` y el reporte de stock actual por producto y bodega, valorizado.
insert into "Permisos"("Codigo","Modulo","Descripcion","Orden") values
  ('reportes.ver','Reportes','Ver reportes de stock valorizado y de ventas',15);
-- El rol base Compras lo recibe (los demás roles se asignan desde la matriz de roles; el Administrador los tiene todos).
insert into "RolesPermisos"("IdRol","Permiso")
select r."IdRol", 'reportes.ver' from "Roles" r where r."NombreRol" = 'Compras'
on conflict do nothing;

-- Stock actual por producto y bodega (un producto puede estar en varias bodegas), con su valor: cantidad en unidad base × costo
-- unitario base (último precio de factura, con IVA). Un producto sin costo no tiene valor (null) y se cuenta aparte, así el total
-- se muestra como parcial en vez de contarlo como cero. El stock puede ser negativo (ventas de Fudo): su valor también.
--   p_bodega: una bodega o null (todas) · p_q: código o nombre (sin tildes ni mayúsculas) · p_solo_con_stock: oculta cantidad 0
-- Devuelve {total, valorTotal, sinCosto, porBodega: [...], filas: [...]} (los totales no dependen de la página pedida).
create or replace function reporte_stock(p_bodega bigint, p_q text, p_solo_con_stock boolean, p_off int, p_lim int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := normalizar_busqueda(coalesce(p_q, ''));
  v_off int := greatest(coalesce(p_off, 0), 0);
  v_lim int := least(greatest(coalesce(p_lim, 50), 1), 100000);
begin
  return (
    with base as (
      select s."IdBodega", b."NombreBodega", s."IdProducto", p."Codigo", p."Nombre", p."UnidadBase", u."Nombre" as "NombreUnidad",
             s."Cantidad", p."CostoUnitarioBase" as costo,
             case when p."CostoUnitarioBase" is null then null else round(s."Cantidad" * p."CostoUnitarioBase", 2) end as valor
        from "StockBodega" s
        join "Bodegas" b on b."IdBodega" = s."IdBodega"
        join "Productos" p on p."IdProducto" = s."IdProducto"
        join "UnidadesMedida" u on u."Codigo" = p."UnidadBase"
       where (p_bodega is null or s."IdBodega" = p_bodega)
         and (v_q = '' or position(v_q in normalizar_busqueda(coalesce(p."Codigo", '') || ' ' || p."Nombre")) > 0)
         and (not coalesce(p_solo_con_stock, false) or s."Cantidad" <> 0)
    )
    select jsonb_build_object(
      'total', (select count(*) from base),
      'valorTotal', (select coalesce(sum(valor), 0) from base),
      'sinCosto', (select count(*) from base where costo is null and "Cantidad" <> 0),
      'porBodega', (select coalesce(jsonb_agg(jsonb_build_object('idBodega', x."IdBodega", 'bodega', x."NombreBodega", 'filas', x.n, 'valor', x.v)
                                              order by x."NombreBodega"), '[]'::jsonb)
                      from (select "IdBodega", "NombreBodega", count(*) n, coalesce(sum(valor), 0) v from base group by "IdBodega", "NombreBodega") x),
      'filas', (select coalesce(jsonb_agg(jsonb_build_object(
                  'idBodega', f."IdBodega", 'bodega', f."NombreBodega", 'idProducto', f."IdProducto", 'codigo', f."Codigo", 'producto', f."Nombre",
                  'unidad', f."NombreUnidad", 'cantidad', f."Cantidad", 'costo', f.costo, 'valor', f.valor) order by f."Nombre", f."NombreBodega"), '[]'::jsonb)
                  from (select * from base order by "Nombre", "NombreBodega" offset v_off limit v_lim) f)
    )
  );
end $$;
revoke all on function reporte_stock(bigint, text, boolean, int, int) from public, anon, authenticated;
grant execute on function reporte_stock(bigint, text, boolean, int, int) to app_servidor;
