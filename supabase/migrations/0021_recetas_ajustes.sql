-- Ajustes de Recetas: los guardados que podrían cerrar un ciclo (o desactivar una sub-receta en uso) se serializan con
-- un bloqueo de transacción, y el mensaje de bloqueo de una unidad nombra también a las recetas.
create or replace function validar_receta_detalle() returns trigger
language plpgsql set search_path = public as $$
declare
  v_familia text;
  v_unidad text;
begin
  -- Serializa las validaciones de ciclos: dos guardados simultáneos no pueden cerrar un ciclo entre sí.
  perform pg_advisory_xact_lock(hashtext('recetas-arbol'));
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

create or replace function validar_receta() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Mismo bloqueo: desactivar una sub-receta no puede cruzarse con un guardado que la agrega a otra receta.
  perform pg_advisory_xact_lock(hashtext('recetas-arbol'));
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
      raise exception 'No se puede cambiar la unidad base ni el factor: hay productos, facturas o recetas que usan esta unidad';
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
