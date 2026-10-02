-- Anulación de facturas: revierte el stock de Bodega Central. Las facturas no se editan ni se borran
-- (trazabilidad contable): se anulan y, si corresponde, se vuelven a ingresar.
alter table "Compras" add column "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1));
alter table "Compras" add column "MotivoAnulacion" text;
alter table "BodegaCentral" add column "Anulado" boolean not null default false;

create or replace function anular_factura(p_usuario bigint, p_compra bigint, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_c "Compras"%rowtype; v_central bigint; r record;
begin
  if coalesce(length(trim(p_motivo)),0) < 5 then raise exception 'Indique el motivo de anulación'; end if;
  select * into v_c from "Compras" where "IdCompra" = p_compra for update;
  if not found then raise exception 'Factura no existe'; end if;
  if v_c."IdEstado" = 0 then raise exception 'La factura ya está anulada'; end if;
  select "IdBodega" into v_central from "Bodegas" where "EsCentral";

  for r in select "CodigoProducto", sum("Cantidad") as cant from "BodegaCentral"
           where "IdProveedor" = v_c."IdProveedor" and "Folio" = v_c."Folio" and not "Anulado" group by 1 loop
    update "StockBodega" set "Cantidad" = "Cantidad" - r.cant, "FechaModificacion" = now()
      where "IdBodega" = v_central and "CodigoProducto" = r."CodigoProducto" and "Cantidad" >= r.cant;
    if not found then
      raise exception 'No se puede anular: el stock de % ya fue despachado a otras bodegas', r."CodigoProducto";
    end if;
  end loop;
  update "BodegaCentral" set "Anulado" = true, "IdUsuarioModificacion" = p_usuario, "FechaModificacion" = now()
    where "IdProveedor" = v_c."IdProveedor" and "Folio" = v_c."Folio";
  update "Compras" set "IdEstado" = 0, "MotivoAnulacion" = trim(p_motivo), "IdUsuarioModificacion" = p_usuario
    where "IdCompra" = p_compra;
end $$;

revoke all on function anular_factura(bigint,bigint,text) from public, anon, authenticated;
