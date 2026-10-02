-- Datos iniciales. El usuario administrador se crea con `npm run seed:admin` (hash argon2 desde Node).
insert into "Roles"("NombreRol","DetalleRol") values
  ('Administrador','Gestiona usuarios, roles y todo el sistema'),
  ('Compras','Registra facturas, proveedores y productos'),
  ('Bodeguero Central','Aprueba y despacha solicitudes'),
  ('Solicitante','Crea solicitudes y recepciona insumos')
on conflict do nothing;

insert into "Bodegas"("NombreBodega","EsCentral") values ('Bodega Central', true) on conflict do nothing;
