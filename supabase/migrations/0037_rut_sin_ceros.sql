-- Un RUT tiene una sola forma canónica: sin ceros a la izquierda (01234567-4 es 1234567-4). La validación aceptaba ambas y se
-- guardaban como textos distintos, evadiendo las claves únicas de proveedores y vendedores. La aplicación ya normaliza
-- (lib/validation/rut.ts); esta migración corrige lo guardado y deja un trigger para que ninguna ruta pueda volver a guardar ceros.

-- 1) Si ya hay duplicados que solo difieren en ceros, la migración se detiene con un mensaje claro: hay que unificarlos a mano.
do $$
begin
  if exists (select 1 from "Proveedores" group by regexp_replace("Rut", '^0+(?=[0-9])', '') having count(*) > 1) then
    raise exception 'Hay proveedores con el mismo RUT escrito con y sin ceros a la izquierda: unifíquelos antes de migrar';
  end if;
  if exists (select 1 from "Usuarios" group by regexp_replace("Rut", '^0+(?=[0-9])', '') having count(*) > 1) then
    raise exception 'Hay usuarios con el mismo RUT escrito con y sin ceros a la izquierda: unifíquelos antes de migrar';
  end if;
  if exists (select 1 from "ProveedoresVendedores" group by "IdProveedor", regexp_replace("Rut", '^0+(?=[0-9])', '') having count(*) > 1) then
    raise exception 'Hay vendedores del mismo proveedor con el mismo RUT escrito con y sin ceros a la izquierda: unifíquelos antes de migrar';
  end if;
  if exists (select 1 from "ProveedoresVendedores" where "IdEstado" = 1 group by regexp_replace("Rut", '^0+(?=[0-9])', '') having count(*) > 1) then
    raise exception 'Hay un vendedor vigente en más de un proveedor con el RUT escrito con y sin ceros a la izquierda: corríjalo antes de migrar';
  end if;
end $$;

-- 2) Normaliza lo existente (el snapshot del RUT en las facturas también, para que la coincidencia con Bsale funcione).
update "Proveedores" set "Rut" = regexp_replace("Rut", '^0+(?=[0-9])', '') where "Rut" ~ '^0+[0-9]';
update "Proveedores" set "RutRepresentanteLegal" = regexp_replace("RutRepresentanteLegal", '^0+(?=[0-9])', '') where "RutRepresentanteLegal" ~ '^0+[0-9]';
update "ProveedoresVendedores" set "Rut" = regexp_replace("Rut", '^0+(?=[0-9])', '') where "Rut" ~ '^0+[0-9]';
update "Usuarios" set "Rut" = regexp_replace("Rut", '^0+(?=[0-9])', '') where "Rut" ~ '^0+[0-9]';
update "Compras" set "RutProveedor" = regexp_replace("RutProveedor", '^0+(?=[0-9])', '') where "RutProveedor" ~ '^0+[0-9]';

-- 3) Cualquier escritura futura se guarda sin ceros a la izquierda, venga de la aplicación, de un script o del SQL Editor.
create or replace function normalizar_rut() returns trigger language plpgsql set search_path = public as $$
begin
  new."Rut" := regexp_replace(new."Rut", '^0+(?=[0-9])', '');
  return new;
end $$;
revoke all on function normalizar_rut() from public, anon, authenticated;

create or replace function normalizar_rut_representante() returns trigger language plpgsql set search_path = public as $$
begin
  new."RutRepresentanteLegal" := regexp_replace(new."RutRepresentanteLegal", '^0+(?=[0-9])', '');
  return new;
end $$;
revoke all on function normalizar_rut_representante() from public, anon, authenticated;

create trigger trg_normalizar_rut before insert or update of "Rut" on "Proveedores" for each row execute function normalizar_rut();
create trigger trg_normalizar_rut before insert or update of "Rut" on "ProveedoresVendedores" for each row execute function normalizar_rut();
create trigger trg_normalizar_rut before insert or update of "Rut" on "Usuarios" for each row execute function normalizar_rut();
create trigger trg_normalizar_rut_representante before insert or update of "RutRepresentanteLegal" on "Proveedores" for each row execute function normalizar_rut_representante();
