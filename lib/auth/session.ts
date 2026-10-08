import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db/supabase";
import { permisosEfectivos, tienePermiso } from "./permisos";

const COOKIE = "sesion";
const DURACION_S = 60 * 60 * 8;
const key = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(s);
};

export type Sesion = { uid: number; roles: string[]; permisos: string[]; cambiar: boolean };

/** Lo que se firma en el JWT: nunca lleva permisos (se leen siempre de la BD). */
export type DatosSesion = { uid: number; roles: string[]; cambiar: boolean };

export async function crearSesion(s: DatosSesion) {
  const token = await new SignJWT({ roles: s.roles, cambiar: s.cambiar })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(s.uid))
    .setIssuedAt()
    .setExpirationTime(`${DURACION_S}s`)
    .sign(key());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_S,
  });
}

/**
 * Valida el token y luego revalida contra la BD (usuario vigente, roles y cambio de clave pendiente),
 * de modo que desactivar a un usuario o quitarle un rol surte efecto de inmediato y no al expirar el token.
 */
export const leerSesion = cache(async (): Promise<Sesion | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let uid: number;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    uid = Number(payload.sub);
  } catch {
    return null;
  }
  if (!Number.isInteger(uid)) return null;
  const [{ data: u }, { data: c }, { data: rs }] = await Promise.all([
    db.from("Usuarios").select("IdEstado").eq("IdUsuario", uid).maybeSingle(),
    db.from("Claves").select("DebeCambiar,IdEstado").eq("IdUsuario", uid).maybeSingle(),
    db.from("UsuariosRoles").select("IdRol,Roles!inner(NombreRol,IdEstado)").eq("IdUsuario", uid).eq("IdEstado", 1).eq("Roles.IdEstado", 1),
  ]);
  if (!u || u.IdEstado !== 1 || !c || c.IdEstado !== 1) return null;
  const vigentes = (rs ?? []) as any[];
  const roles = vigentes.map((r) => r.Roles.NombreRol as string);
  const idRoles = vigentes.map((r) => r.IdRol as number);
  const porRol: Record<string, string[]> = {};
  if (idRoles.length && !roles.includes("Administrador")) {
    const nombrePorId = new Map<number, string>(vigentes.map((r) => [r.IdRol as number, r.Roles.NombreRol as string]));
    const { data: rp } = await db.from("RolesPermisos").select("IdRol,Permiso").in("IdRol", idRoles);
    for (const x of (rp ?? []) as any[]) {
      const n = nombrePorId.get(x.IdRol);
      if (n) (porRol[n] ??= []).push(x.Permiso as string);
    }
  }
  // Administrador tiene todos los permisos de la tabla "Permisos"; el resto, los de sus roles.
  const catalogo = roles.includes("Administrador")
    ? ((await db.from("Permisos").select("Codigo")).data ?? []).map((p: any) => p.Codigo as string)
    : [];
  return { uid, roles, permisos: permisosEfectivos(roles, porRol, catalogo), cambiar: c.DebeCambiar };
});

export async function cerrarSesion() {
  (await cookies()).delete(COOKIE);
}

export function esAdmin(s: Sesion): boolean {
  return s.roles.includes("Administrador");
}

/** Exige sesión y alguno de los permisos (Administrador los tiene todos). Lanza error si no cumple. */
export async function requerirPermiso(...p: string[]): Promise<Sesion> {
  const s = await leerSesion();
  if (!s) throw new Error("No autenticado");
  if (s.cambiar) throw new Error("Debe cambiar su clave");
  if (!tienePermiso(s.permisos, ...p)) throw new Error("No autorizado");
  return s;
}

/** Igual que requerirPermiso pero para páginas: redirige. */
export async function requerirPaginaPermiso(...p: string[]): Promise<Sesion> {
  const s = await leerSesion();
  if (!s) redirect("/login");
  if (s.cambiar) redirect("/cambiar-clave");
  if (!tienePermiso(s.permisos, ...p)) redirect("/?acceso=denegado");
  return s;
}

/** Solo rol Administrador (mantenedores no asignables por permiso). */
export async function requerirAdmin(): Promise<Sesion> {
  const s = await leerSesion();
  if (!s) throw new Error("No autenticado");
  if (s.cambiar) throw new Error("Debe cambiar su clave");
  if (!esAdmin(s)) throw new Error("No autorizado");
  return s;
}

export async function requerirPaginaAdmin(): Promise<Sesion> {
  const s = await leerSesion();
  if (!s) redirect("/login");
  if (s.cambiar) redirect("/cambiar-clave");
  if (!esAdmin(s)) redirect("/?acceso=denegado");
  return s;
}
