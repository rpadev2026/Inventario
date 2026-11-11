-- registrar_factura (0017) + rechaza fechas de factura y de recepción posteriores a hoy (fecha de Chile).
-- La aplicación ya lo valida (facturaSchema y max del formulario); esto es el candado dentro de la base.
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
  -- hoy en Chile (no en UTC): no se registran compras con fecha futura
  if p_fecha_factura > (now() at time zone 'America/Santiago')::date then
    raise exception 'La fecha de factura no puede ser posterior a hoy'; end if;
  if p_fecha_recepcion > (now() at time zone 'America/Santiago')::date then
    raise exception 'La fecha de recepción no puede ser posterior a hoy'; end if;
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
