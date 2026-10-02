-- Proveedores y sucursales guardan región, ciudad (provincia) y comuna por CÓDIGO.
-- Convierte el texto libre existente a códigos y luego agrega FK y validación de coherencia.

create or replace function convertir_territorio_texto(p_region text, p_ciudad text, p_comuna text)
returns table(region text, ciudad text, comuna text)
language sql stable set search_path = public as $$
  select x.reg, x.prov, x.com from (
    select r."Codigo" as reg, p."Codigo" as prov, c."Codigo" as com, 1 as prio
      from "Comunas" c
      join "Provincias" p on p."Codigo" = c."CodigoProvincia"
      join "Regiones" r on r."Codigo" = p."CodigoRegion"
     where $3 is not null
       and lower(translate(trim(c."Nombre"),'áéíóúüñ','aeiouun')) = lower(translate(trim($3),'áéíóúüñ','aeiouun'))
    union all
    select r."Codigo", p."Codigo", null, 2
      from "Provincias" p
      join "Regiones" r on r."Codigo" = p."CodigoRegion"
     where $2 is not null
       and lower(translate(trim(p."Nombre"),'áéíóúüñ','aeiouun')) = lower(translate(trim($2),'áéíóúüñ','aeiouun'))
    union all
    select r."Codigo", null, null, 3
      from "Regiones" r
     where $1 is not null
       and lower(translate(trim(r."Nombre"),'áéíóúüñ','aeiouun')) = lower(translate(trim($1),'áéíóúüñ','aeiouun'))
    union all
    select null, null, null, 4
  ) x
  order by x.prio
  limit 1
$$;

revoke all on function convertir_territorio_texto(text,text,text) from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['Proveedores','ProveedoresSucursales'] loop
    execute format('update %I s set "Region" = c.region, "Ciudad" = c.ciudad, "Comuna" = c.comuna
      from (select s2.ctid as id, (convertir_territorio_texto(s2."Region", s2."Ciudad", s2."Comuna")).*
              from %I s2) c
      where s.ctid = c.id', t, t);
    execute format('alter table %I
      add constraint %I foreign key ("Region") references "Regiones"("Codigo"),
      add constraint %I foreign key ("Ciudad") references "Provincias"("Codigo"),
      add constraint %I foreign key ("Comuna") references "Comunas"("Codigo")',
      t, t || '_Region_fkey', t || '_Ciudad_fkey', t || '_Comuna_fkey');
  end loop;
end $$;

create or replace function validar_territorio() returns trigger
language plpgsql set search_path = public as $$
begin
  if new."Comuna" is not null and new."Ciudad" is null then
    raise exception 'La comuna requiere ciudad';
  end if;
  if new."Ciudad" is not null and new."Region" is null then
    raise exception 'La ciudad requiere región';
  end if;
  if new."Ciudad" is not null and not exists (
    select 1 from "Provincias" where "Codigo" = new."Ciudad" and "CodigoRegion" = new."Region") then
    raise exception 'La ciudad no pertenece a la región';
  end if;
  if new."Comuna" is not null and not exists (
    select 1 from "Comunas" where "Codigo" = new."Comuna" and "CodigoProvincia" = new."Ciudad") then
    raise exception 'La comuna no pertenece a la ciudad';
  end if;
  return new;
end $$;

revoke all on function validar_territorio() from public, anon, authenticated;

create trigger trg_validar_territorio before insert or update on "Proveedores"
  for each row execute function validar_territorio();
create trigger trg_validar_territorio before insert or update on "ProveedoresSucursales"
  for each row execute function validar_territorio();
