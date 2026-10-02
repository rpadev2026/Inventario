-- Maestros (formas de pago, unidades de medida, formatos), FK por código y reglas de factura.
-- Los datos existentes son de prueba (autorizado): se vacían compras, productos y solicitudes
-- porque guardaban unidad/formato/forma de pago como texto libre.
truncate "Compras","Productos","Solicitudes" restart identity cascade;
alter sequence seq_numero_solicitud restart;

do $$
declare t text;
begin
  foreach t in array array['FormasPago','UnidadesMedida','Formatos'] loop
    execute format('create table %I (
      "Id%s" smallint generated always as identity primary key,
      "Codigo" text not null unique check ("Codigo" ~ ''^[A-Z0-9_]{1,30}$''),
      "Nombre" text not null,
      "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
      "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
      "FechaRegistroCreacion" timestamptz not null default now(),
      "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
      "FechaRegistroModificacion" timestamptz not null default now()
    )', t, case t when 'FormasPago' then 'FormaPago' when 'UnidadesMedida' then 'UnidadMedida' else 'Formato' end);
    execute format('create trigger trg_mod before update on %I for each row execute function set_modificacion()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

insert into "FormasPago"("Codigo","Nombre") values
  ('CONTADO','Contado'),('CREDITO_15','Crédito 15 días'),('CREDITO_30','Crédito 30 días'),
  ('CREDITO_60','Crédito 60 días'),('TRANSFERENCIA','Transferencia');
insert into "UnidadesMedida"("Codigo","Nombre") values
  ('KG','Kilo'),('G','Gramos'),('L','Litro'),('ML','Mililitro'),('UN','Unidad');
insert into "Formatos"("Codigo","Nombre") values
  ('CAJA','Caja'),('BOLSA','Bolsa'),('PALLET','Pallet'),('BIN','Bin'),('SACHET','Sachet'),
  ('BOTELLA','Botella'),('LATA','Lata'),('TARRO','Tarro'),('MANGA','Manga'),('PACK','Pack');

alter table "Productos" drop constraint if exists "Productos_UnidadMedida_check";
alter table "Productos" drop constraint if exists "Productos_Formato_check";
alter table "Productos" add constraint "Productos_UnidadMedida_fkey" foreign key ("UnidadMedida") references "UnidadesMedida"("Codigo");
alter table "Productos" add constraint "Productos_Formato_fkey" foreign key ("Formato") references "Formatos"("Codigo");
alter table "Compras" add constraint "Compras_FormaPago_fkey" foreign key ("FormaPago") references "FormasPago"("Codigo");

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
    if not exists (select 1 from "Productos" where "CodigoProducto" = d->>'codigo' and "IdEstado" = 1) then
      raise exception 'Producto % no existe o no vigente', d->>'codigo'; end if;
    insert into "ComprasDetalle"("IdProveedor","Folio","CodigoProducto","Precio","Cantidad","Total")
    values (p_proveedor, p_folio, d->>'codigo', (d->>'precio')::numeric, (d->>'cantidad')::numeric,
            round((d->>'precio')::numeric * (d->>'cantidad')::numeric, 2));
    insert into "BodegaCentral"("CodigoProducto","Cantidad","FechaIngreso","IdProveedor","Folio","IdUsuarioCreacion","IdUsuarioModificacion")
    values (d->>'codigo', (d->>'cantidad')::numeric, p_fecha_recepcion, p_proveedor, p_folio, p_usuario, p_usuario);
    insert into "StockBodega"("IdBodega","CodigoProducto","Cantidad")
    values (v_central, d->>'codigo', (d->>'cantidad')::numeric)
    on conflict ("IdBodega","CodigoProducto")
    do update set "Cantidad" = "StockBodega"."Cantidad" + excluded."Cantidad", "FechaModificacion" = now();
  end loop;
  return v_id;
end $$;

revoke all on function registrar_factura(bigint,bigint,bigint,date,date,text,numeric,numeric,numeric,jsonb) from public, anon, authenticated;
