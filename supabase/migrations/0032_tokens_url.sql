-- Identificador público (uuid) en la URL de las pantallas de detalle y edición: no revela cuántos registros hay ni se puede adivinar.
-- Los "Id..." siguen siendo las claves internas. Igual que "Compras"."Token" (0031).
alter table "Productos" add column "Token" uuid not null default gen_random_uuid();
alter table "Productos" add constraint productos_token_unico unique ("Token");
alter table "Proveedores" add column "Token" uuid not null default gen_random_uuid();
alter table "Proveedores" add constraint proveedores_token_unico unique ("Token");
alter table "ProveedoresSucursales" add column "Token" uuid not null default gen_random_uuid();
alter table "ProveedoresSucursales" add constraint proveedoressucursales_token_unico unique ("Token");
alter table "ProveedoresVendedores" add column "Token" uuid not null default gen_random_uuid();
alter table "ProveedoresVendedores" add constraint proveedoresvendedores_token_unico unique ("Token");
alter table "Recetas" add column "Token" uuid not null default gen_random_uuid();
alter table "Recetas" add constraint recetas_token_unico unique ("Token");
alter table "Usuarios" add column "Token" uuid not null default gen_random_uuid();
alter table "Usuarios" add constraint usuarios_token_unico unique ("Token");
alter table "Bodegas" add column "Token" uuid not null default gen_random_uuid();
alter table "Bodegas" add constraint bodegas_token_unico unique ("Token");
alter table "Roles" add column "Token" uuid not null default gen_random_uuid();
alter table "Roles" add constraint roles_token_unico unique ("Token");
alter table "Solicitudes" add column "Token" uuid not null default gen_random_uuid();
alter table "Solicitudes" add constraint solicitudes_token_unico unique ("Token");

-- listar_pagina devuelve también el "Token" de cada fila (se conservan los permisos de la 0027).
create or replace function listar_pagina(p_tabla text, p_q text, p_estado smallint, p_off int, p_lim int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_cols text; v_from text; v_hay text; v_orden text;
  v_q text := normalizar_busqueda(p_q);
  v_donde text;
  v_total bigint; v_filas jsonb;
begin
  case p_tabla
    when 'productos' then
      v_from := '"Productos"';
      v_cols := '"Token","IdProducto","Codigo","Nombre","UnidadBase","Formato","CostoUnitarioBase","StockMinimo","StockCritico","IdEstado"';
      v_hay := '"Nombre", "Codigo"';
      v_orden := 'normalizar_busqueda("Nombre"), "IdProducto"';
    when 'usuarios' then
      v_from := '"Usuarios"';
      v_cols := '"Token","IdUsuario","Rut","Nombres","Apellidos","Correo","IdEstado"';
      v_hay := '"Rut", "Nombres" || '' '' || "Apellidos", "Correo"';
      v_orden := 'normalizar_busqueda("Apellidos"), normalizar_busqueda("Nombres"), "IdUsuario"';
    when 'bodegas' then
      v_from := '"Bodegas"';
      v_cols := '"Token","IdBodega","NombreBodega","EsCentral","IdEstado"';
      v_hay := '"NombreBodega"';
      v_orden := '"EsCentral" desc, normalizar_busqueda("NombreBodega"), "IdBodega"';
    when 'recetas' then
      v_from := '"Recetas"';
      v_cols := '"Token","IdReceta","CodigoReceta","Nombre","RendimientoPorciones","IdEstado"';
      v_hay := '"Nombre", "CodigoReceta"';
      v_orden := 'normalizar_busqueda("Nombre"), "IdReceta"';
    when 'proveedores' then
      v_from := '"Proveedores"';
      v_cols := '"Token","IdProveedor","Rut","RazonSocial","Giro","Telefono","Correo","IdEstado"';
      v_hay := '"Rut", "RazonSocial", "Giro"';
      v_orden := 'normalizar_busqueda("RazonSocial"), "IdProveedor"';
    else raise exception 'Listado desconocido';
  end case;
  if p_off < 0 or p_lim < 1 or p_lim > 100 then raise exception 'Paginación inválida'; end if;

  -- (campo1 contiene q) or (campo2 contiene q) ...; q vacío = todos.
  select string_agg(format('position($1 in normalizar_busqueda(%s)) > 0', c), ' or ')
    into v_donde from unnest(string_to_array(v_hay, ', ')) as c;
  v_donde := format('($2::smallint is null or "IdEstado" = $2) and ($1 = '''' or %s)', v_donde);

  execute format('select count(*) from %s where %s', v_from, v_donde) into v_total using v_q, p_estado;
  execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from (select %s from %s where %s order by %s offset $3 limit $4) x',
                 v_cols, v_from, v_donde, v_orden) into v_filas using v_q, p_estado, p_off, p_lim;
  return jsonb_build_object('total', v_total, 'filas', v_filas);
end $$;
revoke all on function listar_pagina(text,text,smallint,int,int) from public, anon, authenticated;
