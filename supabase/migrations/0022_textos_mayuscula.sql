-- Los textos de la aplicación se guardan en MAYÚSCULA (la aplicación ya lo hace al crear y editar).
-- Esta migración convierte los datos existentes. No toca correos, RUT, códigos ni nombres de roles.

do $$
begin
  -- "NombreBodega" es único: si dos nombres solo difieren en las mayúsculas, hay que resolverlo a mano.
  if exists (select 1 from "Bodegas" group by upper("NombreBodega") having count(*) > 1) then
    raise exception 'Hay bodegas con el mismo nombre salvo mayúsculas; renombre una antes de aplicar esta migración';
  end if;
end $$;

update "Bodegas" set "NombreBodega" = upper("NombreBodega") where "NombreBodega" <> upper("NombreBodega");

update "Usuarios" set "Nombres" = upper("Nombres"), "Apellidos" = upper("Apellidos")
 where "Nombres" <> upper("Nombres") or "Apellidos" <> upper("Apellidos");

update "Proveedores" set "RazonSocial" = upper("RazonSocial"), "Direccion" = upper("Direccion"), "Giro" = upper("Giro"),
  "NombreRepresentanteLegal" = upper("NombreRepresentanteLegal")
 where "RazonSocial" <> upper("RazonSocial") or "Direccion" <> upper("Direccion") or "Giro" <> upper("Giro")
    or "NombreRepresentanteLegal" <> upper("NombreRepresentanteLegal");

update "ProveedoresSucursales" set "Direccion" = upper("Direccion"), "EncargadoSucursal" = upper("EncargadoSucursal")
 where "Direccion" <> upper("Direccion") or "EncargadoSucursal" <> upper("EncargadoSucursal");

update "ProveedoresVendedores" set "Nombres" = upper("Nombres"), "Apellidos" = upper("Apellidos")
 where "Nombres" <> upper("Nombres") or "Apellidos" <> upper("Apellidos");

update "Compras" set "MotivoAnulacion" = upper("MotivoAnulacion") where "MotivoAnulacion" <> upper("MotivoAnulacion");

do $$
declare t text;
begin
  foreach t in array array['FormasPago','UnidadesMedida','Formatos','Regiones','Provincias','Comunas'] loop
    execute format('update %I set "Nombre" = upper("Nombre") where "Nombre" <> upper("Nombre")', t);
  end loop;
end $$;
