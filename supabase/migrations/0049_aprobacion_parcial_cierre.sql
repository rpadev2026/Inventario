-- Aprobación parcial y cierre de solicitudes.
--  * Estado 6 «Aprobada parcialmente»: un gestor aprobó MENOS de lo pedido (con motivo). Solo el rol Administrador puede volver a aprobarla
--    (pasa a 2 y sigue el flujo normal) o cerrarla (estado 7 «Cerrada», con motivo). A los 7 días sin resolver se cierra sola.
--  * `aprobar_solicitud` ya no acepta cantidades menores a las pedidas: no hay forma de aprobar menos sin motivo.
alter table "Solicitudes" add column "MotivoParcial" text, add column "MotivoCierre" text, add column "FechaCierre" timestamptz, add column "IdUsuarioCierre" bigint references "Usuarios"("IdUsuario");
alter table "Solicitudes" add constraint "Solicitudes_MotivoParcial_largo" check ("MotivoParcial" is null or char_length("MotivoParcial") between 1 and 100);
alter table "Solicitudes" add constraint "Solicitudes_MotivoCierre_largo" check ("MotivoCierre" is null or char_length("MotivoCierre") between 1 and 100);

-- Los estados pasan de 0–5 a 0–7 (se buscan los checks por su definición: el nombre lo puso Postgres).
do $$
declare c record;
begin
  for c in select conrelid::regclass::text as tabla, conname from pg_constraint
    where contype = 'c' and conrelid in ('"Solicitudes"'::regclass, '"HistorialSolicitudes"'::regclass) and pg_get_constraintdef(oid) like '%"EstadoSolicitud"%' loop
    execute format('alter table %s drop constraint %I', c.tabla, c.conname);
  end loop;
end $$;
alter table "Solicitudes" add constraint "Solicitudes_EstadoSolicitud_check" check ("EstadoSolicitud" between 0 and 7);
alter table "HistorialSolicitudes" add constraint "HistorialSolicitudes_EstadoSolicitud_check" check ("EstadoSolicitud" between 0 and 7);
create index "Solicitudes_aprobadas_parcialmente" on "Solicitudes"("FechaAprobacion") where "EstadoSolicitud" = 6;

create or replace function es_administrador(p_usuario bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from "UsuariosRoles" ur
    join "Roles" r on r."IdRol" = ur."IdRol" and r."IdEstado" = 1 and r."NombreRol" = 'Administrador'
    join "Usuarios" u on u."IdUsuario" = ur."IdUsuario" and u."IdEstado" = 1
    where ur."IdUsuario" = p_usuario and ur."IdEstado" = 1);
$$;

-- Validación común de una aprobación (Enviada, stock, tope por producto, al menos un producto). No cambia el estado.
-- Devuelve true si es PARCIAL (algún producto quedó con menos de lo pedido; los no informados quedan en 0).
create or replace function aplicar_aprobacion(p_usuario bigint, p_solicitud bigint, p_items jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_central bigint; d jsonb; v_prod bigint; v_sol numeric; v_stock numeric; v_total numeric := 0;
begin
  perform 1 from "Solicitudes" where "IdSolicitud" = p_solicitud and "EstadoSolicitud" = 1 for update;
  if not found then raise exception 'La solicitud no está en estado Enviada'; end if;
  select "IdBodega" into v_central from "Bodegas" where "EsCentral";
  for d in select * from jsonb_array_elements(p_items) loop
    v_prod := producto_de_item(d);
    select "Cantidad" into v_sol from "SolicitudesDetalle" where "IdSolicitud" = p_solicitud and "IdProducto" = v_prod;
    if v_sol is null then raise exception 'Producto % no pertenece a la solicitud', etiqueta_producto(v_prod); end if;
    if (d->>'cantidad')::numeric < 0 or (d->>'cantidad')::numeric > v_sol then
      raise exception 'Cantidad aprobada inválida para %', etiqueta_producto(v_prod); end if;
    select coalesce(sum("Cantidad"),0) into v_stock from "StockBodega" where "IdBodega" = v_central and "IdProducto" = v_prod;
    if (d->>'cantidad')::numeric > v_stock then raise exception 'Stock insuficiente en Bodega Central para %', etiqueta_producto(v_prod); end if;
    update "SolicitudesDetalle" set "CantidadAprobada" = (d->>'cantidad')::numeric where "IdSolicitud" = p_solicitud and "IdProducto" = v_prod;
    v_total := v_total + (d->>'cantidad')::numeric;
  end loop;
  if v_total <= 0 then raise exception 'Debe aprobar al menos un producto o rechazar la solicitud'; end if;
  update "SolicitudesDetalle" set "CantidadAprobada" = 0 where "IdSolicitud" = p_solicitud and "CantidadAprobada" is null;
  return exists (select 1 from "SolicitudesDetalle" where "IdSolicitud" = p_solicitud and "CantidadAprobada" < "Cantidad");
end $$;

create or replace function aprobar_solicitud(p_usuario bigint, p_solicitud bigint, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if aplicar_aprobacion(p_usuario, p_solicitud, p_items) then
    raise exception 'Hay cantidades menores a las pedidas: apruebe parcialmente indicando el motivo'; end if;
  perform cambiar_estado_solicitud(p_usuario, p_solicitud, 2::smallint);
end $$;

create or replace function aprobar_parcial_solicitud(p_usuario bigint, p_solicitud bigint, p_items jsonb, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_motivo text := nullif(regexp_replace(coalesce(p_motivo, ''), '^\s+|\s+$', '', 'g'), '');
begin
  if v_motivo is null or char_length(v_motivo) > 100 then
    raise exception 'Indique el motivo de la aprobación parcial (máximo 100 caracteres)'; end if;
  if exists (select 1 from "Solicitudes" where "IdSolicitud" = p_solicitud and "IdUsuarioSolicitante" = p_usuario) then
    raise exception 'No puede aprobar su propia solicitud'; end if;
  if not aplicar_aprobacion(p_usuario, p_solicitud, p_items) then
    raise exception 'No hay cantidades menores a las pedidas: use Aprobar'; end if;
  update "Solicitudes" set "EstadoSolicitud" = 6, "MotivoParcial" = v_motivo, "IdUsuarioAprobador" = p_usuario, "FechaAprobacion" = now()
  where "IdSolicitud" = p_solicitud;
  insert into "HistorialSolicitudes"("IdSolicitud","EstadoSolicitud","IdUsuarioCreacion","IdUsuarioModificacion") values (p_solicitud, 6, p_usuario, p_usuario);
end $$;

-- El Administrador confirma la aprobación parcial: pasa a Aprobada (2) con las cantidades ya fijadas y sigue el flujo normal.
create or replace function reaprobar_solicitud(p_usuario bigint, p_solicitud bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_sol "Solicitudes"%rowtype; v_central bigint; d record;
begin
  if not es_administrador(p_usuario) then raise exception 'Solo el Administrador puede aprobar una solicitud parcial'; end if;
  select * into v_sol from "Solicitudes" where "IdSolicitud" = p_solicitud for update;
  if not found then raise exception 'Solicitud no existe'; end if;
  if v_sol."EstadoSolicitud" <> 6 then raise exception 'La solicitud no está en estado Aprobada parcialmente'; end if;
  if v_sol."IdUsuarioSolicitante" = p_usuario then raise exception 'No puede aprobar su propia solicitud'; end if;
  select "IdBodega" into v_central from "Bodegas" where "EsCentral";
  for d in select "IdProducto", "CantidadAprobada" from "SolicitudesDetalle" where "IdSolicitud" = p_solicitud and "CantidadAprobada" > 0 loop
    if d."CantidadAprobada" > (select coalesce(sum("Cantidad"), 0) from "StockBodega" where "IdBodega" = v_central and "IdProducto" = d."IdProducto") then
      raise exception 'Stock insuficiente en Bodega Central para %', etiqueta_producto(d."IdProducto"); end if;
  end loop;
  update "Solicitudes" set "EstadoSolicitud" = 2, "IdUsuarioAprobador" = p_usuario, "FechaAprobacion" = now() where "IdSolicitud" = p_solicitud;
  insert into "HistorialSolicitudes"("IdSolicitud","EstadoSolicitud","IdUsuarioCreacion","IdUsuarioModificacion") values (p_solicitud, 2, p_usuario, p_usuario);
end $$;

create or replace function cerrar_solicitud(p_usuario bigint, p_solicitud bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_estado smallint; v_motivo text := nullif(regexp_replace(coalesce(p_motivo, ''), '^\s+|\s+$', '', 'g'), '');
begin
  if not es_administrador(p_usuario) then raise exception 'Solo el Administrador puede cerrar una solicitud'; end if;
  if v_motivo is null or char_length(v_motivo) > 100 then raise exception 'Indique el motivo del cierre (máximo 100 caracteres)'; end if;
  select "EstadoSolicitud" into v_estado from "Solicitudes" where "IdSolicitud" = p_solicitud for update;
  if not found then raise exception 'Solicitud no existe'; end if;
  if v_estado <> 6 then raise exception 'La solicitud no está en estado Aprobada parcialmente'; end if;
  update "Solicitudes" set "EstadoSolicitud" = 7, "MotivoCierre" = v_motivo, "FechaCierre" = now(), "IdUsuarioCierre" = p_usuario where "IdSolicitud" = p_solicitud;
  insert into "HistorialSolicitudes"("IdSolicitud","EstadoSolicitud","IdUsuarioCreacion","IdUsuarioModificacion") values (p_solicitud, 7, p_usuario, p_usuario);
end $$;

-- Cierra las Aprobadas parcialmente con 7 días o más. Idempotente y segura si corren dos a la vez (skip locked): devuelve solo las que cerró ella.
create or replace function cerrar_solicitudes_caducadas()
returns table("IdSolicitud" bigint, "Token" uuid, "NumeroSolicitud" bigint)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  return query
  with c as (
    select s."IdSolicitud" from "Solicitudes" s
    where s."EstadoSolicitud" = 6 and s."FechaAprobacion" <= now() - interval '7 days'
    order by s."IdSolicitud" for update skip locked),
  u as (
    update "Solicitudes" s set "EstadoSolicitud" = 7, "MotivoCierre" = 'Cierre por caducidad de días', "FechaCierre" = now()
    from c where s."IdSolicitud" = c."IdSolicitud" returning s."IdSolicitud", s."Token", s."NumeroSolicitud"),
  h as (insert into "HistorialSolicitudes"("IdSolicitud","EstadoSolicitud") select u."IdSolicitud", 7::smallint from u)
  select u."IdSolicitud", u."Token", u."NumeroSolicitud" from u order by u."IdSolicitud";
end $$;

-- A quién se avisa de lo que pasa con una solicitud: el solicitante, quienes intervinieron en su historial y los Administradores vigentes.
create or replace function participantes_solicitud(p_solicitud bigint)
returns table("IdUsuario" bigint, "Correo" text) language sql stable security definer set search_path = public as $$
  select u."IdUsuario", u."Correo" from "Usuarios" u
  where u."IdEstado" = 1 and (
    u."IdUsuario" = (select s."IdUsuarioSolicitante" from "Solicitudes" s where s."IdSolicitud" = p_solicitud)
    or u."IdUsuario" in (select h."IdUsuarioCreacion" from "HistorialSolicitudes" h where h."IdSolicitud" = p_solicitud and h."IdUsuarioCreacion" is not null)
    or es_administrador(u."IdUsuario"))
  order by u."IdUsuario";
$$;

-- Suscripciones push de los Administradores vigentes (quienes deben confirmar una aprobación parcial), menos `p_excluir`.
create or replace function suscripciones_push_administradores(p_excluir bigint default null)
returns table("Endpoint" text, "P256dh" text, "Auth" text) language sql stable security definer set search_path = public as $$
  select s."Endpoint", s."P256dh", s."Auth" from "SuscripcionesPush" s
  where s."IdUsuario" is distinct from p_excluir and es_administrador(s."IdUsuario");
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'suscripciones_push_administradores(bigint)', 'aprobar_parcial_solicitud(bigint, bigint, jsonb, text)', 'reaprobar_solicitud(bigint, bigint)', 'cerrar_solicitud(bigint, bigint, text)',
    'cerrar_solicitudes_caducadas()', 'participantes_solicitud(bigint)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to app_servidor', f);
  end loop;
end $$;
