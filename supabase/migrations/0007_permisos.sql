-- Permisos por rol. Administrador tiene todos los permisos de forma implícita (sin filas).
-- Los 4 roles del seed se aseguran aquí (el seed usa on conflict do nothing) y se marcan como base.
insert into "Roles"("NombreRol","DetalleRol") values
  ('Administrador','Gestiona usuarios, roles y todo el sistema'),
  ('Compras','Registra facturas, proveedores y productos'),
  ('Bodeguero Central','Aprueba y despacha solicitudes'),
  ('Solicitante','Crea solicitudes y recepciona insumos')
on conflict do nothing;

alter table "Roles" add column "EsBase" boolean not null default false;
update "Roles" set "EsBase" = true
  where "NombreRol" in ('Administrador','Compras','Bodeguero Central','Solicitante');

create table "RolesPermisos" (
  "IdRol" bigint not null references "Roles"("IdRol"),
  "Permiso" text not null check ("Permiso" ~ '^[a-z_]+\.[a-z_]+$'),
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroModificacion" timestamptz not null default now(),
  primary key ("IdRol","Permiso")
);
create trigger trg_mod before update on "RolesPermisos" for each row execute function set_modificacion();
alter table public."RolesPermisos" enable row level security;
revoke all on public."RolesPermisos" from anon, authenticated;

insert into "RolesPermisos"("IdRol","Permiso")
select r."IdRol", p.permiso
from "Roles" r
join (values
  ('Compras','compras.ver'),('Compras','compras.registrar'),('Compras','compras.anular'),
  ('Compras','proveedores.ver'),('Compras','proveedores.gestionar'),
  ('Compras','productos.ver'),('Compras','productos.gestionar'),
  ('Bodeguero Central','solicitudes.ver_propias'),('Bodeguero Central','solicitudes.gestionar'),
  ('Bodeguero Central','bodegas.ver'),('Bodeguero Central','movimientos.ver'),
  ('Solicitante','solicitudes.ver_propias'),('Solicitante','solicitudes.crear'),('Solicitante','bodegas.ver')
) as p(rol, permiso) on p.rol = r."NombreRol";

create or replace function guardar_rol(
  p_usuario bigint, p_id bigint, p_nombre text, p_detalle text, p_estado smallint, p_permisos text[]
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_rol "Roles"%rowtype;
  v_id bigint;
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_detalle text := nullif(btrim(coalesce(p_detalle, '')), '');
begin
  if char_length(v_nombre) < 1 or char_length(v_nombre) > 60 then
    raise exception 'El nombre del rol debe tener entre 1 y 60 caracteres'; end if;
  if p_estado is null or p_estado not in (0, 1) then
    raise exception 'Estado de rol inválido'; end if;

  if p_id is not null then
    select * into v_rol from "Roles" where "IdRol" = p_id for update;
    if not found then raise exception 'El rol no existe'; end if;
    if v_rol."EsBase" and v_nombre <> v_rol."NombreRol" then
      raise exception 'Los roles base no se pueden renombrar'; end if;
    if v_rol."EsBase" and p_estado = 0 then
      raise exception 'Los roles base no se pueden desactivar'; end if;
  end if;

  if exists (select 1 from "Roles" where lower("NombreRol") = lower(v_nombre) and "IdRol" is distinct from p_id) then
    raise exception 'Ya existe un rol con ese nombre'; end if;

  if p_id is not null and p_estado = 0 and v_rol."IdEstado" = 1
     and exists (select 1 from "UsuariosRoles" where "IdRol" = p_id and "IdEstado" = 1) then
    raise exception 'No se puede desactivar un rol con usuarios activos'; end if;

  if p_id is null then
    insert into "Roles"("NombreRol","DetalleRol","IdEstado","IdUsuarioCreacion","IdUsuarioModificacion")
    values (v_nombre, v_detalle, p_estado, p_usuario, p_usuario)
    returning "IdRol" into v_id;
  else
    update "Roles" set "NombreRol" = v_nombre, "DetalleRol" = v_detalle, "IdEstado" = p_estado,
      "IdUsuarioModificacion" = p_usuario
    where "IdRol" = p_id;
    v_id := p_id;
  end if;

  -- Administrador tiene todos los permisos implícitos: nunca se le guardan filas.
  if coalesce(v_rol."NombreRol", v_nombre) <> 'Administrador' then
    delete from "RolesPermisos" where "IdRol" = v_id;
    insert into "RolesPermisos"("IdRol","Permiso","IdUsuarioCreacion","IdUsuarioModificacion")
    select v_id, x, p_usuario, p_usuario from (select distinct unnest(coalesce(p_permisos, '{}')) as x) s;
  end if;
  return v_id;
end $$;

revoke all on function guardar_rol(bigint,bigint,text,text,smallint,text[]) from public, anon, authenticated;
