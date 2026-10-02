"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db/supabase";
import { requerirPermiso } from "@/lib/auth/session";
import { normalizarRut } from "@/lib/validation/rut";
import { proveedorSchema, sucursalSchema, vendedorSchema } from "@/lib/validation/schemas";

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
  const q = editId
    ? db.from("Proveedores").update(fila).eq("IdProveedor", id(editId)).select("IdProveedor").single()
    : db.from("Proveedores").insert(fila).select("IdProveedor").single();
  const { data, error } = await q;
  if (error) return { error: error.code === "23505" ? "El RUT ya está registrado" : "No se pudo guardar el proveedor" };
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
  const { error } = idSuc
    ? await db.from("ProveedoresSucursales").update(fila).eq("IdSucursal", id(idSuc)).eq("IdProveedor", idProv)
    : await db.from("ProveedoresSucursales").insert({ ...fila, IdProveedor: idProv });
  if (error) return { error: "No se pudo guardar la sucursal" };
  revalidatePath(`/proveedores/${idProv}`);
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
  const { error } = idVen
    ? await db.from("ProveedoresVendedores").update(fila).eq("IdVendedor", id(idVen)).eq("IdProveedor", idProv)
    : await db.from("ProveedoresVendedores").insert({ ...fila, IdProveedor: idProv });
  if (error) return { error: error.code === "23505" ? "El vendedor ya existe para este proveedor" : "No se pudo guardar el vendedor" };
  revalidatePath(`/proveedores/${idProv}`);
  return { ok: true };
}
