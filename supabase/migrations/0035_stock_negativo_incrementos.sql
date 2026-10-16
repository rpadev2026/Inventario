-- Corrige 0034: el stock puede quedar negativo por una venta de Fudo, pero sumarle stock a esa fila (recepción de una solicitud,
-- factura) también se rechazaba mientras el resultado siguiera bajo cero. Ahora solo se rechaza lo que BAJA el stock y lo deja
-- negativo (o una fila nueva negativa); subir una fila negativa es válido. La venta sigue saltándose la regla con el mismo ajuste.
create or replace function validar_stock_no_negativo() returns trigger language plpgsql as $$
begin
  if new."Cantidad" < 0
     and (tg_op = 'INSERT' or new."Cantidad" < old."Cantidad")
     and coalesce(current_setting('inventario.permitir_stock_negativo', true), '') <> 'on' then
    raise exception 'Stock insuficiente' using errcode = '23514';
  end if;
  return new;
end $$;
