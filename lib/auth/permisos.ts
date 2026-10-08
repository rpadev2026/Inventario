/**
 * Los permisos viven en la tabla "Permisos" (código, módulo, descripción y orden): es el único catálogo.
 * Aquí solo está la lógica que los usa. Un código escrito mal en el código lo detecta la prueba
 * supabase/tests/permisos.test.ts, que compara cada uso contra la tabla.
 */
export type PermisoCatalogo = { codigo: string; modulo: string; descripcion: string };

/**
 * Administrador tiene todos los permisos del catálogo (`catalogo`, leído de la tabla); el resto, la unión de los de sus roles
 * (RolesPermisos solo guarda códigos del catálogo: lo exige la clave foránea).
 */
export function permisosEfectivos(roles: string[], porRol: Record<string, string[]>, catalogo: readonly string[] = []): string[] {
  if (roles.includes("Administrador")) return [...catalogo];
  const out = new Set<string>();
  for (const r of roles) for (const c of porRol[r] ?? []) out.add(c);
  return [...out];
}

/** Verdadero si tiene alguno de los requeridos (o si no se pide ninguno). */
export function tienePermiso(permisos: readonly string[], ...requeridos: string[]): boolean {
  return requeridos.length === 0 || requeridos.some((p) => permisos.includes(p));
}

/** Agrupa el catálogo por módulo conservando el orden en que viene (el de la columna Orden). */
export function agruparPermisos(catalogo: readonly PermisoCatalogo[]): { modulo: string; permisos: PermisoCatalogo[] }[] {
  const grupos = new Map<string, PermisoCatalogo[]>();
  for (const p of catalogo) grupos.set(p.modulo, [...(grupos.get(p.modulo) ?? []), p]);
  return [...grupos].map(([modulo, permisos]) => ({ modulo, permisos }));
}
