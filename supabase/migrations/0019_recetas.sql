-- Módulo Recetas: fichas técnicas con ingredientes que son productos o sub-recetas.
-- El costo se calcula al mostrar (calcular_receta); no se guarda.

-- ===== Recetas =====
create table "Recetas" (
  "IdReceta" bigint generated always as identity primary key,
  "CodigoReceta" text unique,
  "Nombre" text not null unique,
  "RendimientoPorciones" numeric(8,2) not null default 1 check ("RendimientoPorciones" > 0),
  "RendimientoCantidad" numeric(14,3) check ("RendimientoCantidad" > 0),
  "RendimientoUnidad" text references "UnidadesMedida"("Codigo"),
  "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroModificacion" timestamptz not null default now(),
  -- el rendimiento (cuánto produce la receta, p. ej. 2000 Gramo) se informa completo o no se informa
  check (("RendimientoCantidad" is null) = ("RendimientoUnidad" is null))
);
create trigger trg_mod before update on "Recetas" for each row execute function set_modificacion();
alter table public."Recetas" enable row level security;
revoke all on public."Recetas" from anon, authenticated;

-- Código y nombre siempre en MAYÚSCULA (un código vacío queda null): los únicos no distinguen mayúsculas.
create or replace function normalizar_receta() returns trigger
language plpgsql set search_path = public as $$
begin
  new."CodigoReceta" := upper(nullif(btrim(new."CodigoReceta"), ''));
  new."Nombre" := upper(btrim(new."Nombre"));
  return new;
end $$;
revoke all on function normalizar_receta() from public, anon, authenticated;
create trigger trg_normalizar_receta before insert or update on "Recetas"
  for each row execute function normalizar_receta();

-- ===== RecetaDetalles =====
create table "RecetaDetalles" (
  "IdDetalle" bigint generated always as identity primary key,
  "IdReceta" bigint not null references "Recetas"("IdReceta") on delete cascade,
  "IdProducto" bigint references "Productos"("IdProducto"),
  "IdSubReceta" bigint references "Recetas"("IdReceta"),
  "Cantidad" numeric(10,3) not null default 1 check ("Cantidad" > 0),
  "PorcionNeta" numeric(10,3) not null check ("PorcionNeta" > 0),
  "UnidadMedida" text not null references "UnidadesMedida"("Codigo"),
  "PorcentajeMerma" numeric(6,4) not null default 0 check ("PorcentajeMerma" >= 0),
  constraint "ck_Tipo_Origen" check (("IdProducto" is not null) <> ("IdSubReceta" is not null))
);
create unique index "RecetaDetalles_producto_uk" on "RecetaDetalles"("IdReceta","IdProducto") where "IdProducto" is not null;
create unique index "RecetaDetalles_subreceta_uk" on "RecetaDetalles"("IdReceta","IdSubReceta") where "IdSubReceta" is not null;
create index "idx_RecetaDetallesReceta" on "RecetaDetalles"("IdReceta");
create index "idx_RecetaDetallesProducto" on "RecetaDetalles"("IdProducto");
create index "idx_RecetaDetallesSubReceta" on "RecetaDetalles"("IdSubReceta");
alter table public."RecetaDetalles" enable row level security;
revoke all on public."RecetaDetalles" from anon, authenticated;

-- Reglas de cada línea: sin ciclos, la sub-receta tiene rendimiento y la unidad es de la familia del ingrediente.
create or replace function validar_receta_detalle() returns trigger
language plpgsql set search_path = public as $$
declare
  v_familia text;
  v_unidad text;
begin
  if new."IdSubReceta" is not null then
    if new."IdSubReceta" = new."IdReceta" or exists (
      with recursive ruta(id) as (
        select new."IdSubReceta"
        union
        select d."IdSubReceta" from "RecetaDetalles" d join ruta r on d."IdReceta" = r.id where d."IdSubReceta" is not null
      )
      select 1 from ruta where id = new."IdReceta") then
      raise exception 'Una receta no puede incluirse a sí misma, ni directa ni indirectamente';
    end if;
    select u."UnidadBase" into v_familia from "Recetas" r
      join "UnidadesMedida" u on u."Codigo" = r."RendimientoUnidad" where r."IdReceta" = new."IdSubReceta";
    if v_familia is null then raise exception 'La sub-receta no tiene rendimiento definido'; end if;
  else
    select p."UnidadBase" into v_familia from "Productos" p where p."IdProducto" = new."IdProducto";
  end if;
  select u."UnidadBase" into v_unidad from "UnidadesMedida" u where u."Codigo" = new."UnidadMedida";
  if v_unidad is distinct from v_familia then
    raise exception 'La unidad debe ser de la misma familia que la del ingrediente';
  end if;
  return new;
end $$;
revoke all on function validar_receta_detalle() from public, anon, authenticated;
create trigger trg_validar_receta_detalle before insert or update on "RecetaDetalles"
  for each row execute function validar_receta_detalle();

-- Una receta usada como sub-receta no se desactiva (si la usa una vigente) ni cambia de familia su rendimiento.
create or replace function validar_receta() returns trigger
language plpgsql set search_path = public as $$
begin
  if old."IdEstado" = 1 and new."IdEstado" = 0 and exists (
    select 1 from "RecetaDetalles" d join "Recetas" r on r."IdReceta" = d."IdReceta"
    where d."IdSubReceta" = old."IdReceta" and r."IdEstado" = 1) then
    raise exception 'No se puede desactivar: es sub-receta de otras recetas vigentes';
  end if;
  if exists (select 1 from "RecetaDetalles" where "IdSubReceta" = old."IdReceta")
     and (new."RendimientoUnidad" is null
       or (select "UnidadBase" from "UnidadesMedida" where "Codigo" = new."RendimientoUnidad")
          is distinct from (select "UnidadBase" from "UnidadesMedida" where "Codigo" = old."RendimientoUnidad")) then
    raise exception 'No se puede cambiar el rendimiento: la receta se usa como sub-receta';
  end if;
  return new;
end $$;
revoke all on function validar_receta() from public, anon, authenticated;
create trigger trg_validar_receta before update on "Recetas"
  for each row execute function validar_receta();

-- ===== Bloqueos en maestros existentes =====
-- Unidad de medida: tampoco se cambia base/factor si la usan recetas (cuerpo de la 0017 + recetas).
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
         or exists (select 1 from "ComprasDetalle" d where d."UnidadMedida" = old."Codigo")
         or exists (select 1 from "RecetaDetalles" d where d."UnidadMedida" = old."Codigo")
         or exists (select 1 from "Recetas" r where r."RendimientoUnidad" = old."Codigo")) then
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

-- Producto: su unidad base tampoco cambia si está en recetas (cuerpo de la 0016 + recetas).
create or replace function validar_producto_unidad_base() returns trigger
language plpgsql set search_path = public as $$
begin
  -- la unidad base debe ser una unidad base (factor 1); si la unidad no existe, lo informa la FK
  if exists (select 1 from "UnidadesMedida" u where u."Codigo" = new."UnidadBase")
     and not exists (select 1 from "UnidadesMedida" u where u."Codigo" = new."UnidadBase" and u."UnidadBase" = u."Codigo" and u."Factor" = 1) then
    raise exception 'La unidad base del producto debe ser una unidad base (factor 1)';
  end if;
  if tg_op = 'UPDATE' and new."UnidadBase" is distinct from old."UnidadBase" and (
       exists (select 1 from "StockBodega" where "IdProducto" = new."IdProducto")
    or exists (select 1 from "ComprasDetalle" where "IdProducto" = new."IdProducto")
    or exists (select 1 from "SolicitudesDetalle" where "IdProducto" = new."IdProducto")
    or exists (select 1 from "MovimientosBodega" where "IdProducto" = new."IdProducto")) then
    raise exception 'No se puede cambiar la unidad base: el producto ya tiene stock o facturas';
  end if;
  if tg_op = 'UPDATE' and new."UnidadBase" is distinct from old."UnidadBase"
     and exists (select 1 from "RecetaDetalles" where "IdProducto" = new."IdProducto") then
    raise exception 'No se puede cambiar la unidad base: el producto se usa en recetas';
  end if;
  return new;
end $$;

-- ===== Permisos: el rol Compras gestiona recetas =====
insert into "RolesPermisos"("IdRol","Permiso")
select r."IdRol", p.permiso
from "Roles" r
join (values ('Compras','recetas.ver'),('Compras','recetas.gestionar')) as p(rol, permiso) on p.rol = r."NombreRol"
on conflict do nothing;
