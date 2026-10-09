import { z } from "zod";
import { validarRut } from "./rut";
import { codigoCatalogo } from "./catalogo";
import { esCorreoValido, MSG_CORREO } from "./correo";
import { parseCantidad, parseDecimal2 } from "../numeros";

const txt = (max = 150) => z.string().trim().max(max);
const opt = (max = 150) => txt(max).optional().transform((v) => v || null);
/** Texto en MAYÚSCULA (nombres, direcciones, giros...): se guarda siempre así. */
const txtM = (max = 150) => txt(max).transform((v) => v.toUpperCase());
const optM = (max = 150) => txtM(max).optional().transform((v) => v || null);
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
  razonSocial: txtM().pipe(z.string().min(1, "Razón social requerida")),
  direccion: optM(), region: opt(), comuna: opt(), ciudad: opt(), giro: optM(),
  rutRepresentante: z.string().trim().optional().transform((v) => v || null)
    .refine((v) => v === null || validarRut(v), "RUT del representante inválido"),
  nombreRepresentante: optM(),
  telefono: opt(30), correo: correoOpt, estado,
}).superRefine(territorioCompleto);

export const sucursalSchema = z.object({
  region: opt(), comuna: opt(), ciudad: opt(), direccion: txtM().pipe(z.string().min(1, "Dirección requerida")),
  telefono: opt(30), correo: correoOpt, encargado: optM(), estado,
}).superRefine(territorioCompleto);

export const vendedorSchema = z.object({
  rut, nombres: txtM().pipe(z.string().min(1, "Nombres requeridos")), apellidos: txtM().pipe(z.string().min(1, "Apellidos requeridos")),
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

/** Unidad opcional de un campo de stock («5» + «Kilo»): vacía = la unidad base del producto. */
const unidadOpcional = z.string().trim().toUpperCase().optional().transform((v) => v || undefined).pipe(codigoCatalogo.optional());

export const productoSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  // El código es opcional: vacío o solo espacios = no informado (se guarda null).
  codigo: z.string().trim().max(40).optional().transform((v) => (v ? v.toUpperCase() : undefined))
    .pipe(z.string().regex(/^[A-Za-z0-9._-]+$/, "Código: solo letras, números, . _ -").optional()),
  nombre: txt().min(1, "Nombre requerido").transform((v) => v.toUpperCase()),
  unidadBase: codigoCatalogo, formato: codigoCatalogo,
  // El stock se escribe en cualquier unidad de la familia; la acción lo convierte a unidad base y compara.
  stockMinimo: z.coerce.number().min(0), unidadMinimo: unidadOpcional,
  stockCritico: z.coerce.number().min(0), unidadCritico: unidadOpcional,
  estado,
});

export const facturaSchema = z.object({
  idProveedor: z.coerce.number().int().positive(),
  folio,
  fechaFactura: z.string().date(), fechaRecepcion: z.string().date(),
  formaPago: codigoCatalogo,
  neto: z.coerce.number().min(0), iva: z.coerce.number().min(0), total: z.coerce.number().min(0),
  detalle: z.array(z.object({
    producto: z.coerce.number().int().positive(), unidad: codigoCatalogo, precio, cantidad: z.coerce.number().positive(),
  })).min(1, "Agregue al menos un producto").max(200),
}).refine((f) => Math.abs(f.neto + f.iva - f.total) <= 1, { message: "Neto + IVA debe igualar el Total", path: ["total"] })
  // El precio de cada línea ya incluye IVA: el detalle debe sumar el total.
  .refine((f) => Math.abs(f.detalle.reduce((a, l) => a + Math.round(l.precio * l.cantidad * 100) / 100, 0) - f.total) <= 1, {
    message: "La suma del detalle no coincide con el total", path: ["total"],
  })
  .refine((f) => f.fechaRecepcion >= f.fechaFactura, {
    message: "La fecha de recepción no puede ser anterior a la fecha de factura", path: ["fechaRecepcion"],
  });

export const rolSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  nombre: txt(60).min(1, "Nombre requerido"),
  detalle: opt(200),
  estado,
  // Los códigos válidos son los de la tabla "Permisos": guardar_rol rechaza uno desconocido con un mensaje de negocio.
  permisos: z.array(z.string().regex(/^[a-z_]+\.[a-z_]+$/, "Permiso no válido")).default([]),
});

/** Cantidad positiva con hasta 3 decimales (número o texto con coma/punto). */
const positivo3 = (msg: string) => z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === "number" ? (Number.isFinite(v) && v > 0 && Math.abs(v * 1000 - Math.round(v * 1000)) < 1e-6 ? v : null) : parseCantidad(v.trim());
  if (n === null) { ctx.addIssue({ code: "custom", message: msg }); return z.NEVER; }
  return n;
});
const MSG_PORCIONES = "Porciones: número mayor que 0, hasta 2 decimales y 999.999,99 como máximo";
/** Porciones de una receta: mayor que 0, hasta 2 decimales y 999.999,99 (numeric(8,2) en la base). */
const porciones2 = z.union([z.number(), z.string()]).transform((v, ctx) => {
  const n = typeof v === "number" ? (Number.isFinite(v) && v > 0 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6 ? v : null) : parseDecimal2(v.trim());
  if (n === null || n <= 0 || n > 999999.99) { ctx.addIssue({ code: "custom", message: MSG_PORCIONES }); return z.NEVER; }
  return n;
});
const MSG_MERMA = "Merma: entre 0 y 1000 %, máximo 2 decimales";
/** Merma escrita en porcentaje (30 = 30 %) que se guarda como fracción (0,3). */
const mermaPct = z.union([z.number(), z.string()]).default(0).transform((v, ctx) => {
  const n = typeof v === "number" ? (Number.isFinite(v) && v >= 0 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6 ? v : null) : parseDecimal2(v.trim() || "0");
  if (n === null || n > 1000) { ctx.addIssue({ code: "custom", message: MSG_MERMA }); return z.NEVER; }
  return Number((n / 100).toFixed(4));
});
const vacioAUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

export const recetaSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  codigo: z.string().trim().max(40).optional().transform((v) => (v ? v.toUpperCase() : undefined))
    .pipe(z.string().regex(/^[A-Za-z0-9._-]+$/, "Código: solo letras, números, . _ -").optional()),
  nombre: txt().min(1, "Nombre requerido").transform((v) => v.toUpperCase()),
  porciones: z.preprocess((v) => (v === "" || v === undefined || v === null ? 1 : v), porciones2),
  rendimientoCantidad: z.preprocess(vacioAUndefined, positivo3("Rendimiento: número mayor que 0 (hasta 3 decimales)").optional()),
  rendimientoUnidad: unidadOpcional,
  estado,
  detalle: z.array(z.object({
    tipo: z.enum(["producto", "subreceta"]),
    ingrediente: z.coerce.number().int().positive("Elija el ingrediente"),
    cantidad: positivo3("La cantidad debe ser un número mayor que 0 (hasta 3 decimales)"),
    porcion: positivo3("La porción neta debe ser un número mayor que 0 (hasta 3 decimales)"),
    unidad: codigoCatalogo,
    merma: mermaPct,
  })).min(1, "Agregue al menos un ingrediente").max(200),
}).superRefine((r, ctx) => {
  if ((r.rendimientoCantidad === undefined) !== (r.rendimientoUnidad === undefined))
    ctx.addIssue({ code: "custom", message: "El rendimiento requiere cantidad y unidad", path: ["rendimientoCantidad"] });
  const vistos = new Set<string>();
  for (const l of r.detalle) {
    const k = `${l.tipo}:${l.ingrediente}`;
    if (vistos.has(k)) ctx.addIssue({ code: "custom", message: "Un ingrediente no puede repetirse en la receta", path: ["detalle"] });
    vistos.add(k);
  }
});
