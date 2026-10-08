export const PERMISOS = [
  { codigo: "compras.ver", modulo: "Compras", descripcion: "Ver facturas de compra" },
  { codigo: "compras.registrar", modulo: "Compras", descripcion: "Registrar facturas de compra" },
  { codigo: "compras.anular", modulo: "Compras", descripcion: "Anular facturas de compra" },
  { codigo: "proveedores.ver", modulo: "Proveedores", descripcion: "Ver proveedores" },
  { codigo: "proveedores.gestionar", modulo: "Proveedores", descripcion: "Crear y editar proveedores" },
  { codigo: "productos.ver", modulo: "Productos", descripcion: "Ver productos" },
  { codigo: "productos.gestionar", modulo: "Productos", descripcion: "Crear y editar productos" },
  { codigo: "recetas.ver", modulo: "Recetas", descripcion: "Ver recetas y su costo" },
  { codigo: "recetas.gestionar", modulo: "Recetas", descripcion: "Crear y editar recetas" },
  { codigo: "bodegas.ver", modulo: "Bodegas", descripcion: "Ver bodegas y su stock" },
  { codigo: "solicitudes.ver_propias", modulo: "Solicitudes", descripcion: "Ver y recepcionar solicitudes propias" },
  { codigo: "solicitudes.crear", modulo: "Solicitudes", descripcion: "Crear, editar y enviar solicitudes propias" },
  { codigo: "solicitudes.gestionar", modulo: "Solicitudes", descripcion: "Ver, aprobar y despachar todas las solicitudes" },
  { codigo: "movimientos.ver", modulo: "Movimientos", descripcion: "Ver movimientos de inventario" },
] as const;

export type Permiso = (typeof PERMISOS)[number]["codigo"];

export const CODIGOS_PERMISO = PERMISOS.map((p) => p.codigo) as unknown as readonly [Permiso, ...Permiso[]];

const CONOCIDOS = new Set<string>(CODIGOS_PERMISO);

/** Administrador tiene todos; el resto, la unión de los permisos de sus roles (solo códigos del catálogo). */
export function permisosEfectivos(roles: string[], porRol: Record<string, string[]>): Permiso[] {
  if (roles.includes("Administrador")) return [...CODIGOS_PERMISO];
  const out = new Set<Permiso>();
  for (const r of roles) for (const c of porRol[r] ?? []) if (CONOCIDOS.has(c)) out.add(c as Permiso);
  return [...out];
}

/** Verdadero si tiene alguno de los requeridos (o si no se pide ninguno). */
export function tienePermiso(permisos: readonly string[], ...requeridos: Permiso[]): boolean {
  return requeridos.length === 0 || requeridos.some((p) => permisos.includes(p));
}
