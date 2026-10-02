import { db } from "../db/supabase";
import { errorTerritorio, type Seleccion, type Territorio } from "../territorio-opciones";

/** Lee regiones, ciudades (Provincias) y comunas completas (vigentes y no), ordenadas por nombre. */
export async function cargarTerritorio(): Promise<Territorio> {
  const [r, c, m] = await Promise.all([
    db.from("Regiones").select("Codigo,Nombre,IdEstado").order("Nombre"),
    db.from("Provincias").select("Codigo,Nombre,IdEstado,CodigoRegion").order("Nombre"),
    db.from("Comunas").select("Codigo,Nombre,IdEstado,CodigoProvincia").order("Nombre"),
  ]);
  return {
    regiones: (r.data ?? []) as Territorio["regiones"],
    ciudades: (c.data ?? []) as Territorio["ciudades"],
    comunas: (m.data ?? []) as Territorio["comunas"],
  };
}

/** Mensaje de negocio si la selección territorial es inválida; `null` si está bien. */
export async function verificarTerritorio(sel: Seleccion, actual: Seleccion): Promise<string | null> {
  return errorTerritorio(await cargarTerritorio(), sel, actual);
}
