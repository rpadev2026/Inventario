-- Productos con IdProducto (clave numérica), código opcional, precio de compra y costo unitario por unidad base.
-- Los datos existentes son de prueba (autorizado): se vacían compras, productos, solicitudes, stock y movimientos,
-- porque las tablas hijas pasan de "CodigoProducto" (texto) a "IdProducto".
truncate "Compras","Productos","Solicitudes" restart identity cascade;
alter sequence seq_numero_solicitud restart;

-- ===== UnidadesMedida: unidad base y factor de conversión =====
alter table "UnidadesMedida" add column "UnidadBase" text;
alter table "UnidadesMedida" add column "Factor" numeric(14,6) not null default 1 check ("Factor" > 0);
update "UnidadesMedida" set
  "UnidadBase" = case "Codigo" when 'KG' then 'G' when 'L' then 'ML' else "Codigo" end,
  "Factor" = case "Codigo" when 'KG' then 1000 when 'L' then 1000 else 1 end;
alter table "UnidadesMedida" alter column "UnidadBase" set not null;
alter table "UnidadesMedida" alter column "Factor" drop default;
alter table "UnidadesMedida" add constraint "UnidadesMedida_UnidadBase_fkey"
  foreign key ("UnidadBase") references "UnidadesMedida"("Codigo");
alter table "UnidadesMedida" add constraint "UnidadesMedida_base_factor_check"
  check ("UnidadBase" <> "Codigo" or "Factor" = 1);

create or replace function validar_unidad_medida() returns trigger
language plpgsql set search_path = public as $$
begin
  -- la unidad base de una unidad debe ser, a su vez, una unidad base (factor 1, no encadenada)
  if new."UnidadBase" <> new."Codigo" and not exists (
    select 1 from "UnidadesMedida" b where b."Codigo" = new."UnidadBase" and b."UnidadBase" = b."Codigo" and b."Factor" = 1) then
    raise exception 'La unidad base debe ser una unidad base (factor 1)';
  end if;
  if tg_op = 'UPDATE' then
    if (new."UnidadBase" <> old."UnidadBase" or new."Factor" <> old."Factor")
       and exists (select 1 from "Productos" p where p."UnidadMedida" = old."Codigo") then
      raise exception 'No se puede cambiar la unidad base ni el factor: hay productos que usan esta unidad';
    end if;
    if old."UnidadBase" = old."Codigo" and new."UnidadBase" <> new."Codigo"
       and exists (select 1 from "UnidadesMedida" u where u."UnidadBase" = old."Codigo" and u."Codigo" <> old."Codigo") then
      raise exception 'No se puede cambiar: otras unidades usan esta como unidad base';
    end if;
  end if;
  return new;
end $$;
revoke all on function validar_unidad_medida() from public, anon, authenticated;
create trigger trg_validar_unidad before insert or update on "UnidadesMedida"
  for each row execute function validar_unidad_medida();

-- ===== Productos (recreada) =====
drop table "Productos" cascade;
create table "Productos" (
  "IdProducto" bigint generated always as identity primary key,
  "Codigo" text unique,
  "Nombre" text not null unique,
  "UnidadMedida" text not null references "UnidadesMedida"("Codigo"),
  "Formato" text not null references "Formatos"("Codigo"),
  "PrecioCompra" numeric(12,2) not null check ("PrecioCompra" >= 0),
  "UnidadBase" text not null references "UnidadesMedida"("Codigo"),
  "CostoUnitarioBase" numeric(14,6) not null,
  "StockMinimo" numeric(14,3) not null default 0 check ("StockMinimo" >= 0),
  "StockCritico" numeric(14,3) not null default 0 check ("StockCritico" >= 0),
  "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroModificacion" timestamptz not null default now(),
  check ("StockCritico" <= "StockMinimo")
);
create trigger trg_mod before update on "Productos" for each row execute function set_modificacion();
alter table public."Productos" enable row level security;
revoke all on public."Productos" from anon, authenticated;

-- UnidadBase y CostoUnitarioBase no se envían: se calculan siempre desde la unidad de medida.
create or replace function fijar_costo_base() returns trigger
language plpgsql set search_path = public as $$
declare v_base text; v_factor numeric;
begin
  select "UnidadBase","Factor" into v_base, v_factor from "UnidadesMedida" where "Codigo" = new."UnidadMedida";
  if not found then
    raise exception 'insert or update on table "Productos" violates foreign key constraint "Productos_UnidadMedida_fkey"'
      using errcode = '23503';
  end if;
  new."UnidadBase" := v_base;
  new."CostoUnitarioBase" := round(new."PrecioCompra" / v_factor, 6);
  return new;
end $$;
revoke all on function fijar_costo_base() from public, anon, authenticated;
create trigger trg_costo_base before insert or update on "Productos"
  for each row execute function fijar_costo_base();
-- el trigger de unidades quedó definido antes de existir Productos: la función lo resuelve en tiempo de ejecución.

-- ===== Tablas hijas: "CodigoProducto" -> "IdProducto" =====
alter table "BodegaCentral" drop column "CodigoProducto";
alter table "BodegaCentral" add column "IdProducto" bigint not null references "Productos"("IdProducto");
alter table "ComprasDetalle" drop column "CodigoProducto";
alter table "ComprasDetalle" add column "IdProducto" bigint not null references "Productos"("IdProducto");
alter table "MovimientosBodega" drop column "CodigoProducto";
alter table "MovimientosBodega" add column "IdProducto" bigint not null references "Productos"("IdProducto");
alter table "StockBodega" drop column "CodigoProducto";
alter table "StockBodega" add column "IdProducto" bigint not null references "Productos"("IdProducto");
alter table "StockBodega" add primary key ("IdBodega","IdProducto");
alter table "SolicitudesDetalle" drop column "CodigoProducto";
alter table "SolicitudesDetalle" add column "IdProducto" bigint not null references "Productos"("IdProducto");
alter table "SolicitudesDetalle" add primary key ("IdSolicitud","IdProducto");

-- ===== RPC: los ítems usan "producto" (IdProducto) en vez de "codigo" =====
create or replace function producto_de_item(d jsonb) returns bigint
language plpgsql immutable set search_path = public as $$
begin
  if (d->>'producto') is null or (d->>'producto') !~ '^[0-9]{1,15}$' then
    raise exception 'Producto no válido';
  end if;
  return (d->>'producto')::bigint;
end $$;
revoke all on function producto_de_item(jsonb) from public, anon, authenticated;

create or replace function registrar_factura(
  p_usuario bigint, p_proveedor bigint, p_folio bigint,
  p_fecha_factura date, p_fecha_recepcion date, p_forma_pago text,
  p_neto numeric, p_iva numeric, p_total numeric, p_detalle jsonb
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_prov "Proveedores"%rowtype;
  v_central bigint;
  v_id bigint;
  d jsonb;
  v_prod bigint;
  v_suma numeric := 0;
begin
  if p_fecha_recepcion < p_fecha_factura then
    raise exception 'La fecha de recepción no puede ser anterior a la fecha de factura'; end if;
  if not exists (select 1 from "FormasPago" where "Codigo" = p_forma_pago and "IdEstado" = 1) then
    raise exception 'Forma de pago no existe o no vigente'; end if;
  select * into v_prov from "Proveedores" where "IdProveedor" = p_proveedor and "IdEstado" = 1;
  if not found then raise exception 'Proveedor no existe o no vigente'; end if;
  if jsonb_typeof(p_detalle) <> 'array' or jsonb_array_length(p_detalle) = 0 then
    raise exception 'La factura debe tener detalle'; end if;
  select "IdBodega" into v_central from "Bodegas" where "EsCentral" and "IdEstado" = 1;
  if v_central is null then raise exception 'No existe Bodega Central'; end if;

  for d in select * from jsonb_array_elements(p_detalle) loop
    v_suma := v_suma + round((d->>'precio')::numeric * (d->>'cantidad')::numeric, 2);
  end loop;
  if abs(v_suma - p_neto) > 1 then raise exception 'La suma del detalle no coincide con el neto'; end if;

  insert into "Compras"("IdProveedor","RutProveedor","NombreProveedor","GiroProveedor","Folio",
    "FechaFactura","FechaRecepcion","FormaPago","Neto","Iva","Total","IdUsuarioCreacion","IdUsuarioModificacion")
  values (p_proveedor, v_prov."Rut", v_prov."RazonSocial", v_prov."Giro", p_folio,
    p_fecha_factura, p_fecha_recepcion, p_forma_pago, p_neto, p_iva, p_total, p_usuario, p_usuario)
  returning "IdCompra" into v_id;

  for d in select * from jsonb_array_elements(p_detalle) loop
    v_prod := producto_de_item(d);
    if not exists (select 1 from "Productos" where "IdProducto" = v_prod and "IdEstado" = 1) then
      raise exception 'Producto % no existe o no vigente', v_prod; end if;
    insert into "ComprasDetalle"("IdProveedor","Folio","IdProducto","Precio","Cantidad","Total")
    values (p_proveedor, p_folio, v_prod, (d->>'precio')::numeric, (d->>'cantidad')::numeric,
            round((d->>'precio')::numeric * (d->>'cantidad')::numeric, 2));
    insert into "BodegaCentral"("IdProducto","Cantidad","FechaIngreso","IdProveedor","Folio","IdUsuarioCreacion","IdUsuarioModificacion")
    values (v_prod, (d->>'cantidad')::numeric, p_fecha_recepcion, p_proveedor, p_folio, p_usuario, p_usuario);
    insert into "StockBodega"("IdBodega","IdProducto","Cantidad")
    values (v_central, v_prod, (d->>'cantidad')::numeric)
    on conflict ("IdBodega","IdProducto")
    do update set "Cantidad" = "StockBodega"."Cantidad" + excluded."Cantidad", "FechaModificacion" = now();
  end loop;
  return v_id;
end $$;

create or replace function crear_solicitud(p_usuario bigint, p_bodega bigint, p_items jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; d jsonb; v_prod bigint;
begin
  if not exists (select 1 from "Bodegas" where "IdBodega" = p_bodega and "IdEstado" = 1 and not "EsCentral") then
    raise exception 'Bodega destino inválida'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La solicitud debe tener productos'; end if;
  insert into "Solicitudes"("IdUsuarioSolicitante","IdBodegaDestino") values (p_usuario, p_bodega) returning "IdSolicitud" into v_id;
  for d in select * from jsonb_array_elements(p_items) loop
    if (d->>'cantidad')::numeric <= 0 then raise exception 'Cantidad inválida'; end if;
    v_prod := producto_de_item(d);
    if not exists (select 1 from "Productos" where "IdProducto" = v_prod and "IdEstado" = 1) then
      raise exception 'Producto % no existe o no vigente', v_prod; end if;
    insert into "SolicitudesDetalle"("IdSolicitud","IdProducto","Cantidad") values (v_id, v_prod, (d->>'cantidad')::numeric);
  end loop;
  insert into "HistorialSolicitudes"("IdSolicitud","EstadoSolicitud","IdUsuarioCreacion","IdUsuarioModificacion") values (v_id, 0, p_usuario, p_usuario);
  return v_id;
end $$;

create or replace function actualizar_solicitud(p_usuario bigint, p_solicitud bigint, p_bodega bigint, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_sol "Solicitudes"%rowtype; d jsonb; v_prod bigint;
begin
  select * into v_sol from "Solicitudes" where "IdSolicitud" = p_solicitud for update;
  if not found then raise exception 'Solicitud no existe'; end if;
  if v_sol."IdUsuarioSolicitante" <> p_usuario then raise exception 'Solo el solicitante puede editarla'; end if;
  if v_sol."EstadoSolicitud" <> 0 then raise exception 'Solo se puede editar una solicitud en estado Creada'; end if;
  if not exists (select 1 from "Bodegas" where "IdBodega" = p_bodega and "IdEstado" = 1 and not "EsCentral") then
    raise exception 'Bodega destino inválida'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La solicitud debe tener productos'; end if;
  update "Solicitudes" set "IdBodegaDestino" = p_bodega where "IdSolicitud" = p_solicitud;
  delete from "SolicitudesDetalle" where "IdSolicitud" = p_solicitud;
  for d in select * from jsonb_array_elements(p_items) loop
    if (d->>'cantidad')::numeric <= 0 then raise exception 'Cantidad inválida'; end if;
    v_prod := producto_de_item(d);
    if not exists (select 1 from "Productos" where "IdProducto" = v_prod and "IdEstado" = 1) then
      raise exception 'Producto % no existe o no vigente', v_prod; end if;
    insert into "SolicitudesDetalle"("IdSolicitud","IdProducto","Cantidad") values (p_solicitud, v_prod, (d->>'cantidad')::numeric);
  end loop;
end $$;

create or replace function aprobar_solicitud(p_usuario bigint, p_solicitud bigint, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_central bigint; d jsonb; v_prod bigint; v_sol numeric; v_stock numeric; v_total numeric := 0;
begin
  perform 1 from "Solicitudes" where "IdSolicitud" = p_solicitud and "EstadoSolicitud" = 1 for update;
  if not found then raise exception 'La solicitud no está en estado Enviada'; end if;
  select "IdBodega" into v_central from "Bodegas" where "EsCentral";
  for d in select * from jsonb_array_elements(p_items) loop
    v_prod := producto_de_item(d);
    select "Cantidad" into v_sol from "SolicitudesDetalle" where "IdSolicitud" = p_solicitud and "IdProducto" = v_prod;
    if v_sol is null then raise exception 'Producto % no pertenece a la solicitud', v_prod; end if;
    if (d->>'cantidad')::numeric < 0 or (d->>'cantidad')::numeric > v_sol then
      raise exception 'Cantidad aprobada inválida para %', v_prod; end if;
    select coalesce(sum("Cantidad"),0) into v_stock from "StockBodega" where "IdBodega" = v_central and "IdProducto" = v_prod;
    if (d->>'cantidad')::numeric > v_stock then raise exception 'Stock insuficiente en Bodega Central para %', v_prod; end if;
    update "SolicitudesDetalle" set "CantidadAprobada" = (d->>'cantidad')::numeric
      where "IdSolicitud" = p_solicitud and "IdProducto" = v_prod;
    v_total := v_total + (d->>'cantidad')::numeric;
  end loop;
  if v_total <= 0 then raise exception 'Debe aprobar al menos un producto o rechazar la solicitud'; end if;
  -- ítems no informados quedan con aprobada = 0 si aún no tenían valor
  update "SolicitudesDetalle" set "CantidadAprobada" = 0 where "IdSolicitud" = p_solicitud and "CantidadAprobada" is null;
  perform cambiar_estado_solicitud(p_usuario, p_solicitud, 2::smallint);
end $$;

create or replace function recepcionar_solicitud(
  p_usuario bigint, p_solicitud bigint, p_items jsonb
) returns smallint language plpgsql security definer set search_path = public as $$
declare
  v_sol "Solicitudes"%rowtype;
  v_central bigint;
  d jsonb; v_prod bigint; v_cant numeric; v_pend numeric; v_nuevo smallint;
begin
  select * into v_sol from "Solicitudes" where "IdSolicitud" = p_solicitud for update;
  if not found then raise exception 'Solicitud no existe'; end if;
  if v_sol."EstadoSolicitud" not in (2,4) then raise exception 'La solicitud no está en estado recepcionable'; end if;
  if v_sol."IdUsuarioSolicitante" <> p_usuario then raise exception 'Solo el solicitante puede recepcionar'; end if;
  select "IdBodega" into v_central from "Bodegas" where "EsCentral";

  for d in select * from jsonb_array_elements(p_items) loop
    v_prod := producto_de_item(d);
    v_cant := (d->>'cantidad')::numeric;
    if v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    select "CantidadAprobada" - "CantidadRecibida" into v_pend from "SolicitudesDetalle"
      where "IdSolicitud" = p_solicitud and "IdProducto" = v_prod for update;
    if v_pend is null then raise exception 'Producto % no pertenece a la solicitud', v_prod; end if;
    if v_cant > v_pend then raise exception 'Cantidad excede lo pendiente para %', v_prod; end if;

    update "StockBodega" set "Cantidad" = "Cantidad" - v_cant, "FechaModificacion" = now()
      where "IdBodega" = v_central and "IdProducto" = v_prod;
    if not found then raise exception 'Sin stock en Bodega Central para %', v_prod; end if;
    -- el CHECK (Cantidad >= 0) aborta la transacción si el stock queda negativo

    insert into "StockBodega"("IdBodega","IdProducto","Cantidad")
    values (v_sol."IdBodegaDestino", v_prod, v_cant)
    on conflict ("IdBodega","IdProducto")
    do update set "Cantidad" = "StockBodega"."Cantidad" + excluded."Cantidad", "FechaModificacion" = now();

    update "SolicitudesDetalle" set "CantidadRecibida" = "CantidadRecibida" + v_cant
      where "IdSolicitud" = p_solicitud and "IdProducto" = v_prod;
    insert into "MovimientosBodega"("IdSolicitud","IdBodegaOrigen","IdBodegaDestino","IdProducto","Cantidad","IdUsuarioCreacion","IdUsuarioModificacion")
    values (p_solicitud, v_central, v_sol."IdBodegaDestino", v_prod, v_cant, p_usuario, p_usuario);
  end loop;

  if exists (select 1 from "SolicitudesDetalle" where "IdSolicitud" = p_solicitud and "CantidadRecibida" < "CantidadAprobada")
    then v_nuevo := 4; else v_nuevo := 3; end if;
  update "Solicitudes" set "EstadoSolicitud" = v_nuevo where "IdSolicitud" = p_solicitud;
  insert into "HistorialSolicitudes"("IdSolicitud","EstadoSolicitud","IdUsuarioCreacion","IdUsuarioModificacion")
  values (p_solicitud, v_nuevo, p_usuario, p_usuario);
  return v_nuevo;
end $$;

create or replace function anular_factura(p_usuario bigint, p_compra bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_c "Compras"%rowtype; v_central bigint; r record;
begin
  if coalesce(length(trim(p_motivo)),0) < 5 then raise exception 'Indique el motivo de anulación'; end if;
  select * into v_c from "Compras" where "IdCompra" = p_compra for update;
  if not found then raise exception 'Factura no existe'; end if;
  if v_c."IdEstado" = 0 then raise exception 'La factura ya está anulada'; end if;
  select "IdBodega" into v_central from "Bodegas" where "EsCentral";

  for r in select b."IdProducto", p."Nombre", sum(b."Cantidad") as cant
           from "BodegaCentral" b join "Productos" p using ("IdProducto")
           where b."IdProveedor" = v_c."IdProveedor" and b."Folio" = v_c."Folio" and not b."Anulado"
           group by b."IdProducto", p."Nombre" loop
    update "StockBodega" set "Cantidad" = "Cantidad" - r.cant, "FechaModificacion" = now()
      where "IdBodega" = v_central and "IdProducto" = r."IdProducto" and "Cantidad" >= r.cant;
    if not found then
      raise exception 'No se puede anular: el stock de % ya fue despachado a otras bodegas', r."Nombre";
    end if;
  end loop;
  update "BodegaCentral" set "Anulado" = true, "IdUsuarioModificacion" = p_usuario, "FechaModificacion" = now()
    where "IdProveedor" = v_c."IdProveedor" and "Folio" = v_c."Folio";
  update "Compras" set "IdEstado" = 0, "MotivoAnulacion" = trim(p_motivo), "IdUsuarioModificacion" = p_usuario
    where "IdCompra" = p_compra;
end $$;

revoke all on function registrar_factura(bigint,bigint,bigint,date,date,text,numeric,numeric,numeric,jsonb) from public, anon, authenticated;
revoke all on function crear_solicitud(bigint,bigint,jsonb) from public, anon, authenticated;
revoke all on function actualizar_solicitud(bigint,bigint,bigint,jsonb) from public, anon, authenticated;
revoke all on function aprobar_solicitud(bigint,bigint,jsonb) from public, anon, authenticated;
revoke all on function recepcionar_solicitud(bigint,bigint,jsonb) from public, anon, authenticated;
revoke all on function anular_factura(bigint,bigint,text) from public, anon, authenticated;
