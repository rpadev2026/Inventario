import { revalidatePath } from "next/cache";
import { db } from "../db/supabase";
import { catalogoSchema } from "../validation/catalogo";
import { textoUso } from "../uso";

export type CatalogoCfg = {
  tabla: "FormasPago" | "UnidadesMedida" | "Formatos" | "Regiones" | "Provincias" | "Comunas";
  id: "IdFormaPago" | "IdUnidadMedida" | "IdFormato" | "IdRegion" | "IdProvincia" | "IdComuna";
  titulo: string;
  ruta: string;
  patronCodigo?: RegExp;
  ayudaCodigo?: string;
  padre?: { columna: "CodigoRegion" | "CodigoProvincia"; tabla: "Regiones" | "Provincias"; etiqueta: "Región" | "Ciudad (provincia)" };
  /** Dónde se usa cada registro (para mostrarlo en «Ver» antes de desactivarlo). */
  uso?: UsoCfg[];
};

/** Una tabla que referencia al catálogo por código; `conEstado` agrega cuántos de esos registros están vigentes. */
export type UsoCfg = { etiqueta: string; tabla: string; columna: string; singular: string; plural: string; conEstado?: boolean };

export const CATALOGOS: Record<"formasPago" | "unidades" | "formatos" | "regiones" | "ciudades" | "comunas", CatalogoCfg> = {
  formasPago: { tabla: "FormasPago", id: "IdFormaPago", titulo: "Formas de pago", ruta: "/mantenedores/formas-pago", uso: [{ etiqueta: "Facturas de compra", tabla: "Compras", columna: "FormaPago", singular: "factura", plural: "facturas" }] },
  unidades: { tabla: "UnidadesMedida", id: "IdUnidadMedida", titulo: "Unidades de medida", ruta: "/mantenedores/unidades-medida", uso: [{ etiqueta: "Productos", tabla: "Productos", columna: "UnidadMedida", singular: "producto", plural: "productos", conEstado: true }] },
  formatos: { tabla: "Formatos", id: "IdFormato", titulo: "Formatos", ruta: "/mantenedores/formatos", uso: [{ etiqueta: "Productos", tabla: "Productos", columna: "Formato", singular: "producto", plural: "productos", conEstado: true }] },
  regiones: {
    tabla: "Regiones", id: "IdRegion", titulo: "Regiones", ruta: "/mantenedores/regiones",
    patronCodigo: /^\d{2}$/, ayudaCodigo: "2 dígitos, código CUT",
    uso: [
      { etiqueta: "Ciudades de la región", tabla: "Provincias", columna: "CodigoRegion", singular: "ciudad", plural: "ciudades", conEstado: true },
      { etiqueta: "Proveedores", tabla: "Proveedores", columna: "Region", singular: "proveedor", plural: "proveedores" },
      { etiqueta: "Sucursales de proveedores", tabla: "ProveedoresSucursales", columna: "Region", singular: "sucursal", plural: "sucursales" },
    ],
  },
  ciudades: {
    tabla: "Provincias", id: "IdProvincia", titulo: "Ciudades (provincias)", ruta: "/mantenedores/ciudades",
    patronCodigo: /^\d{3}$/, ayudaCodigo: "3 dígitos, código CUT",
    padre: { columna: "CodigoRegion", tabla: "Regiones", etiqueta: "Región" },
    uso: [
      { etiqueta: "Comunas de la ciudad", tabla: "Comunas", columna: "CodigoProvincia", singular: "comuna", plural: "comunas", conEstado: true },
      { etiqueta: "Proveedores", tabla: "Proveedores", columna: "Ciudad", singular: "proveedor", plural: "proveedores" },
      { etiqueta: "Sucursales de proveedores", tabla: "ProveedoresSucursales", columna: "Ciudad", singular: "sucursal", plural: "sucursales" },
    ],
  },
  comunas: {
    tabla: "Comunas", id: "IdComuna", titulo: "Comunas", ruta: "/mantenedores/comunas",
    patronCodigo: /^\d{5}$/, ayudaCodigo: "5 dígitos, código CUT",
    padre: { columna: "CodigoProvincia", tabla: "Provincias", etiqueta: "Ciudad (provincia)" },
    uso: [
      { etiqueta: "Proveedores", tabla: "Proveedores", columna: "Comuna", singular: "proveedor", plural: "proveedores" },
      { etiqueta: "Sucursales de proveedores", tabla: "ProveedoresSucursales", columna: "Comuna", singular: "sucursal", plural: "sucursales" },
    ],
  },
};

/** Datos planos (serializables) que FormCatalogo necesita; nunca pasar el cfg completo (tiene RegExp) a un componente cliente. */
export type PropsFormCatalogo = {
  codigoNumerico: boolean;
  ayudaCodigo?: string;
  padre?: { columna: "CodigoRegion" | "CodigoProvincia"; etiqueta: string };
};

export function propsFormCatalogo(cfg: CatalogoCfg): PropsFormCatalogo {
  const props: PropsFormCatalogo = { codigoNumerico: !!cfg.patronCodigo };
  if (cfg.ayudaCodigo) props.ayudaCodigo = cfg.ayudaCodigo;
  if (cfg.padre) props.padre = { columna: cfg.padre.columna, etiqueta: cfg.padre.etiqueta };
  return props;
}

type Datos = { codigo: string; nombre: string; estado: number; padre?: string };

/** Fila a persistir. Al editar nunca incluye `Codigo` ni el padre (inmutables). */
export function prepararFila(cfg: CatalogoCfg, d: Datos, uid: number, editando: boolean) {
  const base = { Nombre: d.nombre, IdEstado: d.estado, IdUsuarioModificacion: uid };
  if (editando) return base;
  return {
    Codigo: d.codigo,
    ...(cfg.padre ? { [cfg.padre.columna]: d.padre } : {}),
    ...base,
    IdUsuarioCreacion: uid,
  };
}

/** Validación previa pura (sin BD). */
export function validarEntradaCatalogo(cfg: CatalogoCfg, fd: FormData): { error?: string; datos?: Datos } {
  const p = catalogoSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (cfg.patronCodigo && !cfg.patronCodigo.test(p.data.codigo)) return { error: cfg.ayudaCodigo };
  const padre = String(fd.get("padre") ?? "").trim();
  const editando = fd.get("modo") === "editar";
  if (cfg.padre && !editando && !padre) return { error: `Elija ${cfg.padre.etiqueta}` };
  if (cfg.padre && !editando && !p.data.codigo.startsWith(padre)) {
    return { error: `El código debe comenzar con ${padre}` };
  }
  return { datos: { ...p.data, ...(padre ? { padre } : {}) } };
}

export async function guardarCatalogo(
  cfg: CatalogoCfg, uid: number, fd: FormData,
): Promise<{ error?: string; ok?: boolean }> {
  const v = validarEntradaCatalogo(cfg, fd);
  if (v.error || !v.datos) return { error: v.error };
  const editando = fd.get("modo") === "editar";
  const fila = prepararFila(cfg, v.datos, uid, editando);
  const { error } = editando
    ? await db.from(cfg.tabla).update(fila).eq("Codigo", v.datos.codigo)
    : await db.from(cfg.tabla).insert(fila);
  if (error) {
    if (error.code === "P0001") return { error: error.message };
    if (error.code === "23503") return { error: "El padre elegido no existe" };
    if (error.code === "23505") return { error: "Ya existe un registro con ese código" };
    return { error: "No se pudo guardar" };
  }
  revalidatePath(cfg.ruta);
  return { ok: true };
}

/** Cuántos registros usan un valor del catálogo (por cada tabla que lo referencia), ya redactado para mostrarlo. */
export async function cargarUso(cfg: CatalogoCfg, codigo: string): Promise<{ etiqueta: string; texto: string }[]> {
  return Promise.all((cfg.uso ?? []).map(async (u) => {
    const base = () => db.from(u.tabla).select("*", { count: "exact", head: true }).eq(u.columna, codigo);
    const [{ count: total }, vigentes] = await Promise.all([base(), u.conEstado ? base().eq("IdEstado", 1) : Promise.resolve(null)]);
    return { etiqueta: u.etiqueta, texto: textoUso(total ?? 0, u.singular, u.plural, vigentes ? vigentes.count ?? 0 : undefined) };
  }));
}
