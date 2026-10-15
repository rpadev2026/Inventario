-- Auditoría P01 (resto): el listado de proveedores también filtra y pagina en la base.
-- Reemplaza listar_pagina de la 0024 agregando la rama 'proveedores' (los permisos de la función se conservan).

-- Una página de un listado: {total, filas}. Solo tablas de la lista blanca (productos, usuarios, bodegas, recetas, proveedores); p_q se compara por subcadena (sin LIKE: no hay comodines).
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
      v_cols := '"IdProducto","Codigo","Nombre","UnidadBase","Formato","CostoUnitarioBase","StockMinimo","StockCritico","IdEstado"';
      v_hay := '"Nombre", "Codigo"';
      v_orden := 'normalizar_busqueda("Nombre"), "IdProducto"';
    when 'usuarios' then
      v_from := '"Usuarios"';
      v_cols := '"IdUsuario","Rut","Nombres","Apellidos","Correo","IdEstado"';
      v_hay := '"Rut", "Nombres" || '' '' || "Apellidos", "Correo"';
      v_orden := 'normalizar_busqueda("Apellidos"), normalizar_busqueda("Nombres"), "IdUsuario"';
    when 'bodegas' then
      v_from := '"Bodegas"';
      v_cols := '"IdBodega","NombreBodega","EsCentral","IdEstado"';
      v_hay := '"NombreBodega"';
      v_orden := '"EsCentral" desc, normalizar_busqueda("NombreBodega"), "IdBodega"';
    when 'recetas' then
      v_from := '"Recetas"';
      v_cols := '"IdReceta","CodigoReceta","Nombre","RendimientoPorciones","IdEstado"';
      v_hay := '"Nombre", "CodigoReceta"';
      v_orden := 'normalizar_busqueda("Nombre"), "IdReceta"';
    when 'proveedores' then
      v_from := '"Proveedores"';
      v_cols := '"IdProveedor","Rut","RazonSocial","Giro","Telefono","Correo","IdEstado"';
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
