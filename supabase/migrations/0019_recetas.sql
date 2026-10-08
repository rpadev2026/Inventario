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

-- ===== RPC: guardar_receta (crea o edita la cabecera y reemplaza todos los detalles, en una transacción) =====
-- p_cabecera: {"codigo","nombre","porciones","rendimientoCantidad","rendimientoUnidad","estado"}
-- p_detalle : [{"producto": id | "subreceta": id, "cantidad","porcion","unidad","merma"}] (merma = fracción: 0,25 = 25 %)
create or replace function guardar_receta(p_usuario bigint, p_id bigint, p_cabecera jsonb, p_detalle jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id bigint;
  v_nombre text;
  v_porciones numeric;
  v_rend numeric;
  v_rend_u text := nullif(btrim(coalesce(p_cabecera->>'rendimientoUnidad', '')), '');
  v_estado smallint;
  d jsonb;
  v_ing bigint;
  v_es_sub boolean;
  v_cant numeric;
  v_porc numeric;
  v_merma numeric;
  v_unidad text;
  v_vistos text[] := '{}';
  v_clave text;
  v_estado_ing smallint;
  v_nombre_ing text;
begin
  if p_cabecera is null or jsonb_typeof(p_cabecera) <> 'object' then
    raise exception 'Datos de la receta no válidos'; end if;
  v_nombre := btrim(coalesce(p_cabecera->>'nombre', ''));
  if char_length(v_nombre) < 1 or char_length(v_nombre) > 150 then
    raise exception 'El nombre de la receta debe tener entre 1 y 150 caracteres'; end if;
  if coalesce(p_cabecera->>'porciones', '1') !~ '^[0-9]{1,6}(\.[0-9]{1,2})?$' or coalesce(p_cabecera->>'porciones', '1')::numeric <= 0 then
    raise exception 'Las porciones deben ser un número mayor que 0 (hasta 2 decimales)'; end if;
  v_porciones := coalesce(p_cabecera->>'porciones', '1')::numeric;
  if coalesce(p_cabecera->>'estado', '1') not in ('0', '1') then
    raise exception 'Estado de receta inválido'; end if;
  v_estado := coalesce(p_cabecera->>'estado', '1')::smallint;

  if (p_cabecera->>'rendimientoCantidad') is null <> (v_rend_u is null) then
    raise exception 'El rendimiento requiere cantidad y unidad'; end if;
  if v_rend_u is not null then
    if p_cabecera->>'rendimientoCantidad' !~ '^[0-9]{1,11}(\.[0-9]{1,3})?$' or (p_cabecera->>'rendimientoCantidad')::numeric <= 0 then
      raise exception 'El rendimiento debe ser un número mayor que 0 (hasta 3 decimales)'; end if;
    v_rend := (p_cabecera->>'rendimientoCantidad')::numeric;
    if not exists (select 1 from "UnidadesMedida" where "Codigo" = v_rend_u and "IdEstado" = 1) then
      raise exception 'La unidad del rendimiento no existe o no está vigente'; end if;
  end if;

  if p_detalle is null or jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0
     or jsonb_array_length(p_detalle) > 200 then
    raise exception 'Agregue al menos un ingrediente (máximo 200)'; end if;

  if p_id is null then
    insert into "Recetas"("CodigoReceta","Nombre","RendimientoPorciones","RendimientoCantidad","RendimientoUnidad","IdEstado","IdUsuarioCreacion","IdUsuarioModificacion")
    values (nullif(btrim(coalesce(p_cabecera->>'codigo', '')), ''), v_nombre, v_porciones, v_rend, v_rend_u, v_estado, p_usuario, p_usuario)
    returning "IdReceta" into v_id;
  else
    perform 1 from "Recetas" where "IdReceta" = p_id for update;
    if not found then raise exception 'La receta no existe'; end if;
    v_id := p_id;
    update "Recetas" set "CodigoReceta" = nullif(btrim(coalesce(p_cabecera->>'codigo', '')), ''), "Nombre" = v_nombre,
      "RendimientoPorciones" = v_porciones, "RendimientoCantidad" = v_rend, "RendimientoUnidad" = v_rend_u,
      "IdEstado" = v_estado, "IdUsuarioModificacion" = p_usuario
    where "IdReceta" = v_id;
    delete from "RecetaDetalles" where "IdReceta" = v_id;
  end if;

  for d in select * from jsonb_array_elements(p_detalle) loop
    if (d ? 'producto') = (d ? 'subreceta') then raise exception 'Ingrediente no válido'; end if;
    v_es_sub := d ? 'subreceta';
    if v_es_sub then
      if (d->>'subreceta') !~ '^[0-9]{1,15}$' then raise exception 'Sub-receta no válida'; end if;
      v_ing := (d->>'subreceta')::bigint;
      select "IdEstado", "Nombre" into v_estado_ing, v_nombre_ing from "Recetas" where "IdReceta" = v_ing;
      if not found then raise exception 'La sub-receta % no existe', v_ing; end if;
      if v_estado_ing <> 1 then raise exception 'La sub-receta % no está vigente', v_nombre_ing; end if;
      v_clave := 's' || v_ing;
    else
      v_ing := producto_de_item(d);
      select "IdEstado" into v_estado_ing from "Productos" where "IdProducto" = v_ing;
      if not found then raise exception 'El producto % no existe', v_ing; end if;
      if v_estado_ing <> 1 then raise exception 'El producto % no está vigente', etiqueta_producto(v_ing); end if;
      v_clave := 'p' || v_ing;
    end if;
    if v_clave = any(v_vistos) then
      raise exception 'Ingrediente repetido en la receta: %', case when v_es_sub then v_nombre_ing else etiqueta_producto(v_ing) end;
    end if;
    v_vistos := v_vistos || v_clave;

    if coalesce(d->>'cantidad', '') !~ '^[0-9]{1,7}(\.[0-9]{1,3})?$' or (d->>'cantidad')::numeric <= 0 then
      raise exception 'La cantidad debe ser un número mayor que 0 (hasta 3 decimales)'; end if;
    if coalesce(d->>'porcion', '') !~ '^[0-9]{1,7}(\.[0-9]{1,3})?$' or (d->>'porcion')::numeric <= 0 then
      raise exception 'La porción neta debe ser un número mayor que 0 (hasta 3 decimales)'; end if;
    if coalesce(d->>'merma', '0') !~ '^[0-9]{1,2}(\.[0-9]{1,4})?$' then
      raise exception 'La merma debe ser un número entre 0 y 99 (fracción: 0,25 = 25 %%)'; end if;
    v_cant := (d->>'cantidad')::numeric; v_porc := (d->>'porcion')::numeric; v_merma := coalesce(d->>'merma', '0')::numeric;
    v_unidad := nullif(btrim(coalesce(d->>'unidad', '')), '');
    if v_unidad is null or not exists (select 1 from "UnidadesMedida" where "Codigo" = v_unidad and "IdEstado" = 1) then
      raise exception 'La unidad % no existe o no está vigente', coalesce(v_unidad, '(vacía)'); end if;

    insert into "RecetaDetalles"("IdReceta","IdProducto","IdSubReceta","Cantidad","PorcionNeta","UnidadMedida","PorcentajeMerma")
    values (v_id, case when v_es_sub then null else v_ing end, case when v_es_sub then v_ing else null end, v_cant, v_porc, v_unidad, v_merma);
  end loop;
  return v_id;
end $$;
revoke all on function guardar_receta(bigint, bigint, jsonb, jsonb) from public, anon, authenticated;

-- ===== RPC: calcular_receta (costo total, por porción y por unidad base del rendimiento) =====
-- Devuelve {"total","porcion","incompleto","costoPorBase","lineas":[{"detalle","tipo","id","nombre","cantidadBruta","unidad","costo","sinCosto"}]}.
-- cantidadBruta = Cantidad × PorcionNeta × (1 + merma), en la unidad de la línea. Un ingrediente sin costo deja la línea
-- «sin costo» y la receta «incompleta» (el total suma solo las líneas con costo; costoPorBase es null si es incompleta).
create or replace function calcular_receta_n(p_receta bigint, p_nivel int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_rec "Recetas"%rowtype;
  l record;
  v_sub jsonb;
  v_bruto numeric;
  v_cpb numeric;
  v_costo numeric;
  v_total numeric := 0;
  v_incompleto boolean := false;
  v_lineas jsonb := '[]'::jsonb;
  v_factor_rend numeric;
begin
  select * into v_rec from "Recetas" where "IdReceta" = p_receta;
  if not found then raise exception 'La receta no existe'; end if;
  if p_nivel > 20 then raise exception 'Receta demasiado anidada'; end if;

  for l in
    select d."IdDetalle", d."IdProducto", d."IdSubReceta", d."Cantidad", d."PorcionNeta", d."UnidadMedida", d."PorcentajeMerma",
           u."Factor" as factor, p."Nombre" as nombre_producto, p."CostoUnitarioBase" as costo_producto, s."Nombre" as nombre_sub
    from "RecetaDetalles" d
    join "UnidadesMedida" u on u."Codigo" = d."UnidadMedida"
    left join "Productos" p on p."IdProducto" = d."IdProducto"
    left join "Recetas" s on s."IdReceta" = d."IdSubReceta"
    where d."IdReceta" = p_receta order by d."IdDetalle"
  loop
    v_bruto := l."Cantidad" * l."PorcionNeta" * (1 + l."PorcentajeMerma");
    if l."IdProducto" is not null then
      v_cpb := l.costo_producto;
    else
      v_sub := calcular_receta_n(l."IdSubReceta", p_nivel + 1);
      v_cpb := (v_sub->>'costoPorBase')::numeric;
    end if;
    v_costo := case when v_cpb is null then null else round(v_bruto * l.factor * v_cpb, 2) end;
    if v_costo is null then v_incompleto := true; else v_total := v_total + v_costo; end if;
    v_lineas := v_lineas || jsonb_build_object(
      'detalle', l."IdDetalle", 'tipo', case when l."IdProducto" is not null then 'producto' else 'subreceta' end,
      'id', coalesce(l."IdProducto", l."IdSubReceta"), 'nombre', coalesce(l.nombre_producto, l.nombre_sub),
      'cantidadBruta', v_bruto, 'unidad', l."UnidadMedida", 'costo', v_costo, 'sinCosto', v_costo is null);
  end loop;

  select "Factor" into v_factor_rend from "UnidadesMedida" where "Codigo" = v_rec."RendimientoUnidad";
  return jsonb_build_object(
    'total', v_total, 'porcion', round(v_total / v_rec."RendimientoPorciones", 2), 'incompleto', v_incompleto,
    'costoPorBase', case when v_rec."RendimientoCantidad" is null or v_incompleto then null
                         else v_total / (v_rec."RendimientoCantidad" * v_factor_rend) end,
    'lineas', v_lineas);
end $$;
revoke all on function calcular_receta_n(bigint, int) from public, anon, authenticated;

create or replace function calcular_receta(p_receta bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select calcular_receta_n(p_receta, 0);
$$;
revoke all on function calcular_receta(bigint) from public, anon, authenticated;
