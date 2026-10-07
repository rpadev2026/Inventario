-- Endurece la 0016: (1) una unidad que es base de productos o unidades vigentes no se puede desactivar
-- (evita productos facturables con una unidad base no vigente); (2) registrar_factura y anular_factura bloquean
-- las filas de los productos involucrados (costo, historial y unidad base consistentes bajo concurrencia).
create or replace function validar_unidad_medida() returns trigger
language plpgsql set search_path = public as $$
begin
  if new."UnidadBase" <> new."Codigo" and not exists (
    select 1 from "UnidadesMedida" b where b."Codigo" = new."UnidadBase" and b."UnidadBase" = b."Codigo" and b."Factor" = 1) then
    raise exception 'La unidad base debe ser una unidad base (factor 1)';
  end if;
  if tg_op = 'UPDATE' then
    if (new."UnidadBase" <> old."UnidadBase" or new."Factor" <> old."Factor")
       and (exists (select 1 from "Productos" p where p."UnidadBase" = old."Codigo")
         or exists (select 1 from "ComprasDetalle" d where d."UnidadMedida" = old."Codigo")) then
      raise exception 'No se puede cambiar la unidad base ni el factor: hay productos o facturas que usan esta unidad';
    end if;
    -- una unidad que es base de productos o unidades vigentes no se desactiva (la factura y el stock la necesitan)
    if old."IdEstado" = 1 and new."IdEstado" = 0
       and (exists (select 1 from "Productos" p where p."UnidadBase" = old."Codigo" and p."IdEstado" = 1)
         or exists (select 1 from "UnidadesMedida" u where u."UnidadBase" = old."Codigo" and u."Codigo" <> old."Codigo" and u."IdEstado" = 1)) then
      raise exception 'No se puede desactivar: hay productos o unidades vigentes que usan esta unidad como base';
    end if;
    if old."UnidadBase" = old."Codigo" and new."UnidadBase" <> new."Codigo"
       and exists (select 1 from "UnidadesMedida" u where u."UnidadBase" = old."Codigo" and u."Codigo" <> old."Codigo") then
      raise exception 'No se puede cambiar: otras unidades usan esta como unidad base';
    end if;
  end if;
  return new;
end $$;

create or replace function registrar_factura(
  p_usuario bigint, p_proveedor bigint, p_folio bigint,
  p_fecha_factura date, p_fecha_recepcion date, p_forma_pago text,
  p_neto numeric, p_iva numeric, p_total numeric, p_detalle jsonb
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_prov "Proveedores"%rowtype;
  v_central bigint;
  v_id bigint;
  d jsonb;
  v_prod bigint;
  v_base text;
  v_ant numeric;
  v_unidad text;
  v_ub text;
  v_factor numeric;
  v_cant_base numeric;
  v_costo numeric;
  v_precio numeric;
  v_suma numeric := 0;
begin
  if p_fecha_recepcion < p_fecha_factura then
    raise exception 'La fecha de recepción no puede ser anterior a la fecha de factura'; end if;
  if not exists (select 1 from "FormasPago" where "Codigo" = p_forma_pago and "IdEstado" = 1) then
    raise exception 'Forma de pago no existe o no vigente'; end if;
  select * into v_prov from "Proveedores" where "IdProveedor" = p_proveedor and "IdEstado" = 1;
  if not found then raise exception 'Proveedor no existe o no vigente'; end if;
  if jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La factura debe tener detalle'; end if;
  select "IdBodega" into v_central from "Bodegas" where "EsCentral" and "IdEstado" = 1;
  if v_central is null then raise exception 'No existe Bodega Central'; end if;

  -- bloquea los productos de la factura (en orden de id, sin interbloqueos entre facturas): el costo anterior,
  -- el historial y el chequeo de la unidad base se leen sobre filas que nadie más modifica a la vez
  perform 1 from "Productos"
    where "IdProducto" in (select producto_de_item(x) from jsonb_array_elements(p_detalle) x)
    order by "IdProducto" for update;

  for d in select * from jsonb_array_elements(p_detalle) loop
    v_suma := v_suma + round((d->>'precio')::numeric * (d->>'cantidad')::numeric, 2);
  end loop;
  -- el precio de cada línea ya incluye IVA: el detalle debe sumar el total (neto e IVA se derivan de él)
  if abs(v_suma - p_total) > 1 then raise exception 'La suma del detalle no coincide con el total'; end if;

  insert into "Compras"("IdProveedor","RutProveedor","NombreProveedor","GiroProveedor","Folio",
    "FechaFactura","FechaRecepcion","FormaPago","Neto","Iva","Total","IdUsuarioCreacion","IdUsuarioModificacion")
  values (p_proveedor, v_prov."Rut", v_prov."RazonSocial", v_prov."Giro", p_folio,
    p_fecha_factura, p_fecha_recepcion, p_forma_pago, p_neto, p_iva, p_total, p_usuario, p_usuario)
  returning "IdCompra" into v_id;

  for d in select * from jsonb_array_elements(p_detalle) loop
    v_prod := producto_de_item(d);
    select "UnidadBase", "CostoUnitarioBase" into v_base, v_ant from "Productos" where "IdProducto" = v_prod and "IdEstado" = 1;
    if not found then raise exception 'Producto % no existe o no vigente', etiqueta_producto(v_prod); end if;

    v_unidad := d->>'unidad';
    select "UnidadBase", "Factor" into v_ub, v_factor from "UnidadesMedida" where "Codigo" = v_unidad and "IdEstado" = 1;
    if not found then raise exception 'Unidad de medida % no existe o no vigente', coalesce(v_unidad, ''); end if;
    if v_ub <> v_base then
      raise exception 'La unidad % no es compatible con la unidad base % de %', v_unidad, v_base, etiqueta_producto(v_prod); end if;

    v_cant_base := round((d->>'cantidad')::numeric * v_factor, 3);
    if v_cant_base <= 0 then
      raise exception 'La cantidad es demasiado pequeña para la unidad base de %', etiqueta_producto(v_prod); end if;
    v_precio := (d->>'precio')::numeric;

    insert into "ComprasDetalle"("IdProveedor","Folio","IdProducto","UnidadMedida","Precio","Cantidad","Total")
    values (p_proveedor, p_folio, v_prod, v_unidad, v_precio, (d->>'cantidad')::numeric,
            round(v_precio * (d->>'cantidad')::numeric, 2));
    insert into "BodegaCentral"("IdProducto","Cantidad","FechaIngreso","IdProveedor","Folio","IdUsuarioCreacion","IdUsuarioModificacion")
    values (v_prod, v_cant_base, p_fecha_recepcion, p_proveedor, p_folio, p_usuario, p_usuario);
    insert into "StockBodega"("IdBodega","IdProducto","Cantidad")
    values (v_central, v_prod, v_cant_base)
    on conflict ("IdBodega","IdProducto")
    do update set "Cantidad" = "StockBodega"."Cantidad" + excluded."Cantidad", "FechaModificacion" = now();

    -- costo unitario base (con IVA): el precio de la línea llevado a la unidad base
    v_costo := round(v_precio / v_factor, 6);
    if v_ant is distinct from v_costo then
      update "Productos" set "CostoUnitarioBase" = v_costo, "IdUsuarioModificacion" = p_usuario where "IdProducto" = v_prod;
      insert into "HistorialPreciosProducto"("IdProducto","IdCompra","Origen","Precio","UnidadMedida","CostoBaseAnterior","CostoBaseNuevo","IdUsuario")
      values (v_prod, v_id, 'Compra', v_precio, v_unidad, v_ant, v_costo, p_usuario);
    end if;
  end loop;
  return v_id;
end $$;

create or replace function anular_factura(p_usuario bigint, p_compra bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_c "Compras"%rowtype; v_central bigint; r record; v_prod bigint;
  v_ant numeric; v_nuevo numeric; v_precio numeric; v_um text;
begin
  if coalesce(length(trim(p_motivo)),0) < 5 then raise exception 'Indique el motivo de anulación'; end if;
  select * into v_c from "Compras" where "IdCompra" = p_compra for update;
  if not found then raise exception 'Factura no existe'; end if;
  if v_c."IdEstado" = 0 then raise exception 'La factura ya está anulada'; end if;
  select "IdBodega" into v_central from "Bodegas" where "EsCentral";

  -- bloquea los productos de la factura antes de revertir stock y recalcular el costo
  perform 1 from "Productos"
    where "IdProducto" in (select "IdProducto" from "ComprasDetalle" where "IdProveedor" = v_c."IdProveedor" and "Folio" = v_c."Folio")
    order by "IdProducto" for update;

  for r in select b."IdProducto", p."Nombre", sum(b."Cantidad") as cant
           from "BodegaCentral" b join "Productos" p using ("IdProducto")
           where b."IdProveedor" = v_c."IdProveedor" and b."Folio" = v_c."Folio" and not b."Anulado"
           group by b."IdProducto", p."Nombre" loop
    update "StockBodega" set "Cantidad" = "Cantidad" - r.cant, "FechaModificacion" = now()
      where "IdBodega" = v_central and "IdProducto" = r."IdProducto" and "Cantidad" >= r.cant;
    if not found then
      raise exception 'No se puede anular: el stock de % ya fue despachado a otras bodegas', r."Nombre";
    end if;
  end loop;
  update "BodegaCentral" set "Anulado" = true, "IdUsuarioModificacion" = p_usuario, "FechaModificacion" = now()
    where "IdProveedor" = v_c."IdProveedor" and "Folio" = v_c."Folio";
  update "Compras" set "IdEstado" = 0, "MotivoAnulacion" = trim(p_motivo), "IdUsuarioModificacion" = p_usuario
    where "IdCompra" = p_compra;

  -- el costo vuelve al de la última línea de factura no anulada de cada producto (o a null si no queda ninguna)
  update "HistorialPreciosProducto" set "Anulada" = true where "IdCompra" = p_compra;
  for v_prod in select distinct "IdProducto" from "ComprasDetalle"
                where "IdProveedor" = v_c."IdProveedor" and "Folio" = v_c."Folio" loop
    select d."Precio", d."UnidadMedida", round(d."Precio" / u."Factor", 6) into v_precio, v_um, v_nuevo
      from "ComprasDetalle" d
      join "Compras" c on c."IdProveedor" = d."IdProveedor" and c."Folio" = d."Folio"
      join "UnidadesMedida" u on u."Codigo" = d."UnidadMedida"
      where d."IdProducto" = v_prod and c."IdEstado" = 1
      order by d."IdDetalle" desc limit 1;
    select "CostoUnitarioBase" into v_ant from "Productos" where "IdProducto" = v_prod;
    if v_ant is distinct from v_nuevo then
      update "Productos" set "CostoUnitarioBase" = v_nuevo, "IdUsuarioModificacion" = p_usuario where "IdProducto" = v_prod;
      insert into "HistorialPreciosProducto"("IdProducto","IdCompra","Origen","Precio","UnidadMedida","CostoBaseAnterior","CostoBaseNuevo","IdUsuario")
      values (v_prod, p_compra, 'Anulación', v_precio, v_um, v_ant, v_nuevo, p_usuario);
    end if;
  end loop;
end $$;

revoke all on function registrar_factura(bigint,bigint,bigint,date,date,text,numeric,numeric,numeric,jsonb) from public, anon, authenticated;
revoke all on function anular_factura(bigint,bigint,text) from public, anon, authenticated;
