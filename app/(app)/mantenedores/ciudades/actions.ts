"use server";
import { requerirAdmin } from "@/lib/auth/session";
import { CATALOGOS, guardarCatalogo } from "@/lib/services/catalogo";

export async function guardarCiudad(_: unknown, fd: FormData) {
  const s = await requerirAdmin();
  return guardarCatalogo(CATALOGOS.ciudades, s.uid, fd);
}
