-- Cerrar sesión ahora invalida en el servidor los JWT vigentes del usuario: "Claves"."VersionSesion" sube (como en fijar_clave) y
-- leerSesion rechaza cualquier token con la versión anterior. Antes "Salir" solo borraba la cookie y una copia del token seguía
-- valiendo hasta 8 horas. Invalida la sesión en todos los dispositivos del usuario. app_servidor no puede actualizar esa columna
-- directamente (0030), por eso va en una función SECURITY DEFINER.
create or replace function revocar_sesiones(p_usuario bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('clave:' || p_usuario, 0));
  update "Claves" set "VersionSesion" = "VersionSesion" + 1 where "IdUsuario" = p_usuario;
end $$;
revoke all on function revocar_sesiones(bigint) from public, anon, authenticated;
grant execute on function revocar_sesiones(bigint) to app_servidor;
