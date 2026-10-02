-- Operaciones críticas transaccionales. Solo ejecutables por service_role.

-- Registra factura + detalle y suma a Bodega Central y su stock.
-- p_detalle: [{"codigo":"X","precio":100,"cantidad":2}]
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
  v_suma numeric := 0;
begin
  select * into v_prov from "Proveedores" where "IdProveedor" = p_proveedor and "IdEstado" = 1;
  if not found then raise exception 'Proveedor no existe o no vigente'; end if;
  if jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La factura debe tener detalle'; end if;
  select "IdBodega" into v_central from "Bodegas" where "EsCentral" and "IdEstado" = 1;
  if v_central is null then raise exception 'No existe Bodega Central'; end if;

  for d in select * from jsonb_array_elements(p_detalle) loop
    v_suma := v_suma + round((d->>'precio')::numeric * (d->>'cantidad')::numeric, 2);
  end loop;
  if abs(v_suma - p_neto) > 1 then raise exception 'La suma del detalle no coincide con el neto'; end if;

  insert into "Compras"("IdProveedor","RutProveedor","NombreProveedor","GiroProveedor","Folio",
    "FechaFactura","FechaRecepcion","FormaPago","Neto","Iva","Total","IdUsuarioCreacion","IdUsuarioModificacion")
  values (p_proveedor, v_prov."Rut", v_prov."RazonSocial", v_prov."Giro", p_folio,
    p_fecha_factura, p_fecha_recepcion, p_forma_pago, p_neto, p_iva, p_total, p_usuario, p_usuario)
  returning "IdCompra" into v_id;

  for d in select * from jsonb_array_elements(p_detalle) loop
    if not exists (select 1 from "Productos" where "CodigoProducto" = d->>'codigo' and "IdEstado" = 1) then
      raise exception 'Producto % no existe o no vigente', d->>'codigo'; end if;
    insert into "ComprasDetalle"("IdProveedor","Folio","CodigoProducto","Precio","Cantidad","Total")
    values (p_proveedor, p_folio, d->>'codigo', (d->>'precio')::numeric, (d->>'cantidad')::numeric,
            round((d->>'precio')::numeric * (d->>'cantidad')::numeric, 2));
    insert into "BodegaCentral"("CodigoProducto","Cantidad","FechaIngreso","IdProveedor","Folio","IdUsuarioCreacion","IdUsuarioModificacion")
    values (d->>'codigo', (d->>'cantidad')::numeric, p_fecha_recepcion, p_proveedor, p_folio, p_usuario, p_usuario);
    insert into "StockBodega"("IdBodega","CodigoProducto","Cantidad")
    values (v_central, d->>'codigo', (d->>'cantidad')::numeric)
    on conflict ("IdBodega","CodigoProducto")
    do update set "Cantidad" = "StockBodega"."Cantidad" + excluded."Cantidad", "FechaModificacion" = now();
  end loop;
  return v_id;
end $$;

-- Cambio de estado con validación de transiciones e historial.
-- Transiciones: 0->1 (enviar), 1->2|5 (aprobar/rechazar). La recepción usa recepcionar_solicitud.
create or replace function cambiar_estado_solicitud(
  p_usuario bigint, p_solicitud bigint, p_nuevo smallint
) returns void language plpgsql security definer set search_path = public as $$
declare v_sol "Solicitudes"%rowtype;
begin
  select * into v_sol from "Solicitudes" where "IdSolicitud" = p_solicitud for update;
  if not found then raise exception 'Solicitud no existe'; end if;
  if not ((v_sol."EstadoSolicitud" = 0 and p_nuevo = 1) or (v_sol."EstadoSolicitud" = 1 and p_nuevo in (2,5))) then
    raise exception 'Transición inválida de % a %', v_sol."EstadoSolicitud", p_nuevo;
  end if;
  if p_nuevo = 1 and not exists (select 1 from "SolicitudesDetalle" where "IdSolicitud" = p_solicitud) then
    raise exception 'La solicitud no tiene productos'; end if;
  if p_nuevo = 2 then
    update "SolicitudesDetalle" set "CantidadAprobada" = coalesce("CantidadAprobada","Cantidad") where "IdSolicitud" = p_solicitud;
  end if;
  update "Solicitudes" set "EstadoSolicitud" = p_nuevo,
    "IdUsuarioAprobador" = case when p_nuevo in (2,5) then p_usuario else "IdUsuarioAprobador" end,
    "FechaAprobacion" = case when p_nuevo in (2,5) then now() else "FechaAprobacion" end
  where "IdSolicitud" = p_solicitud;
  insert into "HistorialSolicitudes"("IdSolicitud","EstadoSolicitud","IdUsuarioCreacion","IdUsuarioModificacion")
  values (p_solicitud, p_nuevo, p_usuario, p_usuario);
end $$;

-- Recepción: p_items [{"codigo":"X","cantidad":n}]. Rebaja central, suma destino, registra movimientos.
-- Estado 3 si todo lo aprobado quedó recibido; 4 (parcial) si falta; se puede recepcionar de nuevo desde 2 o 4.
create or replace function recepcionar_solicitud(
  p_usuario bigint, p_solicitud bigint, p_items jsonb
) returns smallint language plpgsql security definer set search_path = public as $$
declare
  v_sol "Solicitudes"%rowtype;
  v_central bigint;
  d jsonb; v_cant numeric; v_pend numeric; v_nuevo smallint;
begin
  select * into v_sol from "Solicitudes" where "IdSolicitud" = p_solicitud for update;
  if not found then raise exception 'Solicitud no existe'; end if;
  if v_sol."EstadoSolicitud" not in (2,4) then raise exception 'La solicitud no está en estado recepcionable'; end if;
  if v_sol."IdUsuarioSolicitante" <> p_usuario then raise exception 'Solo el solicitante puede recepcionar'; end if;
  select "IdBodega" into v_central from "Bodegas" where "EsCentral";

  for d in select * from jsonb_array_elements(p_items) loop
    v_cant := (d->>'cantidad')::numeric;
    if v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    select "CantidadAprobada" - "CantidadRecibida" into v_pend from "SolicitudesDetalle"
      where "IdSolicitud" = p_solicitud and "CodigoProducto" = d->>'codigo' for update;
    if v_pend is null then raise exception 'Producto % no pertenece a la solicitud', d->>'codigo'; end if;
    if v_cant > v_pend then raise exception 'Cantidad excede lo pendiente para %', d->>'codigo'; end if;

    update "StockBodega" set "Cantidad" = "Cantidad" - v_cant, "FechaModificacion" = now()
      where "IdBodega" = v_central and "CodigoProducto" = d->>'codigo';
    if not found then raise exception 'Sin stock en Bodega Central para %', d->>'codigo'; end if;
    -- el CHECK (Cantidad >= 0) aborta la transacción si el stock queda negativo

    insert into "StockBodega"("IdBodega","CodigoProducto","Cantidad")
    values (v_sol."IdBodegaDestino", d->>'codigo', v_cant)
    on conflict ("IdBodega","CodigoProducto")
    do update set "Cantidad" = "StockBodega"."Cantidad" + excluded."Cantidad", "FechaModificacion" = now();

    update "SolicitudesDetalle" set "CantidadRecibida" = "CantidadRecibida" + v_cant
      where "IdSolicitud" = p_solicitud and "CodigoProducto" = d->>'codigo';
    insert into "MovimientosBodega"("IdSolicitud","IdBodegaOrigen","IdBodegaDestino","CodigoProducto","Cantidad","IdUsuarioCreacion","IdUsuarioModificacion")
    values (p_solicitud, v_central, v_sol."IdBodegaDestino", d->>'codigo', v_cant, p_usuario, p_usuario);
  end loop;

  if exists (select 1 from "SolicitudesDetalle" where "IdSolicitud" = p_solicitud and "CantidadRecibida" < "CantidadAprobada")
    then v_nuevo := 4; else v_nuevo := 3; end if;
  update "Solicitudes" set "EstadoSolicitud" = v_nuevo where "IdSolicitud" = p_solicitud;
  insert into "HistorialSolicitudes"("IdSolicitud","EstadoSolicitud","IdUsuarioCreacion","IdUsuarioModificacion")
  values (p_solicitud, v_nuevo, p_usuario, p_usuario);
  return v_nuevo;
end $$;

revoke all on function registrar_factura(bigint,bigint,bigint,date,date,text,numeric,numeric,numeric,jsonb) from public, anon, authenticated;
revoke all on function cambiar_estado_solicitud(bigint,bigint,smallint) from public, anon, authenticated;
revoke all on function recepcionar_solicitud(bigint,bigint,jsonb) from public, anon, authenticated;
