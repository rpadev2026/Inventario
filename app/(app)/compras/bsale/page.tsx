import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { normalizarRut } from "@/lib/validation/rut";
import { bsale, type FacturaRecibida } from "@/lib/services/bsale";
import Badge from "@/components/app/badge";
import Field from "@/components/app/field";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCl = (iso: string) => iso.split("-").reverse().join("-");

/** URL de «Nueva factura» con lo que la factura de Bsale ya trae (proveedor, folio, fecha, total de referencia y, vía `bsale`, las líneas de su XML). */
const urlNueva = (f: FacturaRecibida, tokenProveedor: string) =>
  `/compras/nueva?${new URLSearchParams({ bsale: String(f.id), proveedor: tokenProveedor, folio: String(f.folio), fecha: f.fecha, total: String(f.total) })}`;

const ESTADO_SII: Record<string, string> = { ACD: "Aceptada", RCD: "Reclamada", ERM: "Recibida conforme", RFP: "Faltante parcial", RFT: "Faltante total", RFX: "Faltante", PAG: "Pagada" };
const estadoSii = (codigos: string[]) => (codigos.length ? codigos.map((c) => ESTADO_SII[c] ?? c).join(", ") : "Sin respuesta");

/** Lo escrito en el buscador: solo dígitos = folio; si no, un RUT (en el formato de Bsale: sin puntos y con guion). */
function filtroDe(q: string) {
  const t = q.trim();
  if (/^\d{1,15}$/.test(t)) return { folio: Number(t) };
  const rut = normalizarRut(t);
  return /^\d{1,8}-[\dK]$/.test(rut) ? { rut } : undefined;
}

/** Facturas de proveedores recibidas en Bsale (SII): elegir una abre «Nueva factura» con su cabecera y las líneas de su XML que se puedan cruzar con productos. */
export default async function FacturasBsalePage({ searchParams }: { searchParams: Promise<{ pagina?: string; q?: string }> }) {
  await requerirPaginaPermiso("compras.registrar");
  const sp = await searchParams;
  const pagina = /^\d{1,4}$/.test(sp.pagina ?? "") ? Math.max(1, Number(sp.pagina)) : 1;
  const q = (sp.q ?? "").slice(0, 30);
  const filtro = filtroDe(q);

  const cliente = bsale();
  let facturas: FacturaRecibida[] = [], hayMas = false, error: string | undefined;
  if (!cliente) error = "Bsale no está configurado (falta BSALE_ACCESS_TOKEN).";
  else {
    try { ({ facturas, hayMas } = await cliente.facturasRecibidas(pagina, filtro)); }
    catch (e) { console.error("[bsale] facturas:", (e as Error).message); error = "No se pudo consultar Bsale. Intente nuevamente en unos segundos."; }
  }

  // Qué proveedores existen aquí (por RUT) y qué facturas ya están registradas (proveedor + folio).
  const ruts = [...new Set(facturas.map((f) => normalizarRut(f.rutProveedor)))];
  const [{ data: provs }, { data: compras }] = ruts.length
    ? await Promise.all([
        db.from("Proveedores").select("Rut,Token").in("Rut", ruts),
        db.from("Compras").select("RutProveedor,Folio").in("RutProveedor", ruts).in("Folio", facturas.map((f) => f.folio)),
      ])
    : [{ data: [] }, { data: [] }];
  const tokenDe = new Map((provs ?? []).map((p) => [p.Rut, p.Token]));
  const registradas = new Set((compras ?? []).map((c) => `${c.RutProveedor}|${c.Folio}`));

  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">Facturas en Bsale</h1>
        <Link href="/compras" className="btn btn-secondary">Volver</Link>
      </div>
      <p className="text-muted">Facturas de proveedores recibidas en el SII, vistas desde Bsale. Al elegir una se abre «Nueva factura» con proveedor, folio, fecha y las líneas cuyo producto y unidad coincidan; el resto se ingresa a mano.</p>
      <form action="/compras/bsale" className="form-grid form-grid-3">
        <input type="hidden" name="pagina" value="" />
        <Field label="Folio o RUT del proveedor" className="fld-2"><input name="q" type="search" defaultValue={q} className="input" autoComplete="off" /></Field>
        <div className="form-actions">
          <button className="btn btn-primary">Buscar</button>
          {q && <Link className="btn btn-secondary" href="/compras/bsale?q=&pagina=" prefetch={false}>Limpiar</Link>}
        </div>
      </form>
      {q && !filtro && <p role="status" className="alert alert-warn">Escriba un folio (solo números) o un RUT válido; se muestran todas las facturas.</p>}
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      {!error && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Folio</th><th>Proveedor</th><th>Fecha</th><th className="num">Neto</th><th className="num">Total</th><th>Estado</th><th>SII</th><th>Acciones</th></tr></thead>
            <tbody>
              {facturas.map((f) => {
                const rut = normalizarRut(f.rutProveedor);
                const token = tokenDe.get(rut);
                const ya = registradas.has(`${rut}|${f.folio}`);
                return (
                  <tr key={f.id}>
                    <td>{f.folio}</td><td>{f.razonSocial} <span className="text-muted">({rut})</span></td>
                    <td>{fechaCl(f.fecha)}</td><td className="num">{clp.format(f.neto)}</td><td className="num">{clp.format(f.total)}</td>
                    <td>{ya ? <Badge tone="ok">Ya registrada</Badge> : token ? <Badge tone="info">Disponible</Badge> : <Badge tone="warn">Proveedor no registrado</Badge>}</td>
                    <td>{estadoSii(f.estadoSii)}</td>
                    <td>
                      {!ya && token && <Link className="link link-sm" href={urlNueva(f, token)} aria-label={`Registrar factura folio ${f.folio}`}>Registrar</Link>}
                      {!ya && !token && <Link className="link link-sm" href="/proveedores/nuevo">Crear proveedor</Link>}
                    </td>
                  </tr>
                );
              })}
              {!facturas.length && <tr><td colSpan={8} className="text-muted">No hay facturas recibidas en esta página.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!error && (pagina > 1 || hayMas) && (
        <div className="flex gap-4">
          {pagina > 1 && <Link className="link" href={`/compras/bsale?pagina=${pagina - 1}`} prefetch={false}>← Más recientes</Link>}
          {hayMas && <Link className="link" href={`/compras/bsale?pagina=${pagina + 1}`} prefetch={false}>Más antiguas →</Link>}
        </div>
      )}
    </section>
  );
}
