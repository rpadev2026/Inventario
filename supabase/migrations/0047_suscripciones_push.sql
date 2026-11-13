-- Avisos push (Web Push): una fila por navegador/dispositivo suscrito. La tabla NO tiene acceso directo para la app: todo va por funciones.
create table "SuscripcionesPush" (
  "IdSuscripcion" bigint generated always as identity primary key,
  "IdUsuario" bigint not null references "Usuarios"("IdUsuario"),
  "Endpoint" text not null unique,
  "P256dh" text not null,
  "Auth" text not null,
  "FechaRegistroCreacion" timestamptz not null default now()
);
create index "SuscripcionesPush_usuario" on "SuscripcionesPush"("IdUsuario");
alter table "SuscripcionesPush" enable row level security;
revoke all on public."SuscripcionesPush" from anon, authenticated;

-- Alta idempotente: el endpoint identifica al dispositivo; si otra persona inicia sesión en él, la suscripción pasa a ella.
create or replace function guardar_suscripcion_push(p_usuario bigint, p_endpoint text, p_p256dh text, p_auth text)
returns void language sql security definer set search_path = public as $$
  insert into "SuscripcionesPush"("IdUsuario","Endpoint","P256dh","Auth") values (p_usuario, p_endpoint, p_p256dh, p_auth)
  on conflict ("Endpoint") do update set "IdUsuario" = excluded."IdUsuario", "P256dh" = excluded."P256dh", "Auth" = excluded."Auth";
$$;

create or replace function quitar_suscripcion_push(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from "SuscripcionesPush" where "Endpoint" = p_endpoint;
$$;

create or replace function suscripciones_push_usuarios(p_usuarios bigint[])
returns table("Endpoint" text, "P256dh" text, "Auth" text) language sql stable security definer set search_path = public as $$
  select s."Endpoint", s."P256dh", s."Auth" from "SuscripcionesPush" s
  join "Usuarios" u on u."IdUsuario" = s."IdUsuario"
  where s."IdUsuario" = any(p_usuarios) and u."IdEstado" = 1;
$$;

-- Mismos destinatarios que los correos: usuarios vigentes con un rol vigente que tenga el permiso, más los de rol Administrador.
create or replace function suscripciones_push_permiso(p_permiso text, p_excluir bigint default null)
returns table("Endpoint" text, "P256dh" text, "Auth" text) language sql stable security definer set search_path = public as $$
  select s."Endpoint", s."P256dh", s."Auth" from "SuscripcionesPush" s
  where s."IdUsuario" is distinct from p_excluir and exists ( -- p_excluir: quien originó el aviso no se avisa a sí mismo
    select 1 from "UsuariosRoles" ur
    join "Roles" r on r."IdRol" = ur."IdRol" and r."IdEstado" = 1
    join "Usuarios" u on u."IdUsuario" = ur."IdUsuario" and u."IdEstado" = 1
    where ur."IdUsuario" = s."IdUsuario" and ur."IdEstado" = 1
      and (r."NombreRol" = 'Administrador' or exists (select 1 from "RolesPermisos" rp where rp."IdRol" = r."IdRol" and rp."Permiso" = p_permiso)));
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'guardar_suscripcion_push(bigint, text, text, text)', 'quitar_suscripcion_push(text)',
    'suscripciones_push_usuarios(bigint[])', 'suscripciones_push_permiso(text, bigint)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to app_servidor', f);
  end loop;
end $$;
