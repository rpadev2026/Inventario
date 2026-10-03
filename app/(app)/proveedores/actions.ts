"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Seleccion } from "@/lib/territorio-opciones";
import { db } from "@/lib/db/supabase";
import { requerirPermiso } from "@/lib/auth/session";
import { normalizarRut } from "@/lib/validation/rut";
import { verificarTerritorio } from "@/lib/services/territorio";
import { proveedorSchema, sucursalSchema, vendedorSchema } from "@/lib/validation/schemas";
import { vendedorVigenteEnOtro } from "@/lib/vendedor-rut";

type R = { error?: string; ok?: boolean; id?: number; razonSocial?: string };
const id = (v: FormDataEntryValue | null) => z.coerce.number().int().positive().parse(v);

export async function guardarProveedor(_: unknown, fd: FormData): Promise<R> {
  const s = await requerirPermiso("proveedores.gestionar");
  const p = proveedorSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const fila = {
    Rut: normalizarRut(d.rut), RazonSocial: d.razonSocial, Direccion: d.direccion, Region: d.region, Comuna: d.comuna,
    Ciudad: d.ciudad, Giro: d.giro, RutRepresentanteLegal: d.rutRepresentante ? normalizarRut(d.rutRepresentante) : null,
    NombreRepresentanteLegal: d.nombreRepresentante, Telefono: d.telefono, Correo: d.correo, IdEstado: d.estado, IdUsuario: s.uid,
  };
  const editId = fd.get("idProveedor");
  let actual: Seleccion = { region: null, ciudad: null, comuna: null };
  if (editId) {
    const { data: fa } = await db.from("Proveedores").select("Region,Ciudad,Comuna").eq("IdProveedor", id(editId)).maybeSingle();
    if (fa) actual = { region: fa.Region, ciudad: fa.Ciudad, comuna: fa.Comuna };
  }
  const errT = await verificarTerritorio({ region: d.region, ciudad: d.ciudad, comuna: d.comuna }, actual);
  if (errT) return { error: errT };
  const q = editId
    ? db.from("Proveedores").update(fila).eq("IdProveedor", id(editId)).select("IdProveedor").single()
    : db.from("Proveedores").insert(fila).select("IdProveedor").single();
  const { data, error } = await q;
  if (error) return { error: error.code === "P0001" ? error.message : error.code === "23505" ? "El RUT ya está registrado" : "No se pudo guardar el proveedor" };
  revalidatePath("/proveedores");
  return { ok: true, id: data.IdProveedor, razonSocial: d.razonSocial };
}

export async function guardarSucursal(_: unknown, fd: FormData): Promise<R> {
  const s = await requerirPermiso("proveedores.gestionar");
  const p = sucursalSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const fila = {
    Region: d.region, Comuna: d.comuna, Ciudad: d.ciudad, Direccion: d.direccion, Telefono: d.telefono,
    Correo: d.correo, EncargadoSucursal: d.encargado, IdEstado: d.estado, IdUsuario: s.uid,
  };
  const idProv = id(fd.get("idProveedor"));
  const idSuc = fd.get("idSucursal");
  let actual: Seleccion = { region: null, ciudad: null, comuna: null };
  if (idSuc) {
    const { data: fa } = await db.from("ProveedoresSucursales").select("Region,Ciudad,Comuna").eq("IdSucursal", id(idSuc)).eq("IdProveedor", idProv).maybeSingle();
    if (fa) actual = { region: fa.Region, ciudad: fa.Ciudad, comuna: fa.Comuna };
  }
  const errT = await verificarTerritorio({ region: d.region, ciudad: d.ciudad, comuna: d.comuna }, actual);
  if (errT) return { error: errT };
  const { error } = idSuc
    ? await db.from("ProveedoresSucursales").update(fila).eq("IdSucursal", id(idSuc)).eq("IdProveedor", idProv)
    : await db.from("ProveedoresSucursales").insert({ ...fila, IdProveedor: idProv });
  if (error) return { error: error.code === "P0001" ? error.message : "No se pudo guardar la sucursal" };
  revalidatePath("/proveedores");
  return { ok: true };
}

export async function guardarVendedor(_: unknown, fd: FormData): Promise<R> {
  const s = await requerirPermiso("proveedores.gestionar");
  const p = vendedorSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const fila = {
    Rut: normalizarRut(d.rut), Nombres: d.nombres, Apellidos: d.apellidos, Telefono: d.telefono,
    Correo: d.correo, IdEstado: d.estado, IdUsuario: s.uid,
  };
  const idProv = id(fd.get("idProveedor"));
  const idVen = fd.get("idVendedor");
  // Un RUT puede repetirse en otros proveedores, pero vigente en uno solo (se excluye el propio registro al editar).
  if (d.estado === 1) {
    const { data: previos } = await db.from("ProveedoresVendedores")
      .select("IdVendedor,IdProveedor,IdEstado,Proveedores(RazonSocial)").eq("Rut", fila.Rut).eq("IdEstado", 1).returns<any[]>();
    const conflicto = vendedorVigenteEnOtro(
      (previos ?? []).map((r) => ({ IdVendedor: r.IdVendedor, IdProveedor: r.IdProveedor, IdEstado: r.IdEstado, RazonSocial: r.Proveedores?.RazonSocial ?? "otro proveedor" })),
      idVen ? id(idVen) : undefined);
    if (conflicto) {
      return { error: conflicto.IdProveedor === idProv
        ? "Este RUT ya está registrado como vendedor vigente de este proveedor. Edite el vendedor existente."
        : `El RUT ya está vigente como vendedor de «${conflicto.RazonSocial}». Debe dejarlo no vigente en ese proveedor para registrarlo aquí.` };
    }
  }
  const { error } = idVen
    ? await db.from("ProveedoresVendedores").update(fila).eq("IdVendedor", id(idVen)).eq("IdProveedor", idProv)
    : await db.from("ProveedoresVendedores").insert({ ...fila, IdProveedor: idProv });
  if (error) return { error: error.code === "23505" ? "Este RUT ya está registrado en este proveedor. Edite el vendedor existente (puede estar no vigente)." : "No se pudo guardar el vendedor" };
  revalidatePath("/proveedores");
  return { ok: true };
}
