-- Datos de demostración para mostrar el sistema (restaurante con 30–45 días de historia).
-- Se ejecuta en el SQL Editor de Supabase. Es una sola transacción: si algo falla no queda nada a medias.
-- Usa los RPC reales (registrar_factura, crear_solicitud, guardar_receta, procesar_venta_fudo), así que el stock,
-- los costos, el historial y los reportes salen coherentes. NO borra nada.
--
-- Qué crea (todo con códigos nuevos; se niega a correr si ya existe HAR01):
--   productos : 13 insumos (códigos HAR01 … BEB01) con stock mínimo/crítico; se suman a los que ya existen
--   facturas  : 7 facturas entre hace 45 y 5 días con los 3 proveedores existentes (costos con historial de precios)
--   solicitudes: 2 solicitudes aprobadas y recepcionadas (Cuarto Caliente y Cuarto Frío) por el usuario JORGE
--   recetas   : 5 platos de la carta (Hamburguesa, Papas fritas, Pollo frito, Cerveza, Bebida) vinculados a ids ficticios de Fudo
--   ventas    : 30 días de ventas "de Fudo" (ids DEMO-AAAAMMDD-n) que descuentan stock de las bodegas de cocina
-- Para quitarlo, restaurar un respaldo de la base o borrar a mano; no hay script de limpieza (es la base de la demo).

do $$
declare
  v_admin constant bigint := 1;
  v_jorge constant bigint := 35;
  v_prov_a constant bigint := 8;    -- H Y N INVERSIONES SPA
  v_prov_b constant bigint := 45;   -- HENRY DIAZ
  v_prov_c constant bigint := 55;   -- FREMA
  v_caliente bigint;
  v_frio bigint;
  v_hoy constant date := (now() at time zone 'America/Santiago')::date;
  v_total numeric;
  v_neto numeric;
  v_sol bigint;
  v_rec bigint;
  r record;
  dia date;
  k int;
  v_lineas jsonb;
  v_resto int;

begin
  if exists (select 1 from "Productos" where "Codigo" = 'HAR01') then
    raise exception 'Los datos de demostración ya están cargados (existe el producto HAR01)';
  end if;
  select "IdBodega" into v_caliente from "Bodegas" where "NombreBodega" = 'CUARTO CALIENTE';
  select "IdBodega" into v_frio from "Bodegas" where "NombreBodega" = 'CUARTO FRIO';
  if v_caliente is null or v_frio is null then raise exception 'Faltan las bodegas CUARTO CALIENTE / CUARTO FRIO'; end if;

  -- ===== Productos (unidad base: G, ML o UN; stock mínimo y crítico en unidad base) =====
  insert into "Productos"("Codigo","Nombre","Formato","UnidadBase","StockMinimo","StockCritico","IdUsuarioCreacion","IdUsuarioModificacion")
  select c, n, f, u, mn, cr, v_admin, v_admin from (values
    ('HAR01','HARINA','BOLSA','G', 10000, 5000),
    ('AZU01','AZUCAR','BOLSA','G', 5000, 2000),
    ('ACE01','ACEITE','BOTELLA','ML', 10000, 5000),
    ('ARR01','ARROZ','BOLSA','G', 8000, 3000),
    ('CAR01','CARNE MOLIDA','BOLSA','G', 10000, 5000),
    ('POL01','POLLO','BOLSA','G', 10000, 5000),
    ('QUE01','QUESO MOZZARELLA','BOLSA','G', 3000, 1000),
    ('PAN01','PAN DE HAMBURGUESA','BOLSA','UN', 60, 30),
    ('BEB01','BEBIDA 350 ML','PACK','UN', 60, 30),
    ('CER01','CERVEZA','PACK','UN', 48, 24),
    ('TOM01','SALSA DE TOMATE','BOTELLA','ML', 3000, 1000),
    ('CEB01','CEBOLLA','BOLSA','G', 5000, 2000),
    ('TMT01','TOMATE','CAJA','G', 4000, 1500),
    ('LEC01','LECHUGA','CAJA','UN', 10, 5),
    ('HUE01','HUEVO','PACK','UN', 200, 100)
  ) as t(c, n, f, u, mn, cr);

  -- Mínimos de los productos que ya existían y quedarán con poco stock (para mostrar alertas)
  update "Productos" set "StockMinimo" = 6000, "StockCritico" = 3000 where "Codigo" = 'I01';

  -- ===== Facturas (precio unitario CON IVA; el costo de cada producto sale de la última factura) =====
  create temp table _fac(n int, prov bigint, folio bigint, dias int, pago text, detalle jsonb) on commit drop;
  insert into _fac values
    (1, v_prov_a, 3001, 45, 'CREDITO_30', '[{"p":"HAR01","u":"KG","pr":1190,"c":25},{"p":"AZU01","u":"KG","pr":1300,"c":10},{"p":"ACE01","u":"L","pr":2380,"c":20},{"p":"ARR01","u":"KG","pr":1500,"c":20}]'),
    (2, v_prov_b, 3002, 40, 'CREDITO_15', '[{"p":"CAR01","u":"KG","pr":7140,"c":30},{"p":"POL01","u":"KG","pr":4760,"c":25},{"p":"QUE01","u":"KG","pr":8330,"c":10}]'),
    (3, v_prov_c, 3003, 35, 'TRANSFERENCIA', '[{"p":"PAN01","u":"UN","pr":297,"c":200},{"p":"BEB01","u":"UN","pr":476,"c":120},{"p":"CER01","u":"UN","pr":833,"c":96}]'),
    (4, v_prov_a, 3004, 28, 'CONTADO', '[{"p":"TOM01","u":"L","pr":1900,"c":10},{"p":"CEB01","u":"KG","pr":1070,"c":15},{"p":"TMT01","u":"KG","pr":1900,"c":15},{"p":"LEC01","u":"UN","pr":700,"c":40},{"p":"HUE01","u":"UN","pr":143,"c":180}]'),
    (5, v_prov_b, 3005, 20, 'CREDITO_30', '[{"p":"CAR01","u":"KG","pr":7378,"c":20},{"p":"POL01","u":"KG","pr":4900,"c":15},{"p":"P01","u":"KG","pr":1500,"c":40},{"p":"I01","u":"KG","pr":9520,"c":5}]'),
    (6, v_prov_c, 3006, 12, 'TRANSFERENCIA', '[{"p":"BEB01","u":"UN","pr":499,"c":100},{"p":"CER01","u":"UN","pr":850,"c":72},{"p":"PAN01","u":"UN","pr":300,"c":150}]'),
    (7, v_prov_a, 3007, 5, 'CREDITO_15', '[{"p":"HAR01","u":"KG","pr":1200,"c":25},{"p":"ACE01","u":"L","pr":2400,"c":10},{"p":"QUE01","u":"KG","pr":8500,"c":8}]');

  for r in select * from _fac order by n loop
    select sum((x->>'pr')::numeric * (x->>'c')::numeric) into v_total from jsonb_array_elements(r.detalle) x;
    v_neto := round(v_total / 1.19);
    perform registrar_factura(
      v_admin, r.prov, r.folio, v_hoy - r.dias, v_hoy - r.dias, r.pago, v_neto, v_total - v_neto, v_total,
      (select jsonb_agg(jsonb_build_object(
          'producto', (select "IdProducto" from "Productos" where "Codigo" = x->>'p'),
          'unidad', x->>'u', 'precio', (x->>'pr')::numeric, 'cantidad', (x->>'c')::numeric))
         from jsonb_array_elements(r.detalle) x));
  end loop;

  -- ===== Solicitudes a Cuarto Caliente y Cuarto Frío: las pide JORGE, las aprueba el administrador, JORGE las recibe =====
  create temp table _sol(bodega bigint, items jsonb) on commit drop;
  insert into _sol values
    (v_caliente, '[{"p":"PAN01","c":200},{"p":"CAR01","c":35000},{"p":"QUE01","c":7000},{"p":"LEC01","c":30},{"p":"TMT01","c":8000},{"p":"P01","c":36000},{"p":"ACE01","c":12000},{"p":"S01","c":1000},{"p":"POL01","c":38000},{"p":"HAR01","c":6000}]'),
    (v_frio, '[{"p":"CER01","c":160},{"p":"BEB01","c":210},{"p":"HUE01","c":60}]');
  for r in select * from _sol loop
    v_lineas := (select jsonb_agg(jsonb_build_object('producto', (select "IdProducto" from "Productos" where "Codigo" = x->>'p'), 'cantidad', (x->>'c')::numeric))
                   from jsonb_array_elements(r.items) x);
    v_sol := crear_solicitud(v_jorge, r.bodega, v_lineas);
    perform cambiar_estado_solicitud(v_jorge, v_sol, 1::smallint);
    perform aprobar_solicitud(v_admin, v_sol, v_lineas);
    perform recepcionar_solicitud(v_jorge, v_sol, v_lineas);
  end loop;

  -- ===== Recetas de la carta (una porción cada una) vinculadas a productos ficticios de Fudo =====
  create temp table _rec(codigo text, nombre text, fudo text, bodega bigint, ing jsonb) on commit drop;
  insert into _rec values
    ('R-HAM', 'HAMBURGUESA CLASICA', 'DEMO-HAMB', v_caliente,
      '[{"p":"PAN01","u":"UN","c":1,"n":1,"m":0},{"p":"CAR01","u":"G","c":1,"n":150,"m":0.1},{"p":"QUE01","u":"G","c":1,"n":30,"m":0},{"p":"LEC01","u":"UN","c":1,"n":0.1,"m":0},{"p":"TMT01","u":"G","c":1,"n":30,"m":0.05}]'),
    ('R-PAP', 'PAPAS FRITAS', 'DEMO-PAPAS', v_caliente,
      '[{"p":"P01","u":"G","c":1,"n":200,"m":0.1},{"p":"ACE01","u":"ML","c":1,"n":30,"m":0},{"p":"S01","u":"G","c":1,"n":3,"m":0}]'),
    ('R-POL', 'POLLO FRITO', 'DEMO-POLLO', v_caliente,
      '[{"p":"POL01","u":"G","c":1,"n":250,"m":0.15},{"p":"HAR01","u":"G","c":1,"n":40,"m":0},{"p":"ACE01","u":"ML","c":1,"n":50,"m":0}]'),
    ('R-CER', 'CERVEZA', 'DEMO-CERVEZA', v_frio, '[{"p":"CER01","u":"UN","c":1,"n":1,"m":0}]'),
    ('R-BEB', 'BEBIDA', 'DEMO-BEBIDA', v_frio, '[{"p":"BEB01","u":"UN","c":1,"n":1,"m":0}]');
  for r in select * from _rec loop
    v_rec := guardar_receta(v_admin, null,
      jsonb_build_object('codigo', r.codigo, 'nombre', r.nombre, 'porciones', 1),
      (select jsonb_agg(jsonb_build_object('producto', (select "IdProducto" from "Productos" where "Codigo" = x->>'p'),
          'unidad', x->>'u', 'cantidad', (x->>'c')::numeric, 'porcion', (x->>'n')::numeric, 'merma', (x->>'m')::numeric))
         from jsonb_array_elements(r.ing) x));
    perform vincular_receta_fudo(v_admin, v_rec, r.fudo, r.bodega);
  end loop;

  -- ===== Ventas de los últimos 30 días (hasta ayer) =====
  -- Cada día: tickets 1..7; el ticket k lleva un producto si k <= cantidad del día (más fines de semana con un ticket extra de bebidas).
  -- Las cantidades promedian: hamburguesas 6, papas 5, pollo 4, cervezas 5, bebidas 7 por día (calzan con el stock cargado arriba).
  for dia in select d::date from generate_series(v_hoy - 30, v_hoy - 1, interval '1 day') d loop
    v_resto := extract(doy from dia)::int % 3;   -- 0, 1 o 2: varía el día sin salirse del promedio
    for k in 1..7 loop
      v_lineas := '[]'::jsonb;
      if k <= 5 + v_resto then v_lineas := v_lineas || jsonb_build_object('producto','DEMO-HAMB','nombre','HAMBURGUESA CLASICA','cantidad',1,'monto',6900); end if;
      if k <= 4 + v_resto then v_lineas := v_lineas || jsonb_build_object('producto','DEMO-PAPAS','nombre','PAPAS FRITAS','cantidad',1,'monto',3500); end if;
      if k <= 3 + v_resto then v_lineas := v_lineas || jsonb_build_object('producto','DEMO-POLLO','nombre','POLLO FRITO','cantidad',1,'monto',5900); end if;
      if k <= 4 + v_resto then v_lineas := v_lineas || jsonb_build_object('producto','DEMO-CERVEZA','nombre','CERVEZA','cantidad',1,'monto',2800); end if;
      if k <= 6 + v_resto then v_lineas := v_lineas || jsonb_build_object('producto','DEMO-BEBIDA','nombre','BEBIDA','cantidad',1,'monto',1800); end if;
      if jsonb_array_length(v_lineas) > 0 then
        perform procesar_venta_fudo('DEMO-' || to_char(dia, 'YYYYMMDD') || '-' || k,
          ((dia + time '12:00' + (k * 80) * interval '1 minute') at time zone 'America/Santiago'), v_lineas);
      end if;
    end loop;
  end loop;
end $$;
