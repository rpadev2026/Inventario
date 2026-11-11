-- Sincronización de ventas de Fudo en segundo plano: cola de trabajos (uno activo a la vez) y listado paginado de lo vendido sin descontar.
-- La tabla solo se toca por funciones (el rol app_servidor no tiene acceso directo, como "IntentosLogin").
create table "TrabajosFudo" (
  "IdTrabajo" bigint generated always as identity primary key,
  "Estado" smallint not null default 0 check ("Estado" in (0, 1, 2, 3)), -- 0 pendiente, 1 procesando, 2 listo, 3 con error
  "Origen" text not null check ("Origen" in ('manual', 'cron')),
  "IdUsuario" bigint references "Usuarios"("IdUsuario"), -- quien lo pidió (null si lo pidió el cron)
  "Intentos" int not null default 0,
  "FechaCreacion" timestamptz not null default now(),
  "FechaInicio" timestamptz,
  "FechaFin" timestamptz,
  "Latido" timestamptz, -- última señal de vida del proceso que lo ejecuta: si se apaga, otro lo retoma
  "Resumen" jsonb, -- avance mientras corre y resultado al terminar: {revisadas, total, procesadas, yaProcesadas, lineasOmitidas, errores}
  "Error" text
);
-- A lo más un trabajo pendiente o en curso: pedir otra sincronización mientras hay una activa no duplica el trabajo.
create unique index trabajosfudo_activo on "TrabajosFudo"((true)) where "Estado" in (0, 1);
alter table "TrabajosFudo" enable row level security;
revoke all on public."TrabajosFudo" from anon, authenticated;

-- Pide una sincronización. Si ya hay una activa devuelve esa (nuevo = false).
create or replace function encolar_trabajo_fudo(p_usuario bigint, p_origen text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  for i in 1..2 loop
    insert into "TrabajosFudo"("Origen", "IdUsuario") values (p_origen, p_usuario) on conflict do nothing returning "IdTrabajo" into v_id;
    if v_id is not null then return jsonb_build_object('id', v_id, 'nuevo', true); end if;
    select "IdTrabajo" into v_id from "TrabajosFudo" where "Estado" in (0, 1);
    if v_id is not null then return jsonb_build_object('id', v_id, 'nuevo', false); end if;
  end loop; -- el activo terminó justo entre el intento y la lectura: se vuelve a intentar una vez
  raise exception 'No se pudo encolar la sincronización';
end $$;

-- Toma el trabajo pendiente más antiguo, o uno «en curso» sin latido hace más de 5 minutos (el proceso murió). A los 3 intentos se da por fallido.
create or replace function reclamar_trabajo_fudo()
returns setof "TrabajosFudo" language plpgsql security definer set search_path = public as $$
begin
  update "TrabajosFudo" set "Estado" = 3, "FechaFin" = now(), "Error" = 'El proceso se interrumpió varias veces'
  where "Estado" = 1 and "Latido" < now() - interval '5 minutes' and "Intentos" >= 3;
  return query
  update "TrabajosFudo" t set "Estado" = 1, "Intentos" = t."Intentos" + 1, "FechaInicio" = now(), "Latido" = now()
  where t."IdTrabajo" = (
    select "IdTrabajo" from "TrabajosFudo"
    where "Estado" = 0 or ("Estado" = 1 and "Latido" < now() - interval '5 minutes')
    order by "IdTrabajo" limit 1 for update skip locked)
  returning t.*;
end $$;

-- Señal de vida y avance del trabajo en curso.
create or replace function latido_trabajo_fudo(p_id bigint, p_avance jsonb)
returns void language sql security definer set search_path = public as $$
  update "TrabajosFudo" set "Latido" = now(), "Resumen" = p_avance where "IdTrabajo" = p_id and "Estado" = 1;
$$;

-- Cierra el trabajo (listo, o con error si viene p_error) y deja solo los 30 últimos terminados.
create or replace function terminar_trabajo_fudo(p_id bigint, p_resumen jsonb, p_error text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update "TrabajosFudo" set "Estado" = case when p_error is null then 2 else 3 end, "FechaFin" = now(),
    "Resumen" = coalesce(p_resumen, "Resumen"), "Error" = left(p_error, 500)
  where "IdTrabajo" = p_id and "Estado" = 1;
  delete from "TrabajosFudo" where "Estado" in (2, 3) and "IdTrabajo" not in (
    select "IdTrabajo" from "TrabajosFudo" where "Estado" in (2, 3) order by "IdTrabajo" desc limit 30);
end $$;

-- Para la pantalla: el trabajo activo (si lo hay) y el último terminado.
create or replace function estado_trabajo_fudo()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'actual', (select to_jsonb(t) from "TrabajosFudo" t where "Estado" in (0, 1)),
    'ultimo', (select to_jsonb(t) from "TrabajosFudo" t where "Estado" in (2, 3) order by "IdTrabajo" desc limit 1));
$$;

-- Lo vendido que no descontó nada, sumado por producto de Fudo y paginado en la base (antes se armaba en la app con las últimas 200 ventas).
-- Nombre y motivo son los de la venta más reciente. Devuelve {total, filas: [{producto, nombre, motivo, cantidad}]}.
create or replace function faltantes_ventas_fudo(p_desde int, p_limite int)
returns jsonb language sql stable security definer set search_path = public as $$
  with o as (
    select e->>'producto' as prod, e->>'nombre' as nom, e->>'motivo' as mot, (e->>'cantidad')::numeric as cant, v."FechaCierre" as fc
    from "VentasFudo" v cross join lateral jsonb_array_elements(v."Omitidos") e
  ), g as (
    select prod, (array_agg(nom order by fc desc))[1] as nombre, (array_agg(mot order by fc desc))[1] as motivo, sum(cant) as cantidad
    from o group by prod
  )
  select jsonb_build_object(
    'total', (select count(*) from g),
    'filas', coalesce((select jsonb_agg(jsonb_build_object('producto', x.prod, 'nombre', x.nombre, 'motivo', x.motivo, 'cantidad', x.cantidad) order by x.cantidad desc, x.nombre, x.prod)
                       from (select * from g order by cantidad desc, nombre, prod limit greatest(p_limite, 0) offset greatest(p_desde, 0)) x), '[]'::jsonb));
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'encolar_trabajo_fudo(bigint, text)', 'reclamar_trabajo_fudo()', 'latido_trabajo_fudo(bigint, jsonb)',
    'terminar_trabajo_fudo(bigint, jsonb, text)', 'estado_trabajo_fudo()', 'faltantes_ventas_fudo(int, int)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to app_servidor', f);
  end loop;
end $$;
