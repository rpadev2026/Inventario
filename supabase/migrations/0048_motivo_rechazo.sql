-- Rechazar una solicitud exige un motivo corto (1 a 100 caracteres). `rechazar_solicitud` es la única forma de rechazar:
-- `cambiar_estado_solicitud` deja de aceptar el estado 5. Las rechazadas anteriores quedan con motivo null.
alter table "Solicitudes" add column "MotivoRechazo" text;
alter table "Solicitudes" add constraint "Solicitudes_MotivoRechazo_largo" check ("MotivoRechazo" is null or char_length("MotivoRechazo") between 1 and 100);

create or replace function rechazar_solicitud(p_usuario bigint, p_solicitud bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_sol "Solicitudes"%rowtype; v_motivo text := nullif(regexp_replace(coalesce(p_motivo, ''), '^\s+|\s+$', '', 'g'), ''); -- recorta también tabulaciones y saltos de línea (btrim solo quita espacios)
begin
  if v_motivo is null or char_length(v_motivo) > 100 then
    raise exception 'Indique el motivo del rechazo (máximo 100 caracteres)'; end if;
  select * into v_sol from "Solicitudes" where "IdSolicitud" = p_solicitud for update;
  if not found then raise exception 'Solicitud no existe'; end if;
  if v_sol."EstadoSolicitud" <> 1 then raise exception 'Transición inválida de % a 5', v_sol."EstadoSolicitud"; end if;
  if v_sol."IdUsuarioSolicitante" = p_usuario then raise exception 'No puede rechazar su propia solicitud'; end if;
  update "Solicitudes" set "EstadoSolicitud" = 5, "MotivoRechazo" = v_motivo, "IdUsuarioAprobador" = p_usuario, "FechaAprobacion" = now()
  where "IdSolicitud" = p_solicitud;
  insert into "HistorialSolicitudes"("IdSolicitud","EstadoSolicitud","IdUsuarioCreacion","IdUsuarioModificacion")
  values (p_solicitud, 5, p_usuario, p_usuario);
end $$;
revoke all on function rechazar_solicitud(bigint, bigint, text) from public, anon, authenticated;
grant execute on function rechazar_solicitud(bigint, bigint, text) to app_servidor;

-- Mismo cuerpo que 0002, sin la transición 1 → 5 (el rechazo va por rechazar_solicitud).
create or replace function cambiar_estado_solicitud(
  p_usuario bigint, p_solicitud bigint, p_nuevo smallint
) returns void language plpgsql security definer set search_path = public as $$
declare v_sol "Solicitudes"%rowtype;
begin
  select * into v_sol from "Solicitudes" where "IdSolicitud" = p_solicitud for update;
  if not found then raise exception 'Solicitud no existe'; end if;
  if not ((v_sol."EstadoSolicitud" = 0 and p_nuevo = 1) or (v_sol."EstadoSolicitud" = 1 and p_nuevo = 2)) then
    raise exception 'Transición inválida de % a %', v_sol."EstadoSolicitud", p_nuevo;
  end if;
  if p_nuevo = 1 and not exists (select 1 from "SolicitudesDetalle" where "IdSolicitud" = p_solicitud) then
    raise exception 'La solicitud no tiene productos'; end if;
  if p_nuevo = 2 then
    update "SolicitudesDetalle" set "CantidadAprobada" = coalesce("CantidadAprobada","Cantidad") where "IdSolicitud" = p_solicitud;
  end if;
  update "Solicitudes" set "EstadoSolicitud" = p_nuevo,
    "IdUsuarioAprobador" = case when p_nuevo = 2 then p_usuario else "IdUsuarioAprobador" end,
    "FechaAprobacion" = case when p_nuevo = 2 then now() else "FechaAprobacion" end
  where "IdSolicitud" = p_solicitud;
  insert into "HistorialSolicitudes"("IdSolicitud","EstadoSolicitud","IdUsuarioCreacion","IdUsuarioModificacion")
  values (p_solicitud, p_nuevo, p_usuario, p_usuario);
end $$;
