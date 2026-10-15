-- Rol de base de datos propio de la aplicación (auditoría S08): `app_servidor`, con los privilegios MÍNIMOS que la app usa,
-- en lugar de service_role (que además llega a los esquemas auth y storage, no se acota y se salta RLS).
-- La app lo usa con un token firmado una sola vez (SUPABASE_APP_TOKEN, ver README); sin token sigue usando service_role.
--
-- Qué puede hacer: leer lo que lee, insertar/actualizar solo lo que crea y edita (bodegas, proveedores, productos, catálogos, roles de
-- usuario, datos básicos de usuarios y contadores de intentos), encolar correos y llamar a las funciones SQL. NO borra nada, NO escribe
-- directo en facturas, solicitudes, stock, movimientos, recetas ni claves (eso va por funciones con reglas de negocio).
-- supabase/tests/rol-app.test.ts es la matriz de referencia: una tabla nueva obliga a decidir su acceso allí.

do $$
begin
  -- Sin BYPASSRLS (exige superusuario): el acceso se da con políticas explícitas por tabla.
  if not exists (select 1 from pg_roles where rolname = 'app_servidor') then
    create role app_servidor nologin noinherit;
  end if;
  -- PostgREST (rol authenticator) debe poder asumirlo según el claim `role` del token.
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    grant app_servidor to authenticator;
  end if;
end $$;

grant usage on schema public to app_servidor;

do $$
declare t text;
begin
  -- Solo lectura (se escriben únicamente por funciones SQL). Incluye BodegaCentral: los triggers de reglas la consultan.
  foreach t in array array['Compras','ComprasDetalle','HistorialClaves','HistorialPreciosProducto','HistorialSolicitudes','MovimientosBodega',
    'Permisos','RecetaDetalles','Recetas','Roles','RolesPermisos','Solicitudes','SolicitudesDetalle','StockBodega','BodegaCentral',
    'Usuarios','Claves'] loop
    execute format('grant select on public.%I to app_servidor', t);
    execute format('create policy app_servidor_select on public.%I for select to app_servidor using (true)', t);
  end loop;

  -- Lectura, alta y edición (nunca borrado).
  foreach t in array array['Bodegas','Proveedores','ProveedoresSucursales','ProveedoresVendedores','Productos','UsuariosRoles',
    'FormasPago','UnidadesMedida','Formatos','Regiones','Provincias','Comunas'] loop
    execute format('grant select, insert, update on public.%I to app_servidor', t);
    execute format('create policy app_servidor_select on public.%I for select to app_servidor using (true)', t);
    execute format('create policy app_servidor_insert on public.%I for insert to app_servidor with check (true)', t);
    execute format('create policy app_servidor_update on public.%I for update to app_servidor using (true) with check (true)', t);
  end loop;
end $$;

-- Solo alta: la app encola correos; la cola se lee y se resuelve por funciones.
grant insert on public."CorreosPendientes" to app_servidor;
create policy app_servidor_insert on public."CorreosPendientes" for insert to app_servidor with check (true);

-- Edición solo de ciertas columnas: no puede cambiar un RUT ni una clave directamente (la clave solo con fijar_clave).
grant update ("Nombres", "Apellidos", "Correo", "IdEstado", "IdUsuarioModificacion") on public."Usuarios" to app_servidor;
create policy app_servidor_update on public."Usuarios" for update to app_servidor using (true) with check (true);
grant update ("IntentosFallidos", "BloqueadoHasta") on public."Claves" to app_servidor;
create policy app_servidor_update on public."Claves" for update to app_servidor using (true) with check (true);

-- Funciones SQL que la aplicación llama (las demás —auxiliares y de triggers— no son invocables por este rol).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as firma from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any (array[
      'actualizar_solicitud','anular_factura','aprobar_solicitud','buscar_subrecetas','calcular_receta','calcular_recetas',
      'cambiar_estado_solicitud','crear_solicitud','crear_usuario','fijar_clave','guardar_receta','guardar_rol','listar_pagina',
      'listar_solicitantes','recepcionar_solicitud','reclamar_correos','registrar_factura','registrar_fallo_login',
      'registrar_intento_login','resolver_correo'])
  loop
    execute format('grant execute on function %s to app_servidor', f.firma);
  end loop;
end $$;
