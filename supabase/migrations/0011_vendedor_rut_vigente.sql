-- Un mismo RUT de vendedor puede estar en varios proveedores, pero vigente en uno solo.
-- (Dentro de un mismo proveedor el RUT ya era único: unique ("IdProveedor","Rut").)
-- Para registrarlo en otro proveedor, primero debe quedar no vigente en el anterior.
create unique index "un_vendedor_rut_vigente" on "ProveedoresVendedores"("Rut") where "IdEstado" = 1;
