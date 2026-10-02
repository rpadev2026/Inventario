"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/supabase";
import { leerSesion, crearSesion } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { fijarClave } from "@/lib/services/claves";

export async function cambiarClave(_: unknown, fd: FormData): Promise<{ error: string } | undefined> {
  const s = await leerSesion();
  if (!s) redirect("/login");
  const actual = String(fd.get("actual") ?? "");
  const nueva = String(fd.get("nueva") ?? "");
  const conf = String(fd.get("conf") ?? "");
  if (nueva !== conf) return { error: "Las claves no coinciden" };
  const { data: c } = await db.from("Claves").select("Password").eq("IdUsuario", s.uid).single();
  if (!c || !(await verifyPassword(c.Password, actual))) return { error: "La clave actual es incorrecta" };
  const err = await fijarClave(s.uid, nueva, s.uid, false);
  if (err) return { error: err };
  await crearSesion({ ...s, cambiar: false });
  redirect("/");
}
