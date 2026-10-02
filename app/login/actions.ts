"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { autenticar } from "@/lib/auth/login";
import { crearSesion, cerrarSesion } from "@/lib/auth/session";

const schema = z.object({ correo: z.string().email().max(254), password: z.string().min(1).max(128) });

// Límite de tasa simple por IP en memoria (por instancia). En producción multi-instancia usar un almacén compartido.
const intentos = new Map<string, { n: number; t: number }>();
const VENTANA = 60_000;
const MAX = 10;

export async function login(_: unknown, fd: FormData): Promise<{ error: string } | undefined> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const r = intentos.get(ip);
  if (r && now - r.t < VENTANA && r.n >= MAX) return { error: "Demasiados intentos. Espere un minuto." };
  intentos.set(ip, r && now - r.t < VENTANA ? { n: r.n + 1, t: r.t } : { n: 1, t: now });

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
