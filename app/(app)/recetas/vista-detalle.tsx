import Link from "next/link";
import { db } from "@/lib/db/supabase";
import Badge from "@/components/app/badge";
import { calcular, clp, Dato, href, num, type Contexto, type RecetaRow } from "./comun";

/** Ver: datos de la receta, sus ingredientes con su costo y el resumen. */
export async function VistaDetalle({ ctx, rec }: { ctx: Contexto; rec: RecetaRow }) {
  const { base, volverListado, nombreUnidad } = ctx;
  const idVer = rec.IdReceta;
  const [calculo, { data: detalles }] = await Promise.all([
    calcular(idVer),
    db.from("RecetaDetalles").select("IdDetalle,Cantidad,PorcionNeta,UnidadMedida,PorcentajeMerma").eq("IdReceta", idVer),
  ]);
  const porDetalle = new Map((detalles ?? []).map((d) => [d.IdDetalle as number, d]));
  const idsSub = (calculo?.lineas ?? []).filter((l) => l.tipo === "subreceta").map((l) => l.id);
  const { data: toks } = idsSub.length ? await db.from("Recetas").select("IdReceta,Token").in("IdReceta", idsSub) : { data: [] };
  const tokenSub = new Map((toks ?? []).map((t) => [t.IdReceta, t.Token]));
  const lineas = (calculo?.lineas ?? []).map((l) => ({ ...l, d: porDetalle.get(l.detalle) }));
  const sinFactura = lineas.filter((l) => l.sinCosto && l.tipo === "producto").map((l) => l.nombre);
  const subIncompletas = lineas.filter((l) => l.sinCosto && l.tipo === "subreceta").map((l) => l.nombre);
  return (
    <section className="space-y-4">
      <div className="page-head">
        <h1 className="page-title">{rec.Nombre}</h1>
        <Link href={volverListado} className="btn btn-secondary">Volver</Link>
      </div>
      <div className="card">
        <div className="form-grid form-grid-4">
          <Dato titulo="Código">{rec.CodigoReceta}</Dato>
          <Dato titulo="Porciones">{num.format(Number(rec.RendimientoPorciones))}</Dato>
          <Dato titulo="Rendimiento">{rec.RendimientoCantidad === null ? "" : `${num.format(Number(rec.RendimientoCantidad))} ${nombreUnidad.get(rec.RendimientoUnidad ?? "") ?? rec.RendimientoUnidad}`}</Dato>
          <Dato titulo="Estado"><Badge tone={rec.IdEstado === 1 ? "ok" : "neutral"}>{rec.IdEstado === 1 ? "Vigente" : "No vigente"}</Badge></Dato>
          <Dato titulo={`Costo total${calculo?.incompleto ? " (parcial)" : ""}`}>{calculo ? clp(calculo.total) : ""}</Dato>
          <Dato titulo={`Costo por porción${calculo?.incompleto ? " (parcial)" : ""}`}>{calculo ? clp(calculo.porcion) : ""}</Dato>
        </div>
      </div>
      {!calculo && <p role="alert" className="alert alert-error">No se pudo calcular el costo de la receta. Revise sus ingredientes e inténtelo de nuevo.</p>}
      {sinFactura.length > 0 && (
        <p role="status" className="alert alert-warn">
          Costo incompleto: aún no hay una factura registrada de {sinFactura.join(", ")} (el costo de un producto se define con su primera factura).
        </p>
      )}
      {subIncompletas.length > 0 && (
        <p role="status" className="alert alert-warn">
          Costo incompleto: la sub-receta {subIncompletas.join(", ")} tiene ingredientes sin costo o no tiene rendimiento.
        </p>
      )}
      <h2 className="section-title">Ingredientes</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Ingrediente</th><th className="num">Cantidad</th><th className="num">Porción neta</th><th className="num">Merma</th><th className="num">Cantidad bruta</th><th className="num">Costo</th></tr></thead>
          <tbody>
            {lineas.map((l) => (
              <tr key={l.detalle}>
                <td>
                  <div className="flex flex-wrap items-center gap-2">
                    {l.tipo === "subreceta"
                      ? <Link className="link link-sm" href={href({ ...base, ver: tokenSub.get(l.id) })}>{l.nombre}</Link>
                      : l.nombre}
                    {l.tipo === "subreceta" && <Badge tone="info">Sub-receta</Badge>}
                  </div>
                </td>
                <td className="num">{l.d ? num.format(Number(l.d.Cantidad)) : "—"}</td>
                <td className="num">{l.d ? `${num.format(Number(l.d.PorcionNeta))} ${nombreUnidad.get(l.d.UnidadMedida) ?? l.d.UnidadMedida}` : "—"}</td>
                <td className="num">{l.d ? `${num.format(Number(l.d.PorcentajeMerma) * 100)} %` : "—"}</td>
                <td className="num">{`${num.format(l.cantidadBruta)} ${nombreUnidad.get(l.unidad) ?? l.unidad}`}</td>
                <td className="num">{l.costo === null ? <Badge tone="warn">Sin costo</Badge> : clp(l.costo)}</td>
              </tr>
            ))}
            {!lineas.length && calculo && <tr><td colSpan={6} className="text-muted">Esta receta no tiene ingredientes.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
