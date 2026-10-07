-- Historial de precios de compra de los productos + factura con precios que ya incluyen IVA.
create table "HistorialPreciosProducto" (
  "IdHistorial" bigint generated always as identity primary key,
  "IdProducto" bigint not null references "Productos"("IdProducto"),
  "PrecioAnterior" numeric(12,2),
  "PrecioNuevo" numeric(12,2) not null,
  "IdUsuario" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistro" timestamptz not null default now()
);
create index "HistorialPreciosProducto_producto_idx" on "HistorialPreciosProducto"("IdProducto", "IdHistorial" desc);
alter table public."HistorialPreciosProducto" enable row level security;
revoke all on public."HistorialPreciosProducto" from anon, authenticated;

-- Registra el precio inicial al crear el producto y cada cambio posterior de "PrecioCompra".
create or replace function registrar_historial_precio() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into "HistorialPreciosProducto"("IdProducto","PrecioAnterior","PrecioNuevo","IdUsuario")
    values (new."IdProducto", null, new."PrecioCompra", coalesce(new."IdUsuarioCreacion", new."IdUsuarioModificacion"));
  elsif new."PrecioCompra" is distinct from old."PrecioCompra" then
    insert into "HistorialPreciosProducto"("IdProducto","PrecioAnterior","PrecioNuevo","IdUsuario")
    values (new."IdProducto", old."PrecioCompra", new."PrecioCompra", new."IdUsuarioModificacion");
  end if;
  return null;
end $$;
revoke all on function registrar_historial_precio() from public, anon, authenticated;
create trigger trg_historial_precio after insert or update on "Productos"
  for each row execute function registrar_historial_precio();

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
  -- el precio de cada línea ya incluye IVA: el detalle debe sumar el total (neto e IVA se derivan de él)
  if abs(v_suma - p_total) > 1 then raise exception 'La suma del detalle no coincide con el total'; end if;

  insert into "Compras"("IdProveedor","RutProveedor","NombreProveedor","GiroProveedor","Folio",
    "FechaFactura","FechaRecepcion","FormaPago","Neto","Iva","Total","IdUsuarioCreacion","IdUsuarioModificacion")
  values (p_proveedor, v_prov."Rut", v_prov."RazonSocial", v_prov."Giro", p_folio,
    p_fecha_factura, p_fecha_recepcion, p_forma_pago, p_neto, p_iva, p_total, p_usuario, p_usuario)
  returning "IdCompra" into v_id;

  for d in select * from jsonb_array_elements(p_detalle) loop
    v_prod := producto_de_item(d);
    if not exists (select 1 from "Productos" where "IdProducto" = v_prod and "IdEstado" = 1) then
      raise exception 'Producto % no existe o no vigente', etiqueta_producto(v_prod); end if;
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

revoke all on function registrar_factura(bigint,bigint,bigint,date,date,text,numeric,numeric,numeric,jsonb) from public, anon, authenticated;
