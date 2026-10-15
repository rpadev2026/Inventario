-- Filtro por solicitante en el listado de solicitudes: los usuarios que han hecho al menos una solicitud
-- ([{id, nombre}], ordenados por apellidos y nombres sin tildes) y un índice para filtrar por solicitante.

create or replace function listar_solicitantes() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u."IdUsuario", 'nombre', u."Nombres" || ' ' || u."Apellidos")
           order by normalizar_busqueda(u."Apellidos"), normalizar_busqueda(u."Nombres"), u."IdUsuario"), '[]'::jsonb)
  from "Usuarios" u
  where exists (select 1 from "Solicitudes" s where s."IdUsuarioSolicitante" = u."IdUsuario");
$$;
revoke all on function listar_solicitantes() from public, anon, authenticated;

create index if not exists "Solicitudes_solicitante_idx" on "Solicitudes"("IdUsuarioSolicitante", "IdSolicitud" desc);
