import Link from "next/link";
import { db } from "@/lib/db/supabase";
import { requerirPaginaPermiso } from "@/lib/auth/session";
import { normalizarRut } from "@/lib/validation/rut";
import { bsale, type FacturaRecibida } from "@/lib/services/bsale";
import Badge from "@/components/app/badge";

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fechaCl = (iso: string) => iso.split("-").reverse().join("-");

/** URL de «Nueva factura» con lo que la factura de Bsale ya trae (proveedor, folio, fecha y total de referencia). */
const urlNueva = (f: FacturaRecibida, tokenProveedor: string) =>
  `/compras/nueva?${new URLSearchParams({ proveedor: tokenProveedor, folio: String(f.folio), fecha: f.fecha, total: String(f.total) })}`;

/** Facturas de proveedores recibidas en Bsale (SII): elegir una abre «Nueva factura» con sus datos de cabecera; las líneas se ingresan a mano. */
export default async function FacturasBsalePage({ searchParams }: { searchParams: Promise<{ pagina?: string }> }) {
  await requerirPaginaPermiso("compras.registrar");
  const sp = await searchParams;
  const pagina = /^\d{1,4}$/.test(sp.pagina ?? "") ? Math.max(1, Number(sp.pagina)) : 1;

  const cliente = bsale();
  let facturas: FacturaRecibida[] = [], hayMas = false, error: string | undefined;
  if (!cliente) error = "Bsale no está configurado (falta BSALE_ACCESS_TOKEN).";
  else {
    try { ({ facturas, hayMas } = await cliente.facturasRecibidas(pagina)); }
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
      <p className="text-muted">Facturas de proveedores recibidas en el SII, vistas desde Bsale. Al elegir una se abre «Nueva factura» con proveedor, folio y fecha; las líneas se ingresan a mano.</p>
      {error && <p role="alert" className="alert alert-error">{error}</p>}
      {!error && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Folio</th><th>Proveedor</th><th>Fecha</th><th className="num">Neto</th><th className="num">Total</th><th>Estado</th><th>Acciones</th></tr></thead>
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
                    <td>
                      {!ya && token && <Link className="link link-sm" href={urlNueva(f, token)} aria-label={`Registrar factura folio ${f.folio}`}>Registrar</Link>}
                      {!ya && !token && <Link className="link link-sm" href="/proveedores?crear=1">Crear proveedor</Link>}
                    </td>
                  </tr>
                );
              })}
              {!facturas.length && <tr><td colSpan={7} className="text-muted">No hay facturas recibidas en esta página.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {!error && (pagina > 1 || hayMas) && (
        <div className="flex gap-4">
          {pagina > 1 && <Link className="link" href={`/compras/bsale?pagina=${pagina - 1}`}>← Más recientes</Link>}
          {hayMas && <Link className="link" href={`/compras/bsale?pagina=${pagina + 1}`}>Más antiguas →</Link>}
        </div>
      )}
    </section>
  );
}
