import { z } from "zod";
import { validarRut } from "./rut";
import { codigoCatalogo } from "./catalogo";
import { esCorreoValido, MSG_CORREO } from "./correo";
import { parseDecimal2 } from "../numeros";
import { CODIGOS_PERMISO } from "../auth/permisos";

const txt = (max = 150) => z.string().trim().max(max);
const opt = (max = 150) => txt(max).optional().transform((v) => v || null);
const rut = z.string().refine(validarRut, "RUT inválido");
const correoOpt = z.string().trim().toLowerCase().max(254).optional()
  .transform((v) => v || null)
  .refine((v) => v === null || esCorreoValido(v), MSG_CORREO);
const estado = z.coerce.number().pipe(z.union([z.literal(0), z.literal(1)])).default(1);

/** Jerarquía territorial: la comuna requiere ciudad y la ciudad requiere región (existencia/pertenencia se validan en la acción). */
const territorioCompleto = (
  v: { region: string | null; ciudad: string | null; comuna: string | null },
  ctx: z.RefinementCtx,
) => {
  if (v.comuna && !v.ciudad) ctx.addIssue({ code: "custom", message: "La comuna requiere ciudad", path: ["comuna"] });
  if (v.ciudad && !v.region) ctx.addIssue({ code: "custom", message: "La ciudad requiere región", path: ["ciudad"] });
};

export const proveedorSchema = z.object({
  rut,
  razonSocial: txt().min(1, "Razón social requerida"),
  direccion: opt(), region: opt(), comuna: opt(), ciudad: opt(), giro: opt(),
  rutRepresentante: z.string().trim().optional().transform((v) => v || null)
    .refine((v) => v === null || validarRut(v), "RUT del representante inválido"),
  nombreRepresentante: opt(),
  telefono: opt(30), correo: correoOpt, estado,
}).superRefine(territorioCompleto);

export const sucursalSchema = z.object({
  region: opt(), comuna: opt(), ciudad: opt(), direccion: txt().min(1, "Dirección requerida"),
  telefono: opt(30), correo: correoOpt, encargado: opt(), estado,
}).superRefine(territorioCompleto);

export const vendedorSchema = z.object({
  rut, nombres: txt().min(1, "Nombres requeridos"), apellidos: txt().min(1, "Apellidos requeridos"),
  telefono: opt(30), correo: correoOpt, estado,
});

const MSG_FOLIO = "Folio: solo números enteros";
const folio = z.union([z.number(), z.string()]).transform((v, ctx) => {
  if (typeof v === "number" ? Number.isSafeInteger(v) && v > 0 : /^[1-9]\d{0,14}$/.test(v)) return Number(v);
  ctx.addIssue({ code: "custom", message: MSG_FOLIO });
  return z.NEVER;
});

const MSG_PRECIO = "Precio: máximo 2 decimales";
const precio = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === "number" ? (Number.isFinite(v) && v >= 0 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6 ? v : null) : parseDecimal2(v);
  if (n === null) {
    ctx.addIssue({ code: "custom", message: MSG_PRECIO });
    return z.NEVER;
  }
  return n;
});

const PRECIO_COMPRA_MAX = 9_999_999_999.99; // numeric(12,2)
export const productoSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  // El código es opcional: vacío o solo espacios = no informado (se guarda null).
  codigo: z.string().trim().max(40).optional().transform((v) => v || undefined)
    .pipe(z.string().regex(/^[A-Za-z0-9._-]+$/, "Código: solo letras, números, . _ -").optional()),
  nombre: txt().min(1, "Nombre requerido"),
  unidad: codigoCatalogo, formato: codigoCatalogo,
  precioCompra: precio.refine((n) => n <= PRECIO_COMPRA_MAX, "Precio de compra demasiado alto"),
  stockMinimo: z.coerce.number().min(0), stockCritico: z.coerce.number().min(0), estado,
}).refine((p) => p.stockCritico <= p.stockMinimo, { message: "El stock crítico no puede superar al mínimo", path: ["stockCritico"] });

export const facturaSchema = z.object({
  idProveedor: z.coerce.number().int().positive(),
  folio,
  fechaFactura: z.string().date(), fechaRecepcion: z.string().date(),
  formaPago: codigoCatalogo,
  neto: z.coerce.number().min(0), iva: z.coerce.number().min(0), total: z.coerce.number().min(0),
  detalle: z.array(z.object({
    producto: z.coerce.number().int().positive(), precio, cantidad: z.coerce.number().positive(),
  })).min(1, "Agregue al menos un producto").max(200),
}).refine((f) => Math.abs(f.neto + f.iva - f.total) <= 1, { message: "Neto + IVA debe igualar el Total", path: ["total"] })
  .refine((f) => f.fechaRecepcion >= f.fechaFactura, {
    message: "La fecha de recepción no puede ser anterior a la fecha de factura", path: ["fechaRecepcion"],
  });

export const rolSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  nombre: txt(60).min(1, "Nombre requerido"),
  detalle: opt(200),
  estado,
  permisos: z.array(z.enum(CODIGOS_PERMISO)).default([]),
});
