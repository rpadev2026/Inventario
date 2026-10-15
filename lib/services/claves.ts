import "server-only";
import { db } from "@/lib/db/supabase";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { validarPolitica } from "@/lib/validation/password";

const HISTORIAL = 5;

/** Fija una nueva clave validando política e historial. debeCambiar = true cuando la fija un admin. */
export async function fijarClave(uid: number, nueva: string, actor: number, debeCambiar: boolean): Promise<string | null> {
  const err = validarPolitica(nueva);
  if (err) return err;

  const [{ data: hist, error: eh }, { data: actual, error: ea }] = await Promise.all([
    db.from("HistorialClaves").select("Password")
      .eq("IdUsuario", uid).order("FechaRegistroCreacion", { ascending: false }).limit(HISTORIAL),
    db.from("Claves").select("Password").eq("IdUsuario", uid).maybeSingle(),
  ]);
  // Sin poder consultar el historial no se puede garantizar la política: se rechaza.
  if (eh || ea) return "No se pudo guardar la clave";
  // La clave vigente cuenta aunque falte en el historial.
  const previas = [...(hist ?? []).map((h) => h.Password), ...(actual ? [actual.Password] : [])];
  for (const p of previas)
    if (await verifyPassword(p, nueva)) return `No puede reutilizar sus últimas ${HISTORIAL} claves`;

  // Clave, versión de sesión (invalida los tokens anteriores) e historial en una transacción.
  const { error } = await db.rpc("fijar_clave", { p_usuario: uid, p_hash: await hashPassword(nueva), p_actor: actor, p_debe_cambiar: debeCambiar });
  return error ? "No se pudo guardar la clave" : null;
}
