-- Territorio: Regiones, Provincias (ciudades) y Comunas, con FK por código (CUT).
-- Los datos oficiales se cargan en 0009_territorio_datos.sql.
do $$
declare
  t text;
begin
  foreach t in array array['Regiones','Provincias','Comunas'] loop
    execute format('create table %I (
      "Id%s" smallint generated always as identity primary key,
      "Codigo" text not null unique check ("Codigo" ~ %L),
      "Nombre" text not null,
      %s
      "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
      "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
      "FechaRegistroCreacion" timestamptz not null default now(),
      "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
      "FechaRegistroModificacion" timestamptz not null default now()
    )', t,
      case t when 'Regiones' then 'Region' when 'Provincias' then 'Provincia' else 'Comuna' end,
      case t when 'Regiones' then '^[0-9]{2}$' when 'Provincias' then '^[0-9]{3}$' else '^[0-9]{5}$' end,
      case t
        when 'Provincias' then '"CodigoRegion" text not null references "Regiones"("Codigo"),'
        when 'Comunas' then '"CodigoProvincia" text not null references "Provincias"("Codigo"),'
        else '' end);
    execute format('create trigger trg_mod before update on %I for each row execute function set_modificacion()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

create index "Provincias_CodigoRegion_idx" on "Provincias"("CodigoRegion");
create index "Comunas_CodigoProvincia_idx" on "Comunas"("CodigoProvincia");

create or replace function desactivar_territorio() returns trigger
language plpgsql set search_path = public as $$
begin
  if old."IdEstado" = 1 and new."IdEstado" = 0 then
    if tg_table_name = 'Regiones' then
      if exists (select 1 from "Provincias" where "CodigoRegion" = old."Codigo" and "IdEstado" = 1) then
        raise exception 'No se puede desactivar: la región tiene ciudades vigentes';
      end if;
    else
      if exists (select 1 from "Comunas" where "CodigoProvincia" = old."Codigo" and "IdEstado" = 1) then
        raise exception 'No se puede desactivar: la ciudad tiene comunas vigentes';
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger trg_desactivar_territorio before update of "IdEstado" on "Regiones"
  for each row execute function desactivar_territorio();
create trigger trg_desactivar_territorio before update of "IdEstado" on "Provincias"
  for each row execute function desactivar_territorio();

revoke all on function desactivar_territorio() from public, anon, authenticated;
