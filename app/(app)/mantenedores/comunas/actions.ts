"use server";
import { requerirAdmin } from "@/lib/auth/session";
import { CATALOGOS, guardarCatalogo } from "@/lib/services/catalogo";

export async function guardarComuna(_: unknown, fd: FormData) {
  const s = await requerirAdmin();
  return guardarCatalogo(CATALOGOS.comunas, s.uid, fd);
}
