"use server";
import { db, nulo } from "@/lib/db/supabase";
import { requerirPermiso } from "@/lib/auth/session";
import { mapaNombres } from "@/lib/catalogo-nombres";

/** Resultados por búsqueda: lo que cabe en una lista desplegable (se afina escribiendo más). */
const LIMITE = 20;
const MAX_IDS = 100;
const texto = (q: unknown) => (typeof q === "string" ? q.slice(0, 80) : "");
const ids = (v: unknown) => (Array.isArray(v) ? v : []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, MAX_IDS);

export type ProductoHallado = { id: number; codigo: string | null; nombre: string; unidadBase: string; unidadNombre: string; costoBase: number | null; vigente: boolean };
export type ProveedorHallado = { id: number; rut: string; nombre: string };
/** Receta usable como ingrediente: `costoPorBase` es null si su costo está incompleto. */
export type SubrecetaHallada = { id: number; nombre: string; rendimientoUnidad: string; costoPorBase: number | null; vigente: boolean };

// Quien arma una factura, una solicitud o una receta (o mira productos) necesita buscar productos; proveedores, quien registra compras o los ve.
const PERMISOS_PRODUCTOS = ["compras.registrar", "solicitudes.crear", "recetas.gestionar", "productos.ver"];
const PERMISOS_PROVEEDORES = ["compras.registrar", "proveedores.ver"];

type FilaProducto = { IdProducto: number; Codigo: string | null; Nombre: string; UnidadBase: string; CostoUnitarioBase: number | null; IdEstado: number };

async function aProductos(filas: FilaProducto[]): Promise<ProductoHallado[]> {
  const unidades = await mapaNombres("UnidadesMedida");
  return filas.map((p) => ({
    id: p.IdProducto, codigo: p.Codigo, nombre: p.Nombre, unidadBase: p.UnidadBase,
    unidadNombre: unidades.get(p.UnidadBase) ?? p.UnidadBase,
    costoBase: p.CostoUnitarioBase === null ? null : Number(p.CostoUnitarioBase), vigente: p.IdEstado === 1,
  }));
}

/** Productos vigentes por código o nombre (sin distinguir mayúsculas ni tildes); texto vacío = los primeros por nombre. */
export async function buscarProductos(q: string): Promise<ProductoHallado[]> {
  await requerirPermiso(...PERMISOS_PRODUCTOS);
  const { data, error } = await db.rpc("listar_pagina", { p_tabla: "productos", p_q: texto(q), p_estado: 1, p_off: 0, p_lim: LIMITE });
  if (error) throw new Error("No se pudo buscar productos");
  return aProductos((data as { filas: FilaProducto[] }).filas);
}

/** Productos por id (vigentes o no): para mostrar lo ya elegido al restaurar un borrador o abrir una edición. */
export async function productosPorId(listaIds: number[]): Promise<ProductoHallado[]> {
  await requerirPermiso(...PERMISOS_PRODUCTOS);
  const buscados = ids(listaIds);
  if (!buscados.length) return [];
  const { data, error } = await db.from("Productos").select("IdProducto,Codigo,Nombre,UnidadBase,CostoUnitarioBase,IdEstado").in("IdProducto", buscados);
  if (error) throw new Error("No se pudo leer los productos");
  return aProductos(data);
}

/** Proveedores vigentes por RUT, razón social o giro. */
export async function buscarProveedores(q: string): Promise<ProveedorHallado[]> {
  await requerirPermiso(...PERMISOS_PROVEEDORES);
  const { data, error } = await db.rpc("listar_pagina", { p_tabla: "proveedores", p_q: texto(q), p_estado: 1, p_off: 0, p_lim: LIMITE });
  if (error) throw new Error("No se pudo buscar proveedores");
  return (data as { filas: { IdProveedor: number; Rut: string; RazonSocial: string }[] }).filas
    .map((p) => ({ id: p.IdProveedor, rut: p.Rut, nombre: p.RazonSocial }));
}

/** Proveedores vigentes por id (para restaurar un borrador). */
export async function proveedoresPorId(listaIds: number[]): Promise<ProveedorHallado[]> {
  await requerirPermiso(...PERMISOS_PROVEEDORES);
  const buscados = ids(listaIds);
  if (!buscados.length) return [];
  const { data, error } = await db.from("Proveedores").select("IdProveedor,Rut,RazonSocial").in("IdProveedor", buscados).eq("IdEstado", 1);
  if (error) throw new Error("No se pudo leer los proveedores");
  return data.map((p) => ({ id: p.IdProveedor, rut: p.Rut, nombre: p.RazonSocial }));
}

/** Costo por unidad base del rendimiento de cada receta (null si está incompleto), en una sola llamada. */
async function costosPorBase(listaIds: number[]): Promise<Map<number, number | null>> {
  if (!listaIds.length) return new Map();
  const { data, error } = await db.rpc("calcular_recetas", { p_ids: listaIds });
  if (error) throw new Error("No se pudo calcular el costo de las sub-recetas");
  const costos = (data ?? {}) as Record<string, { costoPorBase: number | null }>;
  return new Map(listaIds.map((id) => [id, costos[String(id)]?.costoPorBase ?? null]));
}

const PERMISOS_RECETAS = ["recetas.gestionar"];

/**
 * Sub-recetas posibles por nombre o código: vigentes con rendimiento, sin la receta que se edita (`excluir`) ni las que ya la
 * contienen (formarían un ciclo). Con su costo por unidad base.
 */
export async function buscarSubrecetas(q: string, excluir?: number): Promise<SubrecetaHallada[]> {
  await requerirPermiso(...PERMISOS_RECETAS);
  const excluida = ids([excluir])[0];
  const { data, error } = await db.rpc("buscar_subrecetas", { p_q: texto(q), p_excluir: excluida ?? nulo, p_lim: LIMITE });
  if (error) throw new Error("No se pudo buscar sub-recetas");
  const filas = data as { id: number; nombre: string; rendimientoUnidad: string }[];
  const costos = await costosPorBase(filas.map((f) => f.id));
  return filas.map((f) => ({ ...f, costoPorBase: costos.get(f.id) ?? null, vigente: true }));
}

/** Sub-recetas por id (vigentes o no): para mostrar las ya elegidas al abrir una receta. */
export async function subrecetasPorId(listaIds: number[]): Promise<SubrecetaHallada[]> {
  await requerirPermiso(...PERMISOS_RECETAS);
  const buscados = ids(listaIds);
  if (!buscados.length) return [];
  const { data, error } = await db.from("Recetas").select("IdReceta,Nombre,RendimientoUnidad,IdEstado").in("IdReceta", buscados).not("RendimientoUnidad", "is", null);
  if (error) throw new Error("No se pudo leer las sub-recetas");
  const costos = await costosPorBase(data.map((r) => r.IdReceta));
  return data.map((r) => ({
    id: r.IdReceta, nombre: r.Nombre, rendimientoUnidad: r.RendimientoUnidad as string,
    costoPorBase: costos.get(r.IdReceta) ?? null, vigente: r.IdEstado === 1,
  }));
}
