-- Corrige "VentasFudoLineas"."Monto": el `price` de una línea de Fudo ya es el total de la línea, y hasta ahora se multiplicaba otra vez por la cantidad.
-- Las líneas guardadas tienen Monto = total × Cantidad: se divide por la cantidad. Ejecutar UNA sola vez (no es idempotente).
update "VentasFudoLineas" set "Monto" = round("Monto" / "Cantidad", 2) where "Monto" is not null and "Cantidad" > 0 and "Cantidad" <> 1;
