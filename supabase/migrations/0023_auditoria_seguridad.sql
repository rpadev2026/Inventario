-- Auditoría 2026-10-14 (S01–S05): versión de sesión, limitador de login compartido,
-- fallos de login atómicos, cambio de clave y alta de usuario transaccionales.

-- S01: cada cambio/reset de clave sube la versión; los JWT con otra versión se rechazan.
alter table "Claves" add column "VersionSesion" int not null default 1;

-- S02: contador de intentos compartido entre instancias, con vencimiento.
create table "IntentosLogin" (
  "Clave" text primary key,
  "N" int not null,
  "Desde" timestamptz not null default now()
);
alter table "IntentosLogin" enable row level security;
revoke all on public."IntentosLogin" from anon, authenticated;

-- true = puede intentar. Un solo INSERT … ON CONFLICT: sin actualizaciones perdidas.
create or replace function registrar_intento_login(p_clave text, p_max int, p_ventana_seg int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  delete from "IntentosLogin" where "Desde" < now() - make_interval(secs => p_ventana_seg);
  insert into "IntentosLogin"("Clave", "N") values (left(p_clave, 100), 1)
  on conflict ("Clave") do update set
    "N" = case when "IntentosLogin"."Desde" < now() - make_interval(secs => p_ventana_seg) then 1 else "IntentosLogin"."N" + 1 end,
    "Desde" = case when "IntentosLogin"."Desde" < now() - make_interval(secs => p_ventana_seg) then now() else "IntentosLogin"."Desde" end
  returning "N" into v_n;
  return v_n <= p_max;
end $$;
revoke all on function registrar_intento_login(text,int,int) from public, anon, authenticated;

-- S03: incremento atómico del contador de fallos y bloqueo al llegar al máximo.
create or replace function registrar_fallo_login(p_usuario bigint, p_max int, p_bloqueo_min int)
returns void language sql security definer set search_path = public as $$
  update "Claves" set
    "IntentosFallidos" = case when "IntentosFallidos" + 1 >= p_max then 0 else "IntentosFallidos" + 1 end,
    "BloqueadoHasta" = case when "IntentosFallidos" + 1 >= p_max then now() + make_interval(mins => p_bloqueo_min) else null end
  where "IdUsuario" = p_usuario;
$$;
revoke all on function registrar_fallo_login(bigint,int,int) from public, anon, authenticated;

-- S01 + S04: clave, versión de sesión e historial en una sola transacción, serializada por usuario.
create or replace function fijar_clave(p_usuario bigint, p_hash text, p_actor bigint, p_debe_cambiar boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('clave:' || p_usuario, 0));
  insert into "Claves"("IdUsuario", "Password", "IdEstado", "DebeCambiar", "IntentosFallidos", "BloqueadoHasta",
                       "IdUsuarioCreacion", "IdUsuarioModificacion")
  values (p_usuario, p_hash, 1, p_debe_cambiar, 0, null, p_actor, p_actor)
  on conflict ("IdUsuario") do update set
    "Password" = excluded."Password", "IdEstado" = 1, "DebeCambiar" = excluded."DebeCambiar",
    "IntentosFallidos" = 0, "BloqueadoHasta" = null, "IdUsuarioModificacion" = p_actor,
    "VersionSesion" = "Claves"."VersionSesion" + 1;
  insert into "HistorialClaves"("IdUsuario", "Password", "IdUsuarioCreacion", "IdUsuarioModificacion")
  values (p_usuario, p_hash, p_actor, p_actor);
end $$;
revoke all on function fijar_clave(bigint,text,bigint,boolean) from public, anon, authenticated;

-- S05: usuario, clave temporal, historial y rol en una sola transacción.
create or replace function crear_usuario(
  p_actor bigint, p_rut text, p_nombres text, p_apellidos text, p_correo text, p_hash text, p_rol bigint
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not exists (select 1 from "Roles" where "IdRol" = p_rol and "IdEstado" = 1) then
    raise exception 'El rol no existe o no está vigente'; end if;
  insert into "Usuarios"("Rut", "Nombres", "Apellidos", "Correo", "IdUsuarioCreacion", "IdUsuarioModificacion")
  values (p_rut, p_nombres, p_apellidos, p_correo, p_actor, p_actor) returning "IdUsuario" into v_id;
  perform fijar_clave(v_id, p_hash, p_actor, true);
  insert into "UsuariosRoles"("IdUsuario", "IdRol", "IdUsuarioCreacion", "IdUsuarioModificacion")
  values (v_id, p_rol, p_actor, p_actor);
  return v_id;
end $$;
revoke all on function crear_usuario(bigint,text,text,text,text,text,bigint) from public, anon, authenticated;
