-- El código de un producto es obligatorio al crearlo: identifica al producto en facturas, solicitudes y recetas. La aplicación ya lo
-- exige (formulario y esquema); este trigger lo exige también a cualquier otra ruta que inserte. Solo INSERT: los productos que ya
-- existen sin código (se editan desde la aplicación, que ahora lo pide) no pueden bloquear actualizaciones internas como la del costo
-- que hace registrar_factura, así que no se usa una restricción de columna.
create or replace function exigir_codigo_producto() returns trigger
language plpgsql set search_path = public as $$
begin
  if nullif(btrim(coalesce(new."Codigo", '')), '') is null then
    raise exception 'El código del producto es obligatorio';
  end if;
  return new;
end $$;
revoke all on function exigir_codigo_producto() from public, anon, authenticated;
create trigger trg_exigir_codigo_producto before insert on "Productos"
  for each row execute function exigir_codigo_producto();
