import "server-only";
import { db } from "@/lib/db/supabase";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { validarPolitica } from "@/lib/validation/password";

const HISTORIAL = 5;

/** Fija una nueva clave validando política e historial. debeCambiar = true cuando la fija un admin. */
export async function fijarClave(uid: number, nueva: string, actor: number, debeCambiar: boolean): Promise<string | null> {
  const err = validarPolitica(nueva);
  if (err) return err;

  const { data: hist } = await db.from("HistorialClaves").select("Password")
    .eq("IdUsuario", uid).order("FechaRegistroCreacion", { ascending: false }).limit(HISTORIAL);
  for (const h of hist ?? [])
    if (await verifyPassword(h.Password, nueva)) return `No puede reutilizar sus últimas ${HISTORIAL} claves`;

  const hash = await hashPassword(nueva);
  const { error: e1 } = await db.from("Claves").upsert({
    IdUsuario: uid, Password: hash, IdEstado: 1, DebeCambiar: debeCambiar,
    IntentosFallidos: 0, BloqueadoHasta: null,
    IdUsuarioCreacion: actor, IdUsuarioModificacion: actor,
  }, { onConflict: "IdUsuario" });
  if (e1) return "No se pudo guardar la clave";
  await db.from("HistorialClaves").insert({ IdUsuario: uid, Password: hash, IdUsuarioCreacion: actor, IdUsuarioModificacion: actor });
  return null;
}
