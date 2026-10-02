"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/supabase";
import { requerirPermiso } from "@/lib/auth/session";
import { facturaSchema } from "@/lib/validation/schemas";

export async function registrarFactura(input: unknown): Promise<{ error?: string; ok?: boolean }> {
  const s = await requerirPermiso("compras.registrar");
  const p = facturaSchema.safeParse(input);
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const { error } = await db.rpc("registrar_factura", {
    p_usuario: s.uid, p_proveedor: d.idProveedor, p_folio: d.folio,
    p_fecha_factura: d.fechaFactura, p_fecha_recepcion: d.fechaRecepcion, p_forma_pago: d.formaPago,
    p_neto: d.neto, p_iva: d.iva, p_total: d.total, p_detalle: d.detalle,
  });
  if (error) {
    if (error.code === "23505") return { error: "Ya existe una factura con ese folio para este proveedor" };
    // Mensajes de negocio lanzados por la función (raise exception) son seguros de mostrar.
    if (error.code === "P0001") return { error: error.message };
    return { error: "No se pudo registrar la factura" };
  }
  revalidatePath("/compras");
  return { ok: true };
}

export async function anularFactura(_: unknown, fd: FormData): Promise<{ error?: string; ok?: boolean }> {
  const s = await requerirPermiso("compras.anular");
  const id = Number(fd.get("id"));
  const motivo = String(fd.get("motivo") ?? "").slice(0, 300);
  if (!Number.isInteger(id) || id <= 0) return { error: "Factura inválida" };
  const { error } = await db.rpc("anular_factura", { p_usuario: s.uid, p_compra: id, p_motivo: motivo });
  if (error) return { error: error.code === "P0001" ? error.message : "No se pudo anular la factura" };
  revalidatePath("/compras");
  revalidatePath("/bodegas");
  return { ok: true };
}
