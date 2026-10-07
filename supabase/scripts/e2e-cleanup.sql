-- Limpia los datos del recorrido E2E (ver scripts/e2e-setup.ts y CLAUDE.md).
-- Se ejecuta en el SQL Editor de Supabase. Es una sola transacción: si algo falla o hay datos
-- reales mezclados con los de prueba, aborta y NO borra nada.
--
-- Qué considera "datos E2E" (nada más se toca):
--   usuarios  : correo like 'e2e.%@example.test'
--   proveedor : RUT 76086428-5 con razón social 'E2E Distribuidora SpA'
--   productos : "Codigo" like 'E2E-%' o nombre terminado en ' E2E' (los productos pueden no tener código)
--   bodegas   : nombre terminado en ' E2E' (p. ej. 'Cocina E2E', 'Bar E2E'); nunca la Bodega Central
--   roles     : nombre terminado en ' E2E' (p. ej. 'Consulta E2E') que no sea rol base
-- Los usuarios E2E incluyen e2e.admin (rol Administrador); se borran como los demás.
-- Se conservan: el administrador real, Bodega Central, los roles base, los maestros (formas de pago,
-- unidades, formatos; si creó alguno de prueba, bórrelo a mano), el territorio oficial (regiones,
-- ciudades, comunas: solo se desvincula la auditoría de los usuarios E2E) y cualquier dato real.

do $$
declare
  u_ids bigint[];
  p_ids bigint[];
  b_ids bigint[];
  r_ids bigint[];
  s_ids bigint[];
  prod_ids bigint[];
  n int;
begin
  select coalesce(array_agg("IdUsuario"), '{}') into u_ids from "Usuarios" where "Correo" like 'e2e.%@example.test';
  select coalesce(array_agg("IdProveedor"), '{}') into p_ids from "Proveedores" where "Rut" = '76086428-5' and "RazonSocial" = 'E2E Distribuidora SpA';
  select coalesce(array_agg("IdBodega"), '{}') into b_ids from "Bodegas" where "NombreBodega" like '% E2E' and not "EsCentral";

  select coalesce(array_agg("IdProducto"), '{}') into prod_ids from "Productos" where "Codigo" like 'E2E-%' or "Nombre" like '% E2E';
  select coalesce(array_agg("IdRol"), '{}') into r_ids from "Roles" where "NombreRol" like '% E2E' and not "EsBase";

  -- Solicitudes de prueba: hechas por usuarios E2E o dirigidas a la bodega E2E.
  select coalesce(array_agg("IdSolicitud"), '{}') into s_ids from "Solicitudes"
    where "IdUsuarioSolicitante" = any(u_ids) or "IdBodegaDestino" = any(b_ids);

  -- ===== Salvaguardas: abortar si hay datos reales ligados a los de prueba =====
  select count(*) into n from "Solicitudes" where "IdSolicitud" = any(s_ids) and not ("IdUsuarioSolicitante" = any(u_ids));
  if n > 0 then raise exception 'Abortado: % solicitud(es) de usuarios reales apuntan a la bodega E2E', n; end if;

  select count(*) into n from "SolicitudesDetalle" d
    where d."IdProducto" = any(prod_ids) and not (d."IdSolicitud" = any(s_ids));
  if n > 0 then raise exception 'Abortado: % línea(s) de solicitudes reales usan productos E2E', n; end if;

  select count(*) into n from "ComprasDetalle" d
    where d."IdProducto" = any(prod_ids) and not (d."IdProveedor" = any(p_ids));
  if n > 0 then raise exception 'Abortado: % línea(s) de facturas de otros proveedores usan productos E2E', n; end if;

  select count(*) into n from "Compras" c
    where c."IdProveedor" = any(p_ids)
      and exists (select 1 from "ComprasDetalle" d where d."IdProveedor" = c."IdProveedor" and d."Folio" = c."Folio" and not (d."IdProducto" = any(prod_ids)));
  if n > 0 then raise exception 'Abortado: % factura(s) del proveedor E2E incluyen productos reales', n; end if;

  select count(*) into n from "StockBodega" where "IdProducto" = any(prod_ids) and "IdBodega" <> all(b_ids)
    and "IdBodega" not in (select "IdBodega" from "Bodegas" where "EsCentral");
  if n > 0 then raise exception 'Abortado: % registro(s) de stock de productos E2E en bodegas reales', n; end if;

  select count(*) into n from "UsuariosRoles" where "IdRol" = any(r_ids) and not ("IdUsuario" = any(u_ids));
  if n > 0 then raise exception 'Abortado: % usuario(s) reales tienen asignado un rol E2E', n; end if;

  -- ===== Borrado en orden de dependencias =====
  delete from "MovimientosBodega" where "IdSolicitud" = any(s_ids) or "IdProducto" = any(prod_ids) or "IdBodegaDestino" = any(b_ids) or "IdBodegaOrigen" = any(b_ids);
  delete from "HistorialSolicitudes" where "IdSolicitud" = any(s_ids);
  delete from "SolicitudesDetalle" where "IdSolicitud" = any(s_ids) or "IdProducto" = any(prod_ids);
  delete from "Solicitudes" where "IdSolicitud" = any(s_ids);

  delete from "StockBodega" where "IdProducto" = any(prod_ids) or "IdBodega" = any(b_ids);
  delete from "BodegaCentral" where "IdProveedor" = any(p_ids) or "IdProducto" = any(prod_ids);
  delete from "ComprasDetalle" where "IdProveedor" = any(p_ids) or "IdProducto" = any(prod_ids);
  delete from "Compras" where "IdProveedor" = any(p_ids);

  delete from "ProveedoresSucursales" where "IdProveedor" = any(p_ids);
  delete from "ProveedoresVendedores" where "IdProveedor" = any(p_ids);
  delete from "Proveedores" where "IdProveedor" = any(p_ids);
  delete from "HistorialPreciosProducto" where "IdProducto" = any(prod_ids);
  delete from "Productos" where "IdProducto" = any(prod_ids);
  delete from "Bodegas" where "IdBodega" = any(b_ids);

  delete from "HistorialClaves" where "IdUsuario" = any(u_ids);
  delete from "Claves" where "IdUsuario" = any(u_ids);
  delete from "UsuariosRoles" where "IdUsuario" = any(u_ids) or "IdRol" = any(r_ids);
  delete from "RolesPermisos" where "IdRol" = any(r_ids);
  delete from "Roles" where "IdRol" = any(r_ids);
  -- Territorio (regiones, ciudades, comunas): son datos oficiales que se conservan; solo se quita la
  -- referencia de auditoría a los usuarios E2E (p. ej. e2e.admin que desactivó/reactivó una comuna).
  update "Regiones" set "IdUsuarioCreacion" = null where "IdUsuarioCreacion" = any(u_ids);
  update "Regiones" set "IdUsuarioModificacion" = null where "IdUsuarioModificacion" = any(u_ids);
  update "Provincias" set "IdUsuarioCreacion" = null where "IdUsuarioCreacion" = any(u_ids);
  update "Provincias" set "IdUsuarioModificacion" = null where "IdUsuarioModificacion" = any(u_ids);
  update "Comunas" set "IdUsuarioCreacion" = null where "IdUsuarioCreacion" = any(u_ids);
  update "Comunas" set "IdUsuarioModificacion" = null where "IdUsuarioModificacion" = any(u_ids);
  -- Si algún dato real referencia a estos usuarios (IdUsuarioCreacion, etc.), la FK aborta todo.
  delete from "Usuarios" where "IdUsuario" = any(u_ids);

  -- Si no quedan solicitudes, el contador de números vuelve a empezar en 1.
  if not exists (select 1 from "Solicitudes") then
    perform setval('seq_numero_solicitud', 1, false);
  end if;

  raise notice 'Limpieza E2E completa: % usuarios, % proveedor(es), % bodega(s), % solicitud(es), % rol(es) eliminados',
    cardinality(u_ids), cardinality(p_ids), cardinality(b_ids), cardinality(s_ids), cardinality(r_ids);
end $$;
