-- Vínculo opcional de una receta con un producto de Fudo (POS), para comparar precio de venta y costo.
-- "IdProductoFudo" es el id de Fudo tal cual (texto); un producto de Fudo se vincula a una sola receta.
alter table "Recetas" add column "IdProductoFudo" text;
create unique index recetas_fudo_unico on "Recetas"("IdProductoFudo") where "IdProductoFudo" is not null;

-- Vincula (o desvincula con texto vacío o null) la receta con un producto de Fudo.
create or replace function vincular_receta_fudo(p_usuario bigint, p_receta bigint, p_fudo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update "Recetas" set "IdProductoFudo" = nullif(btrim(coalesce(p_fudo, '')), ''),
                       "IdUsuarioModificacion" = p_usuario, "FechaRegistroModificacion" = now()
   where "IdReceta" = p_receta;
  if not found then raise exception 'La receta no existe'; end if;
exception when unique_violation then
  raise exception 'Ese producto de Fudo ya está vinculado a otra receta';
end $$;
revoke all on function vincular_receta_fudo(bigint, bigint, text) from public, anon, authenticated;
grant execute on function vincular_receta_fudo(bigint, bigint, text) to app_servidor;
