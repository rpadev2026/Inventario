-- Catálogo de permisos en una tabla: es la única fuente de qué permisos existen (módulo, descripción y orden
-- que muestra la matriz de roles). RolesPermisos pasa a referenciarla; guardar_rol valida contra ella.
create table "Permisos" (
  "Codigo" text primary key check ("Codigo" ~ '^[a-z_]+\.[a-z_]+$'),
  "Modulo" text not null,
  "Descripcion" text not null,
  "Orden" integer not null unique
);
alter table public."Permisos" enable row level security;
revoke all on public."Permisos" from anon, authenticated;

insert into "Permisos"("Codigo","Modulo","Descripcion","Orden") values
  ('compras.ver','Compras','Ver facturas de compra',1),
  ('compras.registrar','Compras','Registrar facturas de compra',2),
  ('compras.anular','Compras','Anular facturas de compra',3),
  ('proveedores.ver','Proveedores','Ver proveedores',4),
  ('proveedores.gestionar','Proveedores','Crear y editar proveedores',5),
  ('productos.ver','Productos','Ver productos',6),
  ('productos.gestionar','Productos','Crear y editar productos',7),
  ('recetas.ver','Recetas','Ver recetas y su costo',8),
  ('recetas.gestionar','Recetas','Crear y editar recetas',9),
  ('bodegas.ver','Bodegas','Ver bodegas y su stock',10),
  ('solicitudes.ver_propias','Solicitudes','Ver y recepcionar solicitudes propias',11),
  ('solicitudes.crear','Solicitudes','Crear, editar y enviar solicitudes propias',12),
  ('solicitudes.gestionar','Solicitudes','Ver, aprobar y despachar todas las solicitudes',13),
  ('movimientos.ver','Movimientos','Ver movimientos de inventario',14);

alter table "RolesPermisos" add constraint "RolesPermisos_Permiso_fkey" foreign key ("Permiso") references "Permisos"("Codigo");

-- guardar_rol (cuerpo de la 0012) + validación de los permisos contra el catálogo.
create or replace function guardar_rol(
  p_usuario bigint, p_id bigint, p_nombre text, p_detalle text, p_estado smallint, p_permisos text[]
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_rol "Roles"%rowtype;
  v_id bigint;
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_detalle text := nullif(btrim(coalesce(p_detalle, '')), '');
  v_desconocidos text;
begin
  if char_length(v_nombre) < 1 or char_length(v_nombre) > 60 then
    raise exception 'El nombre del rol debe tener entre 1 y 60 caracteres'; end if;
  if p_estado is null or p_estado not in (0, 1) then
    raise exception 'Estado de rol inválido'; end if;
  select string_agg(distinct x, ', ') into v_desconocidos from unnest(coalesce(p_permisos, '{}')) x
    where not exists (select 1 from "Permisos" where "Codigo" = x);
  if v_desconocidos is not null then
    raise exception 'Permiso desconocido: %', v_desconocidos; end if;

  if p_id is not null then
    select * into v_rol from "Roles" where "IdRol" = p_id for update;
    if not found then raise exception 'El rol no existe'; end if;
    if v_rol."EsBase" and v_nombre <> v_rol."NombreRol" then
      raise exception 'Los roles base no se pueden renombrar'; end if;
    -- Solo se bloquea pasar de vigente a no vigente: un rol base que ya está inactivo puede guardarse y reactivarse.
    if v_rol."EsBase" and p_estado = 0 and v_rol."IdEstado" = 1 then
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
