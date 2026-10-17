-- Corrige 0023: registrar_fallo_login ponía "BloqueadoHasta" = null en cada fallo que no llegaba al máximo y reiniciaba el contador al
-- bloquear. Los intentos concurrentes que ya habían leído la cuenta sin bloquear (el candado se mira antes de verificar la clave,
-- que es lento) registraban su fallo DESPUÉS del bloqueo: el siguiente ponía el contador en 1 y borraba el candado, así que con
-- ráfagas de 6 la cuenta nunca quedaba bloqueada. Ahora un fallo con la cuenta ya bloqueada no cambia nada (el UPDATE re-evalúa el
-- WHERE sobre la fila vigente cuando otro lo bloqueó primero), y solo cuenta cuando no hay bloqueo vigente.
create or replace function registrar_fallo_login(p_usuario bigint, p_max int, p_bloqueo_min int)
returns void language sql security definer set search_path = public as $$
  update "Claves" set
    "IntentosFallidos" = case when "IntentosFallidos" + 1 >= p_max then 0 else "IntentosFallidos" + 1 end,
    "BloqueadoHasta" = case when "IntentosFallidos" + 1 >= p_max then now() + make_interval(mins => p_bloqueo_min) else null end
  where "IdUsuario" = p_usuario
    and ("BloqueadoHasta" is null or "BloqueadoHasta" <= now());
$$;
revoke all on function registrar_fallo_login(bigint,int,int) from public, anon, authenticated;
grant execute on function registrar_fallo_login(bigint,int,int) to app_servidor;
