-- Identificador público de la factura para la URL (/compras/<token>): no revela cuántas facturas hay ni se puede adivinar.
-- "IdCompra" sigue siendo la clave interna.
alter table "Compras" add column "Token" uuid not null default gen_random_uuid();
alter table "Compras" add constraint compras_token_unico unique ("Token");
