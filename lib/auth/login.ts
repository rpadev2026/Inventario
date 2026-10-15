import "server-only";
import { db } from "@/lib/db/supabase";
import { hashPassword, verifyPassword } from "./password";

const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;
// Hash real para igualar tiempos cuando el usuario no existe (evita enumeración).
let dummy: Promise<string> | undefined;
const getDummy = () => (dummy ??= hashPassword("dummy-password-Xx1!"));

export type ResultadoLogin =
  | { ok: true; uid: number; roles: string[]; cambiar: boolean }
  | { ok: false; error: string };

const GENERICO = "Correo o clave incorrectos, o cuenta bloqueada temporalmente";

export async function autenticar(correo: string, password: string): Promise<ResultadoLogin> {
  const { data: u } = await db.from("Usuarios").select("IdUsuario, IdEstado").eq("Correo", correo.toLowerCase()).maybeSingle();
  const { data: c } = u
    ? await db.from("Claves").select("*").eq("IdUsuario", u.IdUsuario).eq("IdEstado", 1).maybeSingle()
    : { data: null };

  if (c?.BloqueadoHasta && new Date(c.BloqueadoHasta) > new Date())
    return { ok: false, error: GENERICO }; // mismo mensaje: no revelar si la cuenta existe o está bloqueada

  const valido = await verifyPassword(c?.Password ?? (await getDummy()), password);
  if (!u || u.IdEstado !== 1 || !c || !valido) {
    if (c) {
      const { error } = await db.rpc("registrar_fallo_login", { p_usuario: c.IdUsuario, p_max: MAX_INTENTOS, p_bloqueo_min: BLOQUEO_MIN });
      if (error) console.error("No se pudo registrar el intento fallido de login", error.code);
    }
    return { ok: false, error: GENERICO };
  }

  await db.from("Claves").update({ IntentosFallidos: 0, BloqueadoHasta: null }).eq("IdUsuario", c.IdUsuario);
  const { data: rs } = await db
    .from("UsuariosRoles").select("Roles!inner(NombreRol, IdEstado)")
    .eq("IdUsuario", u.IdUsuario).eq("IdEstado", 1).eq("Roles.IdEstado", 1);
  const roles = (rs ?? []).map((r) => r.Roles.NombreRol);
  return { ok: true, uid: u.IdUsuario, roles, cambiar: c.DebeCambiar };
}
