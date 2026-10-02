-- Crear/editar solicitud (estado Creada) y aprobar con cantidades. Solo service_role.
-- p_items: [{"codigo":"X","cantidad":n}]

create or replace function crear_solicitud(p_usuario bigint, p_bodega bigint, p_items jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; d jsonb;
begin
  if not exists (select 1 from "Bodegas" where "IdBodega" = p_bodega and "IdEstado" = 1 and not "EsCentral") then
    raise exception 'Bodega destino inválida'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La solicitud debe tener productos'; end if;
  insert into "Solicitudes"("IdUsuarioSolicitante","IdBodegaDestino") values (p_usuario, p_bodega) returning "IdSolicitud" into v_id;
  for d in select * from jsonb_array_elements(p_items) loop
    if (d->>'cantidad')::numeric <= 0 then raise exception 'Cantidad inválida'; end if;
    if not exists (select 1 from "Productos" where "CodigoProducto" = d->>'codigo' and "IdEstado" = 1) then
      raise exception 'Producto % no existe o no vigente', d->>'codigo'; end if;
    insert into "SolicitudesDetalle"("IdSolicitud","CodigoProducto","Cantidad") values (v_id, d->>'codigo', (d->>'cantidad')::numeric);
  end loop;
  insert into "HistorialSolicitudes"("IdSolicitud","EstadoSolicitud","IdUsuarioCreacion","IdUsuarioModificacion") values (v_id, 0, p_usuario, p_usuario);
  return v_id;
end $$;

create or replace function actualizar_solicitud(p_usuario bigint, p_solicitud bigint, p_bodega bigint, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_sol "Solicitudes"%rowtype; d jsonb;
begin
  select * into v_sol from "Solicitudes" where "IdSolicitud" = p_solicitud for update;
  if not found then raise exception 'Solicitud no existe'; end if;
  if v_sol."IdUsuarioSolicitante" <> p_usuario then raise exception 'Solo el solicitante puede editarla'; end if;
  if v_sol."EstadoSolicitud" <> 0 then raise exception 'Solo se puede editar una solicitud en estado Creada'; end if;
  if not exists (select 1 from "Bodegas" where "IdBodega" = p_bodega and "IdEstado" = 1 and not "EsCentral") then
    raise exception 'Bodega destino inválida'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La solicitud debe tener productos'; end if;
  update "Solicitudes" set "IdBodegaDestino" = p_bodega where "IdSolicitud" = p_solicitud;
  delete from "SolicitudesDetalle" where "IdSolicitud" = p_solicitud;
  for d in select * from jsonb_array_elements(p_items) loop
    if (d->>'cantidad')::numeric <= 0 then raise exception 'Cantidad inválida'; end if;
    if not exists (select 1 from "Productos" where "CodigoProducto" = d->>'codigo' and "IdEstado" = 1) then
      raise exception 'Producto % no existe o no vigente', d->>'codigo'; end if;
    insert into "SolicitudesDetalle"("IdSolicitud","CodigoProducto","Cantidad") values (p_solicitud, d->>'codigo', (d->>'cantidad')::numeric);
  end loop;
end $$;

-- Aprobar: fija cantidades aprobadas (<= solicitada y <= stock central) y pasa a estado 2.
-- p_items: [{"codigo":"X","cantidad":n}] (n puede ser 0 para no despachar ese ítem).
create or replace function aprobar_solicitud(p_usuario bigint, p_solicitud bigint, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_central bigint; d jsonb; v_sol numeric; v_stock numeric; v_total numeric := 0;
begin
  perform 1 from "Solicitudes" where "IdSolicitud" = p_solicitud and "EstadoSolicitud" = 1 for update;
  if not found then raise exception 'La solicitud no está en estado Enviada'; end if;
  select "IdBodega" into v_central from "Bodegas" where "EsCentral";
  for d in select * from jsonb_array_elements(p_items) loop
    select "Cantidad" into v_sol from "SolicitudesDetalle" where "IdSolicitud" = p_solicitud and "CodigoProducto" = d->>'codigo';
    if v_sol is null then raise exception 'Producto % no pertenece a la solicitud', d->>'codigo'; end if;
    if (d->>'cantidad')::numeric < 0 or (d->>'cantidad')::numeric > v_sol then
      raise exception 'Cantidad aprobada inválida para %', d->>'codigo'; end if;
    select coalesce(sum("Cantidad"),0) into v_stock from "StockBodega" where "IdBodega" = v_central and "CodigoProducto" = d->>'codigo';
    if (d->>'cantidad')::numeric > v_stock then raise exception 'Stock insuficiente en Bodega Central para %', d->>'codigo'; end if;
    update "SolicitudesDetalle" set "CantidadAprobada" = (d->>'cantidad')::numeric
      where "IdSolicitud" = p_solicitud and "CodigoProducto" = d->>'codigo';
    v_total := v_total + (d->>'cantidad')::numeric;
  end loop;
  if v_total <= 0 then raise exception 'Debe aprobar al menos un producto o rechazar la solicitud'; end if;
  -- ítems no informados quedan con aprobada = 0 si aún no tenían valor
  update "SolicitudesDetalle" set "CantidadAprobada" = 0 where "IdSolicitud" = p_solicitud and "CantidadAprobada" is null;
  perform cambiar_estado_solicitud(p_usuario, p_solicitud, 2::smallint);
end $$;

revoke all on function crear_solicitud(bigint,bigint,jsonb) from public, anon, authenticated;
revoke all on function actualizar_solicitud(bigint,bigint,bigint,jsonb) from public, anon, authenticated;
revoke all on function aprobar_solicitud(bigint,bigint,jsonb) from public, anon, authenticated;
