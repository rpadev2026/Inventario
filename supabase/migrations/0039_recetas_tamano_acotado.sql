-- Acota el tamaño de una receta al expandir sus sub-recetas. calcular_receta_n y consumo_receta_n recorren cada sub-receta como un
-- árbol, sin memorizar: si varias recetas de un nivel incluyen a las del nivel siguiente (permitido: no hay ciclo), el trabajo crece
-- como (recetas por nivel)^(niveles) y una sola receta bastaba para saturar la base al listar /recetas, buscar sub-recetas o procesar
-- ventas de Fudo. Al guardar una línea de sub-receta se mide, en tiempo polinomial, cuántas recetas se visitan al expandir la receta
-- y TODAS las que la contienen, y se rechaza el guardado si alguna pasa del tope. También exige no pasar de los 21 niveles que ya
-- soportan esas funciones (antes la receta se guardaba y fallaba al calcularse).

-- Cuántas recetas se visitan al expandir `p_raiz` (la raíz y cada aparición de cada sub-receta). Cuenta por nivel con arreglos:
-- no recorre caminos, así que cuesta lo mismo aunque haya millones de caminos.
create or replace function tamano_expansion_receta(p_raiz bigint) returns numeric
language plpgsql stable set search_path = public as $$
declare
  ids bigint[] := array[p_raiz];
  cnts numeric[] := array[1];
  nuevos bigint[];
  ncnts numeric[];
  v_total numeric := 0;
  v_nivel int := 0;
begin
  while ids is not null loop
    v_nivel := v_nivel + 1;
    if v_nivel > 21 then raise exception 'La receta tiene demasiados niveles de sub-recetas (máximo 21)'; end if;
    v_total := v_total + (select coalesce(sum(c), 0) from unnest(cnts) c);
    select array_agg(s.id), array_agg(s.cnt) into nuevos, ncnts from (
      select d."IdSubReceta" as id, sum(u.cnt) as cnt
        from "RecetaDetalles" d join unnest(ids, cnts) as u(id, cnt) on d."IdReceta" = u.id
       where d."IdSubReceta" is not null group by d."IdSubReceta") s;
    ids := nuevos; cnts := ncnts;
  end loop;
  return v_total;
end $$;
revoke all on function tamano_expansion_receta(bigint) from public, anon, authenticated;

create or replace function validar_tamano_receta() returns trigger
language plpgsql set search_path = public as $$
declare
  r bigint;
  v_max constant numeric := 500;
begin
  -- Misma serialización que la validación de ciclos (ya tomada por validar_receta_detalle en esta transacción).
  perform pg_advisory_xact_lock(hashtext('recetas-arbol'));
  for r in
    with recursive arriba(id) as (
      select new."IdReceta"
      union
      select d."IdReceta" from "RecetaDetalles" d join arriba a on d."IdSubReceta" = a.id)
    select id from arriba
  loop
    if tamano_expansion_receta(r) > v_max then
      raise exception 'La receta % es demasiado grande: al expandir sus sub-recetas se visitan más de % recetas',
        (select "Nombre" from "Recetas" where "IdReceta" = r), v_max::int;
    end if;
  end loop;
  return null;
end $$;
revoke all on function validar_tamano_receta() from public, anon, authenticated;

create trigger trg_validar_tamano_receta after insert or update of "IdSubReceta" on "RecetaDetalles"
  for each row when (new."IdSubReceta" is not null) execute function validar_tamano_receta();
