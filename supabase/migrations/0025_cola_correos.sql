-- Auditoría P04: cola de correos durable (outbox) con reintentos, espera creciente y sin duplicados.
create table "CorreosPendientes" (
  "IdCorreo" bigint generated always as identity primary key,
  "Para" text[] not null,
  "Asunto" text not null,
  "Html" text not null,
  "Estado" smallint not null default 0 check ("Estado" in (0, 1, 2)), -- 0 pendiente, 1 enviado, 2 fallido (sin más intentos)
  "Intentos" int not null default 0,
  "ProximoIntento" timestamptz not null default now(),
  "UltimoError" text,
  "ClaveUnica" text unique, -- el mismo aviso no se encola dos veces
  "FechaRegistroCreacion" timestamptz not null default now(),
  "FechaEnvio" timestamptz
);
create index "CorreosPendientes_pendientes" on "CorreosPendientes"("ProximoIntento") where "Estado" = 0;
alter table "CorreosPendientes" enable row level security;
revoke all on public."CorreosPendientes" from anon, authenticated;

-- Toma hasta p_max correos vencidos y los arrienda 5 minutos (dos procesos no toman el mismo).
create or replace function reclamar_correos(p_max int)
returns setof "CorreosPendientes" language sql security definer set search_path = public as $$
  with c as (
    select "IdCorreo" from "CorreosPendientes"
    where "Estado" = 0 and "ProximoIntento" <= now()
    order by "IdCorreo" limit p_max for update skip locked
  )
  update "CorreosPendientes" t set "Intentos" = t."Intentos" + 1, "ProximoIntento" = now() + interval '5 minutes'
  from c where t."IdCorreo" = c."IdCorreo" returning t.*;
$$;
revoke all on function reclamar_correos(int) from public, anon, authenticated;

-- Resultado de un envío: enviado, o reintento con espera 2^intentos minutos, o fallido al llegar al máximo.
create or replace function resolver_correo(p_id bigint, p_ok boolean, p_error text, p_max int default 5)
returns void language sql security definer set search_path = public as $$
  update "CorreosPendientes" set
    "Estado" = case when p_ok then 1 when "Intentos" >= p_max then 2 else 0 end,
    "FechaEnvio" = case when p_ok then now() end,
    "UltimoError" = case when p_ok then null else left(p_error, 500) end,
    "ProximoIntento" = case when not p_ok and "Intentos" < p_max then now() + make_interval(mins => power(2, "Intentos")::int) else "ProximoIntento" end
  where "IdCorreo" = p_id and "Estado" = 0;
$$;
revoke all on function resolver_correo(bigint,boolean,text,int) from public, anon, authenticated;
