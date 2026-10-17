"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db/supabase";
import { autenticar } from "@/lib/auth/login";
import { esCorreoValido } from "@/lib/validation/correo";
import { ipCliente } from "@/lib/auth/ip";
import { crearSesion, cerrarSesion } from "@/lib/auth/session";

const schema = z.object({ correo: z.string().trim().max(254).refine(esCorreoValido), password: z.string().min(1).max(128) });

// Límite por IP en la BD (compartido entre instancias y con vencimiento): MAX intentos por ventana.
const VENTANA_S = 60;
const MAX = 10;

export async function login(_: unknown, fd: FormData): Promise<{ error: string } | undefined> {
  const ip = ipCliente(await headers());
  const { data: permitido, error } = await db.rpc("registrar_intento_login", { p_clave: ip, p_max: MAX, p_ventana_seg: VENTANA_S });
  if (error) return { error: "Servicio no disponible. Intente nuevamente." }; // sin contador no se deja pasar
  if (!permitido) return { error: "Demasiados intentos. Espere un minuto." };

  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Correo o clave incorrectos" };
  const res = await autenticar(p.data.correo, p.data.password);
  if (!res.ok) return { error: res.error };
  await crearSesion({ uid: res.uid, roles: res.roles, cambiar: res.cambiar });
  redirect(res.cambiar ? "/cambiar-clave" : "/");
}

export async function logout() {
  await cerrarSesion();
  redirect("/login");
}
