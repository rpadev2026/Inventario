import type { Opcion } from "./buscar";

export type ItemTerritorio = { Codigo: string; Nombre: string; IdEstado: number };
export type Territorio = {
  regiones: ItemTerritorio[];
  ciudades: (ItemTerritorio & { CodigoRegion: string })[];
  comunas: (ItemTerritorio & { CodigoProvincia: string })[];
};
export type Seleccion = { region: string | null; ciudad: string | null; comuna: string | null };

/** Vigentes más el actual (marcado si está inactivo), ordenados por nombre. */
function opciones(items: ItemTerritorio[], actual: string | null): Opcion[] {
  return items
    .filter((i) => i.IdEstado === 1 || i.Codigo === actual)
    .sort((a, b) => a.Nombre.localeCompare(b.Nombre, "es"))
    .map((i) => ({
      valor: i.Codigo,
      etiqueta: i.IdEstado === 1 ? i.Nombre : `${i.Nombre} (no vigente)`,
      busqueda: i.Nombre,
    }));
}

export function opcionesRegion(t: Territorio, actual: string | null): Opcion[] {
  return opciones(t.regiones, actual);
}

export function opcionesCiudad(t: Territorio, region: string | null, actual: string | null): Opcion[] {
  if (!region) return [];
  return opciones(t.ciudades.filter((c) => c.CodigoRegion === region), actual);
}

export function opcionesComuna(t: Territorio, ciudad: string | null, actual: string | null): Opcion[] {
  if (!ciudad) return [];
  return opciones(t.comunas.filter((c) => c.CodigoProvincia === ciudad), actual);
}

/** Mensaje de negocio si la selección es inválida; `null` si está bien o vacía. */
export function errorTerritorio(t: Territorio, sel: Seleccion, actual: Seleccion): string | null {
  if (sel.comuna && !sel.ciudad) return "La comuna requiere ciudad";
  if (sel.ciudad && !sel.region) return "La ciudad requiere región";
  const vigenteOActual = (i: ItemTerritorio, cod: string | null) => i.IdEstado === 1 || i.Codigo === cod;
  const region = sel.region ? t.regiones.find((r) => r.Codigo === sel.region) : null;
  if (sel.region && (!region || !vigenteOActual(region, actual.region))) return "Región no válida";
  const ciudad = sel.ciudad ? t.ciudades.find((c) => c.Codigo === sel.ciudad) : null;
  if (sel.ciudad && (!ciudad || !vigenteOActual(ciudad, actual.ciudad))) return "Ciudad no válida";
  const comuna = sel.comuna ? t.comunas.find((c) => c.Codigo === sel.comuna) : null;
  if (sel.comuna && (!comuna || !vigenteOActual(comuna, actual.comuna))) return "Comuna no válida";
  if (ciudad && ciudad.CodigoRegion !== sel.region) return "La ciudad no pertenece a la región";
  if (comuna && comuna.CodigoProvincia !== sel.ciudad) return "La comuna no pertenece a la ciudad";
  return null;
}
