-- Búsqueda de sub-recetas en el servidor para el formulario de recetas: vigentes con rendimiento (las únicas que
-- se pueden usar como ingrediente), por nombre o código sin tildes, SIN la receta que se edita ni las que ya la
-- contienen (directa o indirectamente: elegirlas formaría un ciclo). Devuelve [{id, nombre, rendimientoUnidad}].
create or replace function buscar_subrecetas(p_q text, p_excluir bigint, p_lim int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_q text := normalizar_busqueda(p_q);
begin
  if p_lim < 1 or p_lim > 100 then raise exception 'Paginación inválida'; end if;
  return coalesce((
    with recursive ancestros(id) as (
      select d."IdReceta" from "RecetaDetalles" d where d."IdSubReceta" = p_excluir
      union -- sin ALL: termina aunque los datos tuvieran un ciclo
      select d."IdReceta" from "RecetaDetalles" d join ancestros a on d."IdSubReceta" = a.id
    ), hallada as (
      select t."IdReceta", t."Nombre", t."RendimientoUnidad" from "Recetas" t
      where t."IdEstado" = 1 and t."RendimientoUnidad" is not null
        and (p_excluir is null or (t."IdReceta" <> p_excluir and t."IdReceta" not in (select id from ancestros)))
        and (v_q = '' or position(v_q in normalizar_busqueda(t."Nombre")) > 0
                      or position(v_q in normalizar_busqueda(coalesce(t."CodigoReceta", ''))) > 0)
      order by normalizar_busqueda(t."Nombre"), t."IdReceta" limit p_lim
    )
    select jsonb_agg(jsonb_build_object('id', h."IdReceta", 'nombre', h."Nombre", 'rendimientoUnidad', h."RendimientoUnidad")
                     order by normalizar_busqueda(h."Nombre"), h."IdReceta") from hallada h
  ), '[]'::jsonb);
end $$;
revoke all on function buscar_subrecetas(text,bigint,int) from public, anon, authenticated;
