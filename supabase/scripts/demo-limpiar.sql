-- Quita los datos de demostración cargados con demo-datos.sql y deja la base como estaba antes.
-- Se ejecuta en el SQL Editor de Supabase. Es una sola transacción: si algo falla o hay datos reales
-- mezclados con los de demostración, aborta y NO borra nada.
--
-- Qué considera "datos de demo" (nada más se toca):
--   productos : HAR01 AZU01 ACE01 ARR01 CAR01 POL01 QUE01 PAN01 BEB01 CER01 TOM01 CEB01 TMT01 LEC01 HUE01
--   facturas  : folios 3001 a 3007 de los proveedores 8, 45 y 55
--   solicitudes: las que incluyen productos de demo
--   recetas   : las vinculadas a un producto de Fudo 'DEMO-%'
--   ventas    : las de id 'DEMO-%'
-- Los productos que ya existían (P01 PAPAS, I01 JAMON, S01 SAL) se conservan: se devuelve su stock y se
-- vuelve su costo al de la última factura que no es de demo (o sin costo). Lo único que NO se revierte es el
-- stock mínimo y crítico de I01 (6000 y 3000), que demo-datos.sql fijó.

do $$
declare
  c_demo constant text[] := array['HAR01','AZU01','ACE01','ARR01','CAR01','POL01','QUE01','PAN01','BEB01','CER01','TOM01','CEB01','TMT01','LEC01','HUE01'];
  c_reales constant text[] := array['P01','I01','S01'];
  prod_ids bigint[];
  real_ids bigint[];
  compra_ids bigint[];
  sol_ids bigint[];
  rec_ids bigint[];
  v_central bigint;
  n int;
begin
  select coalesce(array_agg("IdProducto"), '{}') into prod_ids from "Productos" where "Codigo" = any(c_demo);
  select coalesce(array_agg("IdProducto"), '{}') into real_ids from "Productos" where "Codigo" = any(c_reales);
  select coalesce(array_agg("IdCompra"), '{}') into compra_ids from "Compras"
    where "Folio" between 3001 and 3007 and "IdProveedor" in (8, 45, 55);
  select coalesce(array_agg(distinct d."IdSolicitud"), '{}') into sol_ids from "SolicitudesDetalle" d where d."IdProducto" = any(prod_ids);
  select coalesce(array_agg("IdReceta"), '{}') into rec_ids from "Recetas" where "IdProductoFudo" like 'DEMO-%';
  select "IdBodega" into v_central from "Bodegas" where "EsCentral";

  if cardinality(prod_ids) = 0 and cardinality(compra_ids) = 0 and cardinality(rec_ids) = 0
     and not exists (select 1 from "VentasFudo" where "IdVentaFudo" like 'DEMO-%') then
    raise exception 'No hay datos de demostración que limpiar';
  end if;

  -- ===== Salvaguardas: abortar si hay datos reales ligados a los de demo =====
  select count(*) into n from "ComprasDetalle" d join "Compras" c on c."IdProveedor" = d."IdProveedor" and c."Folio" = d."Folio"
    where d."IdProducto" = any(prod_ids) and not (c."IdCompra" = any(compra_ids));
  if n > 0 then raise exception 'Abortado: % línea(s) de facturas reales usan productos de demo', n; end if;

  select count(*) into n from "SolicitudesDetalle" d where d."IdProducto" = any(prod_ids) and not (d."IdSolicitud" = any(sol_ids));
  if n > 0 then raise exception 'Abortado: % línea(s) de solicitudes reales usan productos de demo', n; end if;

  select count(*) into n from "RecetaDetalles" d where d."IdProducto" = any(prod_ids) and not (d."IdReceta" = any(rec_ids));
  if n > 0 then raise exception 'Abortado: % línea(s) de recetas reales usan productos de demo', n; end if;

  select count(*) into n from "RecetaDetalles" d where d."IdSubReceta" = any(rec_ids) and not (d."IdReceta" = any(rec_ids));
  if n > 0 then raise exception 'Abortado: % receta(s) reales usan recetas de demo como sub-receta', n; end if;

  select count(*) into n from "ConsumosVenta" c where c."IdProducto" = any(prod_ids) and c."IdVentaFudo" not like 'DEMO-%';
  if n > 0 then raise exception 'Abortado: % consumo(s) de ventas reales usan productos de demo', n; end if;

  select count(*) into n from "Solicitudes" s where s."IdSolicitud" = any(sol_ids) and s."IdUsuarioSolicitante" <> 35;
  if n > 0 then raise exception 'Abortado: % solicitud(es) de demo no son del usuario de demo', n; end if;

  -- ===== Devolver el stock y el costo de los productos que ya existían (P01, I01, S01) =====
  -- 1) lo que consumieron las ventas de demo
  update "StockBodega" s set "Cantidad" = s."Cantidad" + x.cant, "FechaModificacion" = now()
    from (select "IdBodega", "IdProducto", sum("Cantidad") cant from "ConsumosVenta"
           where "IdVentaFudo" like 'DEMO-%' and "IdProducto" = any(real_ids) group by 1, 2) x
   where s."IdBodega" = x."IdBodega" and s."IdProducto" = x."IdProducto";
  -- 2) lo que las solicitudes de demo movieron desde la Bodega Central
  update "StockBodega" s set "Cantidad" = s."Cantidad" - x.cant, "FechaModificacion" = now()
    from (select "IdBodegaDestino" b, "IdProducto" p, sum("Cantidad") cant from "MovimientosBodega"
           where "IdSolicitud" = any(sol_ids) and "IdProducto" = any(real_ids) group by 1, 2) x
   where s."IdBodega" = x.b and s."IdProducto" = x.p;
  update "StockBodega" s set "Cantidad" = s."Cantidad" + x.cant, "FechaModificacion" = now()
    from (select "IdProducto" p, sum("Cantidad") cant from "MovimientosBodega"
           where "IdSolicitud" = any(sol_ids) and "IdProducto" = any(real_ids) group by 1) x
   where s."IdBodega" = v_central and s."IdProducto" = x.p;
  -- 3) lo que entró por las facturas de demo
  update "StockBodega" s set "Cantidad" = s."Cantidad" - x.cant, "FechaModificacion" = now()
    from (select "IdProducto" p, sum("Cantidad") cant from "BodegaCentral" b
           join "Compras" c on c."IdProveedor" = b."IdProveedor" and c."Folio" = b."Folio"
           where c."IdCompra" = any(compra_ids) and b."IdProducto" = any(real_ids) group by 1) x
   where s."IdBodega" = v_central and s."IdProducto" = x.p;
  -- 4) costo: el de la última factura vigente que no es de demo, o sin costo
  update "Productos" p set "CostoUnitarioBase" = (
      select round(d."Precio" / u."Factor", 6)
        from "ComprasDetalle" d
        join "Compras" c on c."IdProveedor" = d."IdProveedor" and c."Folio" = d."Folio"
        join "UnidadesMedida" u on u."Codigo" = d."UnidadMedida"
       where d."IdProducto" = p."IdProducto" and c."IdEstado" = 1 and not (c."IdCompra" = any(compra_ids))
       order by c."IdCompra" desc limit 1)
   where p."IdProducto" = any(real_ids) and p."IdProducto" in (select d."IdProducto" from "ComprasDetalle" d
            join "Compras" c on c."IdProveedor" = d."IdProveedor" and c."Folio" = d."Folio" where c."IdCompra" = any(compra_ids));
  -- filas de stock en cero que solo existían por la demo
  delete from "StockBodega" where "IdProducto" = any(real_ids) and "Cantidad" = 0
    and ("IdBodega" <> v_central or "IdProducto" in (select "IdProducto" from "Productos" where "Codigo" in ('P01', 'I01')));

  -- ===== Borrado en orden de dependencias =====
  delete from "ConsumosVenta" where "IdVentaFudo" like 'DEMO-%';
  delete from "VentasFudoLineas" where "IdVentaFudo" like 'DEMO-%';
  delete from "VentasFudo" where "IdVentaFudo" like 'DEMO-%';
  delete from "RecetaDetalles" where "IdReceta" = any(rec_ids);
  delete from "Recetas" where "IdReceta" = any(rec_ids);
  delete from "MovimientosBodega" where "IdSolicitud" = any(sol_ids);
  delete from "HistorialSolicitudes" where "IdSolicitud" = any(sol_ids);
  delete from "SolicitudesDetalle" where "IdSolicitud" = any(sol_ids);
  delete from "Solicitudes" where "IdSolicitud" = any(sol_ids);
  delete from "StockBodega" where "IdProducto" = any(prod_ids);
  delete from "HistorialPreciosProducto" where "IdProducto" = any(prod_ids) or "IdCompra" = any(compra_ids);
  delete from "BodegaCentral" b using "Compras" c where c."IdCompra" = any(compra_ids) and c."IdProveedor" = b."IdProveedor" and c."Folio" = b."Folio";
  delete from "ComprasDetalle" d using "Compras" c where c."IdCompra" = any(compra_ids) and c."IdProveedor" = d."IdProveedor" and c."Folio" = d."Folio";
  delete from "Compras" where "IdCompra" = any(compra_ids);
  delete from "Productos" where "IdProducto" = any(prod_ids);

  if not exists (select 1 from "Solicitudes") then
    perform setval('seq_numero_solicitud', 1, false);
  end if;

  raise notice 'Limpieza de demo completa: % producto(s), % factura(s), % solicitud(es), % receta(s)',
    cardinality(prod_ids), cardinality(compra_ids), cardinality(sol_ids), cardinality(rec_ids);
end $$;
