-- Esquema base del sistema de inventario. Ejecutar en el SQL Editor de Supabase.
-- Todo el acceso es desde el servidor con service_role; RLS activo sin políticas públicas.

create or replace function set_modificacion() returns trigger language plpgsql as $$
begin
  new."FechaRegistroModificacion" := now();
  return new;
end $$;

-- ===== Usuarios / Seguridad =====
create table "Usuarios" (
  "IdUsuario" bigint generated always as identity primary key,
  "Rut" text not null unique,
  "Nombres" text not null,
  "Apellidos" text not null,
  "Correo" text not null unique,
  "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroModificacion" timestamptz not null default now()
);

create table "Claves" (
  "IdUsuario" bigint primary key references "Usuarios"("IdUsuario"),
  "Password" text not null, -- hash argon2id, nunca texto plano
  "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
  "DebeCambiar" boolean not null default true,
  "IntentosFallidos" int not null default 0,
  "BloqueadoHasta" timestamptz,
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroModificacion" timestamptz not null default now()
);

create table "HistorialClaves" (
  "IdHistorial" bigint generated always as identity primary key,
  "IdUsuario" bigint not null references "Usuarios"("IdUsuario"),
  "Password" text not null, -- hash
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroModificacion" timestamptz not null default now()
);

create table "Roles" (
  "IdRol" bigint generated always as identity primary key,
  "NombreRol" text not null unique,
  "DetalleRol" text,
  "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroModificacion" timestamptz not null default now()
);

create table "UsuariosRoles" (
  "IdUsuario" bigint not null references "Usuarios"("IdUsuario"),
  "IdRol" bigint not null references "Roles"("IdRol"),
  "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroModificacion" timestamptz not null default now(),
  primary key ("IdUsuario","IdRol")
);

-- ===== Proveedores =====
create table "Proveedores" (
  "IdProveedor" bigint generated always as identity primary key,
  "Rut" text not null unique,
  "RazonSocial" text not null,
  "Direccion" text, "Region" text, "Comuna" text, "Ciudad" text,
  "Giro" text,
  "RutRepresentanteLegal" text, "NombreRepresentanteLegal" text,
  "Telefono" text, "Correo" text,
  "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
  "IdUsuario" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistro" timestamptz not null default now(),
  "FechaRegistroModificacion" timestamptz not null default now()
);

create table "ProveedoresSucursales" (
  "IdSucursal" bigint generated always as identity primary key,
  "IdProveedor" bigint not null references "Proveedores"("IdProveedor"),
  "Region" text, "Comuna" text, "Ciudad" text, "Direccion" text,
  "Telefono" text, "Correo" text, "EncargadoSucursal" text,
  "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
  "IdUsuario" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistro" timestamptz not null default now(),
  "FechaRegistroModificacion" timestamptz not null default now()
);

create table "ProveedoresVendedores" (
  "IdVendedor" bigint generated always as identity primary key,
  "IdProveedor" bigint not null references "Proveedores"("IdProveedor"),
  "Rut" text not null, "Nombres" text not null, "Apellidos" text not null,
  "Telefono" text, "Correo" text,
  "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
  "IdUsuario" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistro" timestamptz not null default now(),
  "FechaRegistroModificacion" timestamptz not null default now(),
  unique ("IdProveedor","Rut")
);

-- ===== Productos =====
create table "Productos" (
  "CodigoProducto" text primary key,
  "NombreProducto" text not null,
  "UnidadMedida" text not null check ("UnidadMedida" in ('Kilo','Gramos','Litro','Mililitro','Unidad')),
  "Formato" text not null check ("Formato" in ('Caja','Bolsa','Pallet','Bin','Sachet','Botella','Lata','Tarro','Manga','Pack')),
  "StockMinimo" numeric(14,3) not null default 0 check ("StockMinimo" >= 0),
  "StockCritico" numeric(14,3) not null default 0 check ("StockCritico" >= 0),
  "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroModificacion" timestamptz not null default now(),
  check ("StockCritico" <= "StockMinimo")
);

-- ===== Bodegas =====
create table "Bodegas" (
  "IdBodega" bigint generated always as identity primary key,
  "NombreBodega" text not null unique,
  "EsCentral" boolean not null default false,
  "IdEstado" smallint not null default 1 check ("IdEstado" in (0,1)),
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaModificacion" timestamptz not null default now()
);
create unique index un_bodega_central on "Bodegas"("EsCentral") where "EsCentral";

-- Stock por bodega (la Bodega Central también vive aquí)
create table "StockBodega" (
  "IdBodega" bigint not null references "Bodegas"("IdBodega"),
  "CodigoProducto" text not null references "Productos"("CodigoProducto"),
  "Cantidad" numeric(14,3) not null default 0 check ("Cantidad" >= 0),
  "FechaModificacion" timestamptz not null default now(),
  primary key ("IdBodega","CodigoProducto")
);

-- ===== Compras =====
create table "Compras" (
  "IdCompra" bigint generated always as identity primary key,
  "IdProveedor" bigint not null references "Proveedores"("IdProveedor"),
  "RutProveedor" text not null,
  "NombreProveedor" text not null,
  "GiroProveedor" text,
  "Folio" bigint not null check ("Folio" > 0),
  "FechaFactura" date not null,
  "FechaRecepcion" date not null,
  "FormaPago" text not null,
  "Neto" numeric(14,2) not null check ("Neto" >= 0),
  "Iva" numeric(14,2) not null check ("Iva" >= 0),
  "Total" numeric(14,2) not null check ("Total" >= 0),
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaRegistroModificacion" timestamptz not null default now(),
  unique ("IdProveedor","Folio"),
  check (abs("Neto" + "Iva" - "Total") <= 1)
);

create table "ComprasDetalle" (
  "IdDetalle" bigint generated always as identity primary key,
  "IdProveedor" bigint not null,
  "Folio" bigint not null,
  "CodigoProducto" text not null references "Productos"("CodigoProducto"),
  "Precio" numeric(14,2) not null check ("Precio" >= 0),
  "Cantidad" numeric(14,3) not null check ("Cantidad" > 0),
  "Total" numeric(14,2) not null check ("Total" >= 0),
  foreign key ("IdProveedor","Folio") references "Compras"("IdProveedor","Folio")
);

-- ===== Bodega Central (entradas por factura) =====
create table "BodegaCentral" (
  "IdIngreso" bigint generated always as identity primary key,
  "CodigoProducto" text not null references "Productos"("CodigoProducto"),
  "Cantidad" numeric(14,3) not null check ("Cantidad" > 0),
  "FechaIngreso" date not null,
  "IdProveedor" bigint not null,
  "Folio" bigint not null,
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaModificacion" timestamptz not null default now(),
  foreign key ("IdProveedor","Folio") references "Compras"("IdProveedor","Folio")
);

-- ===== Solicitudes =====
create sequence seq_numero_solicitud;

create table "Solicitudes" (
  "IdSolicitud" bigint generated always as identity primary key,
  "NumeroSolicitud" bigint not null unique default nextval('seq_numero_solicitud'),
  "FechaSolicitud" timestamptz not null default now(),
  "EstadoSolicitud" smallint not null default 0 check ("EstadoSolicitud" between 0 and 5),
  "IdUsuarioSolicitante" bigint not null references "Usuarios"("IdUsuario"),
  "IdBodegaDestino" bigint not null references "Bodegas"("IdBodega"),
  "IdUsuarioAprobador" bigint references "Usuarios"("IdUsuario"),
  "FechaAprobacion" timestamptz,
  "FechaRegistroModificacion" timestamptz not null default now()
);

create table "SolicitudesDetalle" (
  "IdSolicitud" bigint not null references "Solicitudes"("IdSolicitud") on delete cascade,
  "CodigoProducto" text not null references "Productos"("CodigoProducto"),
  "Cantidad" numeric(14,3) not null check ("Cantidad" > 0),
  "CantidadAprobada" numeric(14,3) check ("CantidadAprobada" >= 0),
  "CantidadRecibida" numeric(14,3) not null default 0 check ("CantidadRecibida" >= 0),
  primary key ("IdSolicitud","CodigoProducto")
);

create table "HistorialSolicitudes" (
  "IdHistorial" bigint generated always as identity primary key,
  "IdSolicitud" bigint not null references "Solicitudes"("IdSolicitud"),
  "FechaIngreso" timestamptz not null default now(),
  "EstadoSolicitud" smallint not null check ("EstadoSolicitud" between 0 and 5),
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaModificacion" timestamptz not null default now()
);

create table "MovimientosBodega" (
  "IdMovimiento" bigint generated always as identity primary key,
  "FechaMovimiento" timestamptz not null default now(),
  "IdSolicitud" bigint references "Solicitudes"("IdSolicitud"),
  "IdBodegaOrigen" bigint not null references "Bodegas"("IdBodega"),
  "IdBodegaDestino" bigint not null references "Bodegas"("IdBodega"),
  "CodigoProducto" text not null references "Productos"("CodigoProducto"),
  "Cantidad" numeric(14,3) not null check ("Cantidad" > 0),
  "IdUsuarioCreacion" bigint references "Usuarios"("IdUsuario"),
  "FechaCreacion" timestamptz not null default now(),
  "IdUsuarioModificacion" bigint references "Usuarios"("IdUsuario"),
  "FechaModificacion" timestamptz not null default now()
);

-- Triggers de modificación
do $$
declare t text;
begin
  foreach t in array array['Usuarios','Claves','HistorialClaves','Roles','UsuariosRoles','Proveedores','ProveedoresSucursales','ProveedoresVendedores','Productos','Compras','Solicitudes'] loop
    execute format('create trigger trg_mod before update on %I for each row execute function set_modificacion()', t);
  end loop;
end $$;

-- RLS: activo y sin políticas => solo service_role (servidor) accede.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('revoke all on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;
